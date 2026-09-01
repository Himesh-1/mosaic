"use client";

import React, { useState, useEffect, useCallback } from "react";
import { X, QrCode, Copy, Check, RefreshCw, AlertTriangle } from "lucide-react";
import { QRCodeDisplay } from "./QRCodeDisplay";
import { Button } from "./Button";
import { api } from "../lib/api";

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
  spaceTitle: string;
  isHost: boolean;
}

export const InviteModal: React.FC<InviteModalProps> = ({
  isOpen,
  onClose,
  spaceId,
  spaceTitle,
  isHost,
}) => {
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrCreateInvite = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const invite = await api.createInvite(spaceId, {
        mode: "link",
        role_on_join: "member",
      });
      if (invite.token) {
        setInviteToken(invite.token);
      }
    } catch (err: any) {
      setError(err.message || "Failed to generate invite.");
    } finally {
      setIsLoading(false);
    }
  }, [spaceId]);

  useEffect(() => {
    if (isOpen && !inviteToken && isHost) {
      fetchOrCreateInvite();
    }
  }, [isOpen, isHost, inviteToken, fetchOrCreateInvite]);

  if (!isOpen) return null;

  const getJoinUrl = () => {
    if (typeof window === "undefined" || !inviteToken) return "";
    return `${window.location.origin}/join/${inviteToken}`;
  };

  const handleCopy = async () => {
    const url = getJoinUrl();
    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-modal-title"
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
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "440px",
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
            <QrCode size={20} color="var(--mosaic-color-brand-primary)" />
            <h2
              id="invite-modal-title"
              style={{ fontSize: "1.125rem", fontWeight: 700 }}
            >
              Invite to {spaceTitle}
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
        <div style={{ padding: "var(--mosaic-space-6)", textAlign: "center" }}>
          {error ? (
            <div
              role="alert"
              style={{
                padding: "12px",
                borderRadius: "var(--mosaic-radius-sm)",
                backgroundColor: "var(--mosaic-color-status-danger-subtle)",
                color: "var(--mosaic-color-status-danger)",
                fontSize: "0.875rem",
                marginBottom: "var(--mosaic-space-4)",
              }}
            >
              {error}
            </div>
          ) : (
            <>
              {/* QR Code Canvas */}
              <div style={{ marginBottom: "var(--mosaic-space-5)" }}>
                {inviteToken ? (
                  <QRCodeDisplay value={getJoinUrl()} size={200} />
                ) : (
                  <div
                    style={{
                      width: "200px",
                      height: "200px",
                      margin: "0 auto",
                      backgroundColor: "var(--mosaic-color-surface-subtle)",
                      borderRadius: "var(--mosaic-radius-md)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <RefreshCw
                      size={24}
                      style={{ animation: "spin 1s linear infinite" }}
                    />
                  </div>
                )}
                <p
                  style={{
                    fontSize: "0.875rem",
                    color: "var(--mosaic-color-text-secondary)",
                    marginTop: "var(--mosaic-space-3)",
                    fontWeight: 500,
                  }}
                >
                  Scan with a phone camera to join in browser
                </p>
              </div>

              {/* Copy Link Input / Button */}
              <div style={{ marginBottom: "var(--mosaic-space-6)" }}>
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    alignItems: "center",
                  }}
                >
                  <input
                    type="text"
                    readOnly
                    value={getJoinUrl()}
                    style={{
                      flex: 1,
                      padding: "10px 12px",
                      borderRadius: "var(--mosaic-radius-md)",
                      border: "1px solid var(--mosaic-color-border-subtle)",
                      backgroundColor: "var(--mosaic-color-surface-subtle)",
                      fontSize: "0.875rem",
                      color: "var(--mosaic-color-text-secondary)",
                      outline: "none",
                    }}
                  />
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleCopy}
                    disabled={!inviteToken}
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    <span>{copied ? "Copied!" : "Copy"}</span>
                  </Button>
                </div>
              </div>

              {/* Security note & Rotate */}
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "var(--mosaic-radius-sm)",
                  backgroundColor: "var(--mosaic-color-surface-subtle)",
                  fontSize: "0.8125rem",
                  color: "var(--mosaic-color-text-secondary)",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "8px",
                }}
              >
                <span>Anyone with this link can join this private Space.</span>
                {isHost && (
                  <button
                    onClick={fetchOrCreateInvite}
                    disabled={isLoading}
                    title="Rotate invite token"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      color: "var(--mosaic-color-brand-primary)",
                      fontWeight: 600,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <RefreshCw size={12} />
                    <span>Rotate</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
