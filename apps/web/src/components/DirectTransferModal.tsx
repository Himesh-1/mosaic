"use client";

import React, { useState, useRef } from "react";
import {
  X,
  Send,
  File,
  AlertCircle,
  CheckCircle2,
  User,
  RefreshCw,
  UploadCloud,
} from "lucide-react";
import { MemberProfile, DirectTransferResponse } from "@mosaic/contracts";
import { Avatar } from "./Avatar";
import { Button } from "./Button";
import { api } from "../lib/api";
import { TransferProgress, calculateSHA256 } from "../lib/webrtc";

interface DirectTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
  members: MemberProfile[];
  currentUserId?: string;
  onStartTransfer?: (
    file: File,
    recipientId: string,
    onProgress: (p: TransferProgress) => void,
  ) => Promise<void>;
  onFallbackToCloud?: () => void;
}

export const DirectTransferModal: React.FC<DirectTransferModalProps> = ({
  isOpen,
  onClose,
  spaceId,
  members,
  currentUserId,
  onStartTransfer,
  onFallbackToCloud,
}) => {
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isInitiating, setIsInitiating] = useState(false);
  const [progress, setProgress] = useState<TransferProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const eligibleRecipients = members.filter((m) => m.user_id !== currentUserId);

  const handleFileSelect = (file: File) => {
    if (file.size > 262144000) {
      setError("File is too large for direct transfer (max 250 MB).");
      return;
    }
    setError(null);
    setSelectedFile(file);
    setProgress(null);
  };

  const handleSend = async () => {
    if (!selectedFile || !selectedRecipientId) return;

    setError(null);
    setIsInitiating(true);
    setProgress({
      bytesTransferred: 0,
      bytesTotal: selectedFile.size,
      percent: 0,
      speedBps: 0,
      status: "connecting",
    });

    try {
      const sha256 = await calculateSHA256(selectedFile);
      const clientMutationId = `dt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // 1. Create server-side transfer intent
      await api.createDirectTransferIntent(spaceId, {
        recipient_id: selectedRecipientId,
        file_name: selectedFile.name,
        mime_type: selectedFile.type || "application/octet-stream",
        size_bytes: selectedFile.size,
        sha256_hash: sha256,
        client_mutation_id: clientMutationId,
      });

      // 2. Trigger WebRTC transfer engine callback if provided
      if (onStartTransfer) {
        await onStartTransfer(selectedFile, selectedRecipientId, (p) =>
          setProgress(p),
        );
      }
    } catch (err: any) {
      setError(err.message || "Failed to start direct transfer.");
      setProgress({
        bytesTransferred: 0,
        bytesTotal: selectedFile.size,
        percent: 0,
        speedBps: 0,
        status: "failed",
        errorMessage: err.message,
      });
    } finally {
      setIsInitiating(false);
    }
  };

  const isTransferring =
    progress?.status === "transferring" || progress?.status === "connecting";
  const isFailed = progress?.status === "failed";
  const isCompleted = progress?.status === "completed";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="direct-transfer-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: "var(--mosaic-z-modal)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(28, 30, 27, 0.45)",
        backdropFilter: "blur(4px)",
        padding: "var(--mosaic-space-4)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isTransferring) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          backgroundColor: "var(--mosaic-color-surface-base)",
          borderRadius: "var(--mosaic-radius-lg)",
          boxShadow: "var(--mosaic-shadow-lg)",
          border: "1px solid var(--mosaic-color-border-subtle)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "var(--mosaic-space-5) var(--mosaic-space-6)",
            borderBottom: "1px solid var(--mosaic-color-border-subtle)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Send size={20} color="var(--mosaic-color-brand-primary)" />
            <h2
              id="direct-transfer-title"
              style={{ fontSize: "1.125rem", fontWeight: 700 }}
            >
              Direct Browser-to-Browser Transfer
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isTransferring}
            aria-label="Close dialog"
            style={{
              padding: "4px",
              borderRadius: "var(--mosaic-radius-sm)",
              color: "var(--mosaic-color-text-secondary)",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "var(--mosaic-space-6)" }}>
          {error && (
            <div
              role="alert"
              style={{
                marginBottom: "var(--mosaic-space-4)",
                padding: "10px 14px",
                borderRadius: "var(--mosaic-radius-sm)",
                backgroundColor: "var(--mosaic-color-status-danger-subtle)",
                color: "var(--mosaic-color-status-danger)",
                fontSize: "0.875rem",
              }}
            >
              {error}
            </div>
          )}

          {/* Recipient Selection */}
          {!progress && (
            <div style={{ marginBottom: "var(--mosaic-space-5)" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  marginBottom: "8px",
                  color: "var(--mosaic-color-text-secondary)",
                }}
              >
                1. Select Recipient in this Space
              </label>
              {eligibleRecipients.length === 0 ? (
                <div
                  style={{
                    fontSize: "0.875rem",
                    color: "var(--mosaic-color-text-muted)",
                  }}
                >
                  No other members currently in this Space. Invite someone
                  first!
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  {eligibleRecipients.map((recip) => {
                    const isSelected = selectedRecipientId === recip.user_id;
                    return (
                      <button
                        key={recip.user_id}
                        type="button"
                        onClick={() => setSelectedRecipientId(recip.user_id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          padding: "10px 12px",
                          borderRadius: "var(--mosaic-radius-md)",
                          border: isSelected
                            ? "2px solid var(--mosaic-color-brand-primary)"
                            : "1px solid var(--mosaic-color-border-subtle)",
                          backgroundColor: isSelected
                            ? "var(--mosaic-color-brand-subtle)"
                            : "var(--mosaic-color-surface-base)",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <Avatar
                          name={recip.display_name}
                          size="sm"
                          status={
                            recip.presence_status === "online"
                              ? "online"
                              : undefined
                          }
                        />
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontWeight: isSelected ? 700 : 500,
                              fontSize: "0.9375rem",
                            }}
                          >
                            {recip.display_name}
                          </div>
                          <div
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--mosaic-color-text-muted)",
                            }}
                          >
                            {recip.presence_status === "online"
                              ? "Online now"
                              : "Offline"}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* File Picker */}
          {!progress && (
            <div style={{ marginBottom: "var(--mosaic-space-6)" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  marginBottom: "8px",
                  color: "var(--mosaic-color-text-secondary)",
                }}
              >
                2. Select File to Send
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: "2px dashed var(--mosaic-color-border-strong)",
                  borderRadius: "var(--mosaic-radius-md)",
                  padding: "var(--mosaic-space-6) var(--mosaic-space-4)",
                  textAlign: "center",
                  cursor: "pointer",
                  backgroundColor: "var(--mosaic-color-surface-subtle)",
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) =>
                    e.target.files?.[0] && handleFileSelect(e.target.files[0])
                  }
                  style={{ display: "none" }}
                />
                {selectedFile ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <File size={28} color="var(--mosaic-color-brand-primary)" />
                    <div style={{ fontWeight: 700, fontSize: "0.9375rem" }}>
                      {selectedFile.name}
                    </div>
                    <div
                      style={{
                        fontSize: "0.8125rem",
                        color: "var(--mosaic-color-text-secondary)",
                      }}
                    >
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </div>
                  </div>
                ) : (
                  <div>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: "0.9375rem",
                        marginBottom: "2px",
                      }}
                    >
                      Click to choose a file
                    </div>
                    <div
                      style={{
                        fontSize: "0.8125rem",
                        color: "var(--mosaic-color-text-muted)",
                      }}
                    >
                      Up to 250 MB sent directly peer-to-peer
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Progress / Status Display */}
          {progress && (
            <div style={{ marginBottom: "var(--mosaic-space-6)" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.8125rem",
                  color: "var(--mosaic-color-text-secondary)",
                  marginBottom: "6px",
                }}
              >
                <span>
                  {progress.status === "connecting"
                    ? "Waiting for recipient approval & connecting..."
                    : progress.status === "transferring"
                      ? `Streaming via WebRTC (${(progress.speedBps / 1024).toFixed(0)} KB/s)...`
                      : progress.status === "completed"
                        ? "Direct transfer complete!"
                        : "Transfer interrupted"}
                </span>
                <span>{progress.percent}%</span>
              </div>
              <div
                style={{
                  width: "100%",
                  height: "6px",
                  backgroundColor: "var(--mosaic-color-surface-subtle)",
                  borderRadius: "var(--mosaic-radius-full)",
                  overflow: "hidden",
                  marginBottom: "14px",
                }}
              >
                <div
                  style={{
                    width: `${progress.percent}%`,
                    height: "100%",
                    backgroundColor: isFailed
                      ? "var(--mosaic-color-status-danger)"
                      : isCompleted
                        ? "var(--mosaic-color-status-success)"
                        : "var(--mosaic-color-brand-primary)",
                    transition: "width 0.2s ease",
                  }}
                />
              </div>

              {isCompleted && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    color: "var(--mosaic-color-status-success)",
                    fontWeight: 700,
                    fontSize: "0.9375rem",
                  }}
                >
                  <CheckCircle2 size={18} />
                  <span>File received & verified by recipient.</span>
                </div>
              )}

              {/* Truthful Fallback UX */}
              {isFailed && (
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: "var(--mosaic-radius-md)",
                    backgroundColor: "var(--mosaic-color-surface-subtle)",
                    border: "1px solid var(--mosaic-color-border-subtle)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      color: "var(--mosaic-color-text-primary)",
                      marginBottom: "8px",
                    }}
                  >
                    Direct connection interrupted
                  </div>
                  <div
                    style={{
                      fontSize: "0.8125rem",
                      color: "var(--mosaic-color-text-secondary)",
                      marginBottom: "12px",
                    }}
                  >
                    WebRTC direct transfers require both devices to remain
                    active. You can share this file via Space Cloud Storage
                    instead.
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      onClose();
                      if (onFallbackToCloud) onFallbackToCloud();
                    }}
                  >
                    <UploadCloud size={16} />
                    <span>Share via Space Cloud Storage</span>
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Action Button */}
          {!progress && (
            <Button
              type="button"
              variant="primary"
              size="lg"
              disabled={!selectedFile || !selectedRecipientId || isInitiating}
              isLoading={isInitiating}
              onClick={handleSend}
              style={{ width: "100%" }}
            >
              Start Direct Transfer
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
