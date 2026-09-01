"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Activity,
  Wifi,
  Shield,
  Server,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "./Button";
import { api } from "../lib/api";

interface DiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
  connectionStatus: "connected" | "reconnecting" | "offline";
  latestSequence: number;
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({
  isOpen,
  onClose,
  spaceId,
  connectionStatus,
  latestSequence,
}) => {
  const [iceServers, setIceServers] = useState<string[]>([]);
  const [isCheckingIce, setIsCheckingIce] = useState(false);
  const [apiLatencyMs, setApiLatencyMs] = useState<number | null>(null);

  const checkDiagnostics = React.useCallback(async () => {
    setIsCheckingIce(true);
    const start = performance.now();
    try {
      const resp = await api.getIceServers(spaceId);
      const latency = Math.round(performance.now() - start);
      setApiLatencyMs(latency);

      const urls = resp.ice_servers.flatMap((s) =>
        Array.isArray(s.urls) ? s.urls : [s.urls],
      );
      setIceServers(urls);
    } catch {
      setApiLatencyMs(null);
    } finally {
      setIsCheckingIce(false);
    }
  }, [spaceId]);

  useEffect(() => {
    if (isOpen && spaceId) {
      checkDiagnostics();
    }
  }, [isOpen, spaceId, checkDiagnostics]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="diagnostics-modal-title"
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
            <Activity size={20} color="var(--mosaic-color-brand-primary)" />
            <h2
              id="diagnostics-modal-title"
              style={{ fontSize: "1.125rem", fontWeight: 700 }}
            >
              Network & Realtime Diagnostics
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
        <div
          style={{
            padding: "var(--mosaic-space-6)",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          {/* WebSocket Status */}
          <div
            style={{
              padding: "12px 14px",
              borderRadius: "var(--mosaic-radius-md)",
              backgroundColor: "var(--mosaic-color-surface-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Wifi size={18} color="var(--mosaic-color-brand-primary)" />
              <div>
                <div style={{ fontSize: "0.875rem", fontWeight: 700 }}>
                  WebSocket Gateway
                </div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--mosaic-color-text-secondary)",
                  }}
                >
                  Realtime activity feed & signaling
                </div>
              </div>
            </div>
            <div
              style={{
                fontSize: "0.8125rem",
                fontWeight: 700,
                color:
                  connectionStatus === "connected"
                    ? "var(--mosaic-color-status-success)"
                    : connectionStatus === "reconnecting"
                      ? "var(--mosaic-color-status-warning)"
                      : "var(--mosaic-color-status-danger)",
                textTransform: "capitalize",
              }}
            >
              {connectionStatus}
            </div>
          </div>

          {/* Sequence Cursor */}
          <div
            style={{
              padding: "12px 14px",
              borderRadius: "var(--mosaic-radius-md)",
              backgroundColor: "var(--mosaic-color-surface-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Server size={18} color="var(--mosaic-color-brand-primary)" />
              <div>
                <div style={{ fontSize: "0.875rem", fontWeight: 700 }}>
                  Event Sequence Cursor
                </div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--mosaic-color-text-secondary)",
                  }}
                >
                  Monotonic order checkpoint
                </div>
              </div>
            </div>
            <div style={{ fontSize: "0.875rem", fontWeight: 800 }}>
              #{latestSequence}
            </div>
          </div>

          {/* API Latency */}
          <div
            style={{
              padding: "12px 14px",
              borderRadius: "var(--mosaic-radius-md)",
              backgroundColor: "var(--mosaic-color-surface-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Activity size={18} color="var(--mosaic-color-brand-primary)" />
              <div>
                <div style={{ fontSize: "0.875rem", fontWeight: 700 }}>
                  API HTTP Latency
                </div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--mosaic-color-text-secondary)",
                  }}
                >
                  REST gateway roundtrip
                </div>
              </div>
            </div>
            <div style={{ fontSize: "0.875rem", fontWeight: 800 }}>
              {apiLatencyMs !== null ? `${apiLatencyMs} ms` : "—"}
            </div>
          </div>

          {/* STUN/TURN Config */}
          <div
            style={{
              padding: "12px 14px",
              borderRadius: "var(--mosaic-radius-md)",
              backgroundColor: "var(--mosaic-color-surface-subtle)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "8px",
              }}
            >
              <Shield size={18} color="var(--mosaic-color-brand-primary)" />
              <div style={{ fontSize: "0.875rem", fontWeight: 700 }}>
                STUN/TURN WebRTC Relay
              </div>
            </div>
            {iceServers.length > 0 ? (
              <div
                style={{ display: "flex", flexDirection: "column", gap: "4px" }}
              >
                {iceServers.map((url, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: "0.75rem",
                      fontFamily: "monospace",
                      color: "var(--mosaic-color-text-secondary)",
                      backgroundColor: "var(--mosaic-color-surface-base)",
                      padding: "4px 8px",
                      borderRadius: "var(--mosaic-radius-sm)",
                    }}
                  >
                    {url}
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--mosaic-color-text-muted)",
                }}
              >
                {isCheckingIce
                  ? "Querying STUN/TURN servers..."
                  : "No ICE servers available."}
              </div>
            )}
          </div>

          {/* Action button */}
          <Button
            variant="secondary"
            size="sm"
            onClick={checkDiagnostics}
            isLoading={isCheckingIce}
            style={{ width: "100%", marginTop: "4px" }}
          >
            <RefreshCw size={14} />
            <span>Refresh Diagnostics</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
