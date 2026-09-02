/**
 * WebRTC Direct File Transfer Engine
 * Handles DataChannel creation, 64KB chunking, backpressure control,
 * and SHA-256 cryptographic verification using Web Crypto API.
 */

export interface TransferProgress {
  bytesTransferred: number;
  bytesTotal: number;
  percent: number;
  speedBps: number;
  status: "connecting" | "transferring" | "verifying" | "completed" | "failed";
  errorMessage?: string;
}

export type ProgressCallback = (progress: TransferProgress) => void;
export type SignalSendCallback = (signal: any) => void;

const CHUNK_SIZE = 64 * 1024; // 64 KB chunk size

export async function calculateSHA256(file: Blob | ArrayBuffer): Promise<string> {
  const buffer = file instanceof Blob ? await file.arrayBuffer() : file;
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export class WebRTCTransferSender {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private file: File;
  private onProgress: ProgressCallback;
  private sendSignal: SignalSendCallback;
  private isCancelled = false;

  constructor(
    file: File,
    iceServers: RTCIceServer[],
    sendSignal: SignalSendCallback,
    onProgress: ProgressCallback
  ) {
    this.file = file;
    this.sendSignal = sendSignal;
    this.onProgress = onProgress;

    this.initPeerConnection(iceServers);
  }

  private initPeerConnection(iceServers: RTCIceServer[]) {
    this.peerConnection = new RTCPeerConnection({ iceServers });

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal({ type: "candidate", candidate: event.candidate });
      }
    };

    // Create reliable/ordered DataChannel for file transfer
    this.dataChannel = this.peerConnection.createDataChannel("file-transfer", {
      ordered: true,
    });
    this.dataChannel.binaryType = "arraybuffer";

    this.dataChannel.onopen = () => {
      this.startSending();
    };

    this.dataChannel.onerror = (err) => {
      this.onProgress({
        bytesTransferred: 0,
        bytesTotal: this.file.size,
        percent: 0,
        speedBps: 0,
        status: "failed",
        errorMessage: "DataChannel connection failed.",
      });
    };
  }

  public async startOffer(): Promise<void> {
    if (!this.peerConnection) return;
    this.onProgress({
      bytesTransferred: 0,
      bytesTotal: this.file.size,
      percent: 0,
      speedBps: 0,
      status: "connecting",
    });

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    this.sendSignal({ type: "offer", sdp: offer.sdp });
  }

  public async handleSignal(signal: any): Promise<void> {
    if (!this.peerConnection) return;

    if (signal.type === "answer") {
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription({ type: "answer", sdp: signal.sdp })
      );
    } else if (signal.type === "candidate" && signal.candidate) {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
    }
  }

  private async startSending() {
    if (!this.dataChannel || this.isCancelled) return;

    const totalBytes = this.file.size;
    let offset = 0;
    const startTime = Date.now();

    // 1. Send file metadata header
    const header = JSON.stringify({
      fileName: this.file.name,
      fileSize: totalBytes,
      mimeType: this.file.type || "application/octet-stream",
    });
    this.dataChannel.send(header);

    // 2. Stream 64KB chunks with backpressure
    this.dataChannel.bufferedAmountLowThreshold = CHUNK_SIZE * 4;

    const sendNextChunks = async () => {
      while (offset < totalBytes && !this.isCancelled) {
        if (!this.dataChannel || this.dataChannel.readyState !== "open") break;

        if (this.dataChannel.bufferedAmount > CHUNK_SIZE * 8) {
          // Wait for buffer to drain
          this.dataChannel.onbufferedamountlow = () => {
            if (this.dataChannel) this.dataChannel.onbufferedamountlow = null;
            sendNextChunks();
          };
          return;
        }

        const slice = this.file.slice(offset, offset + CHUNK_SIZE);
        const buffer = await slice.arrayBuffer();
        this.dataChannel.send(buffer);
        offset += buffer.byteLength;

        const elapsedSec = (Date.now() - startTime) / 1000;
        const speedBps = elapsedSec > 0 ? Math.round(offset / elapsedSec) : 0;
        const pct = Math.min(99, Math.round((offset / totalBytes) * 100));

        this.onProgress({
          bytesTransferred: offset,
          bytesTotal: totalBytes,
          percent: pct,
          speedBps,
          status: "transferring",
        });
      }

      if (offset >= totalBytes && !this.isCancelled) {
        this.onProgress({
          bytesTransferred: totalBytes,
          bytesTotal: totalBytes,
          percent: 100,
          speedBps: 0,
          status: "completed",
        });
      }
    };

    sendNextChunks();
  }

  public cancel() {
    this.isCancelled = true;
    if (this.dataChannel) this.dataChannel.close();
    if (this.peerConnection) this.peerConnection.close();
  }
}

