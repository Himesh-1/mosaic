"use client";

import React, { useState } from "react";
import {
  X,
  ArrowDownCircle,
  CheckCircle2,
  Download,
  AlertCircle,
  File,
} from "lucide-react";
import { DirectTransferResponse } from "@mosaic/contracts";
import { Avatar } from "./Avatar";
import { Button } from "./Button";
import { api } from "../lib/api";
import { TransferProgress } from "../lib/webrtc";

interface IncomingTransferModalProps {
  transfer: DirectTransferResponse | null;
  spaceId: string;
  progress?: TransferProgress | null;
  receivedBlobUrl?: string | null;
  onClose: () => void;
  onAccepted?: () => void;
  onDeclined?: () => void;
}

export const IncomingTransferModal: React.FC<IncomingTransferModalProps> = ({
  transfer,
  spaceId,
  progress,
  receivedBlobUrl,
  onClose,
  onAccepted,
  onDeclined,
}) => {
  const [isResponding, setIsResponding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!transfer) return null;

  const handleAccept = async () => {
    setIsResponding(true);
    setError(null);
    try {
      await api.respondToTransfer(spaceId, transfer.id, "accept");
      if (onAccepted) onAccepted();
    } catch (err: any) {
      setError(err.message || "Failed to accept transfer.");
    } finally {
      setIsResponding(false);
    }
  };

  const handleDecline = async () => {
    setIsResponding(true);
    try {
      await api.respondToTransfer(spaceId, transfer.id, "decline");
      if (onDeclined) onDeclined();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to decline transfer.");
    } finally {
      setIsResponding(false);
    }
  };

  const isTransferring =
    progress?.status === "transferring" || progress?.status === "verifying";
  const isCompleted = progress?.status === "completed" || receivedBlobUrl;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="incoming-transfer-title"
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
    >
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
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
            <ArrowDownCircle
              size={20}
              color="var(--mosaic-color-brand-primary)"
            />
            <h2
              id="incoming-transfer-title"
              style={{ fontSize: "1.125rem", fontWeight: 700 }}
            >
              Direct File Transfer
            </h2>
          </div>
          <button
            onClick={onClose}
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

          {/* Sender details */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "var(--mosaic-space-5)",
            }}
          >
            <Avatar name={transfer.sender.display_name} size="lg" />
            <div>
              <div style={{ fontWeight: 700, fontSize: "1rem" }}>
                {transfer.sender.display_name}
              </div>
              <div
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--mosaic-color-text-secondary)",
                }}
              >
                wants to send you a file directly (WebRTC P2P)
              </div>
            </div>
          </div>

          {/* File Card */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "12px 14px",
              borderRadius: "var(--mosaic-radius-md)",
              backgroundColor: "var(--mosaic-color-surface-subtle)",
              border: "1px solid var(--mosaic-color-border-subtle)",
              marginBottom: "var(--mosaic-space-6)",
            }}
          >
            <File size={28} color="var(--mosaic-color-brand-primary)" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: "0.9375rem",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {transfer.file_name}
              </div>
              <div
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--mosaic-color-text-secondary)",
                }}
              >
                {(transfer.size_bytes / (1024 * 1024)).toFixed(2)} MB ·{" "}
                {transfer.mime_type}
              </div>
            </div>
          </div>

          {/* Progress / Completion View */}
          {isTransferring && (
            <div style={{ marginBottom: "var(--mosaic-space-5)" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.8125rem",
                  color: "var(--mosaic-color-text-secondary)",
                  marginBottom: "4px",
                }}
              >
                <span>
                  {progress?.status === "verifying"
                    ? "Verifying SHA-256 hash..."
                    : "Receiving direct stream..."}
                </span>
                <span>{progress?.percent}%</span>
              </div>
              <div
                style={{
                  width: "100%",
                  height: "6px",
                  backgroundColor: "var(--mosaic-color-surface-subtle)",
                  borderRadius: "var(--mosaic-radius-full)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${progress?.percent || 0}%`,
                    height: "100%",
                    backgroundColor: "var(--mosaic-color-brand-primary)",
                    transition: "width 0.2s ease",
                  }}
                />
              </div>
            </div>
          )}

          {isCompleted && receivedBlobUrl && (
            <div
              style={{
                textAlign: "center",
                marginBottom: "var(--mosaic-space-5)",
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  color: "var(--mosaic-color-status-success)",
                  fontWeight: 700,
                  fontSize: "0.9375rem",
                  marginBottom: "12px",
                }}
              >
                <CheckCircle2 size={20} />
                <span>File received & verified!</span>
              </div>
              <div>
                <a
                  href={receivedBlobUrl}
                  download={transfer.file_name}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "10px 18px",
                    borderRadius: "var(--mosaic-radius-md)",
                    backgroundColor: "var(--mosaic-color-brand-primary)",
                    color: "#FFFFFF",
                    fontSize: "0.9375rem",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  <Download size={18} />
                  <span>Save to Device</span>
                </a>
              </div>
            </div>
          )}

          {/* Action buttons (only when pending approval) */}
          {!isTransferring && !isCompleted && (
            <div style={{ display: "flex", gap: "10px" }}>
              <Button
                variant="secondary"
                size="lg"
                onClick={handleDecline}
                disabled={isResponding}
                style={{ flex: 1 }}
              >
                Decline
              </Button>
              <Button
                variant="primary"
                size="lg"
                onClick={handleAccept}
                isLoading={isResponding}
                style={{ flex: 1 }}
              >
                Accept Direct Transfer
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