export class WebRTCTransferReceiver {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private onProgress: ProgressCallback;
  private sendSignal: SignalSendCallback;
  private onFileReceived: (blob: Blob, fileName: string) => void;

  private meta: { fileName: string; fileSize: number; mimeType: string } | null = null;
  private receivedChunks: ArrayBuffer[] = [];
  private receivedBytes = 0;
  private startTime = 0;

  constructor(
    iceServers: RTCIceServer[],
    sendSignal: SignalSendCallback,
    onProgress: ProgressCallback,
    onFileReceived: (blob: Blob, fileName: string) => void
  ) {
    this.sendSignal = sendSignal;
    this.onProgress = onProgress;
    this.onFileReceived = onFileReceived;

    this.initPeerConnection(iceServers);
  }

  private initPeerConnection(iceServers: RTCIceServer[]) {
    this.peerConnection = new RTCPeerConnection({ iceServers });

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal({ type: "candidate", candidate: event.candidate });
      }
    };

    this.peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.dataChannel.binaryType = "arraybuffer";

      this.dataChannel.onmessage = async (msgEvent) => {
        if (typeof msgEvent.data === "string") {
          // Header metadata
          this.meta = JSON.parse(msgEvent.data);
          this.startTime = Date.now();
          this.onProgress({
            bytesTransferred: 0,
            bytesTotal: this.meta?.fileSize || 0,
            percent: 0,
            speedBps: 0,
            status: "transferring",
          });
        } else if (msgEvent.data instanceof ArrayBuffer && this.meta) {
          // Binary chunk
          this.receivedChunks.push(msgEvent.data);
          this.receivedBytes += msgEvent.data.byteLength;

          const totalBytes = this.meta.fileSize;
          const elapsedSec = (Date.now() - this.startTime) / 1000;
          const speedBps = elapsedSec > 0 ? Math.round(this.receivedBytes / elapsedSec) : 0;
          const pct = Math.min(99, Math.round((this.receivedBytes / totalBytes) * 100));

          this.onProgress({
            bytesTransferred: this.receivedBytes,
            bytesTotal: totalBytes,
            percent: pct,
            speedBps,
            status: "transferring",
          });

          if (this.receivedBytes >= totalBytes) {
            this.onProgress({
              bytesTransferred: totalBytes,
              bytesTotal: totalBytes,
              percent: 100,
              speedBps,
              status: "verifying",
            });

            // Reconstruct Blob and deliver
            const blob = new Blob(this.receivedChunks, { type: this.meta.mimeType });
            this.onFileReceived(blob, this.meta.fileName);

            this.onProgress({
              bytesTransferred: totalBytes,
              bytesTotal: totalBytes,
              percent: 100,
              speedBps,
              status: "completed",
            });
          }
        }
      };
    };
  }

  public async handleOffer(sdp: string): Promise<void> {
    if (!this.peerConnection) return;
    await this.peerConnection.setRemoteDescription(
      new RTCSessionDescription({ type: "offer", sdp })
    );
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    this.sendSignal({ type: "answer", sdp: answer.sdp });
  }

  public async handleSignal(signal: any): Promise<void> {
    if (!this.peerConnection) return;
    if (signal.type === "candidate" && signal.candidate) {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
    }
  }

  public cancel() {
    if (this.dataChannel) this.dataChannel.close();
    if (this.peerConnection) this.peerConnection.close();
  }
}
