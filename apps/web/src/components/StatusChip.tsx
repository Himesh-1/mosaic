"use client";

import React from "react";
import { CheckCircle2, RefreshCw, AlertCircle, WifiOff } from "lucide-react";

export type ConnectionStatus =
  "connected" | "reconnecting" | "offline" | "queued" | "error";

interface StatusChipProps {
  status: ConnectionStatus;
  label?: string;
}

export const StatusChip: React.FC<StatusChipProps> = ({ status, label }) => {
  const getStatusConfig = () => {
    switch (status) {
      case "connected":
        return {
          icon: (
            <CheckCircle2
              size={14}
              color="var(--mosaic-color-status-success)"
              aria-hidden="true"
            />
          ),
          defaultLabel: "Connected",
          bg: "var(--mosaic-color-status-success-subtle)",
          color: "var(--mosaic-color-status-success)",
        };
      case "reconnecting":
        return {
          icon: (
            <RefreshCw
              size={14}
              color="var(--mosaic-color-status-warning)"
              aria-hidden="true"
              style={{ animation: "spin 1.5s linear infinite" }}
            />
          ),
          defaultLabel: "Reconnecting",
          bg: "var(--mosaic-color-status-warning-subtle)",
          color: "var(--mosaic-color-status-warning)",
        };
      case "offline":
        return {
          icon: (
            <WifiOff
              size={14}
              color="var(--mosaic-color-text-secondary)"
              aria-hidden="true"
            />
          ),
          defaultLabel: "Offline",
          bg: "var(--mosaic-color-surface-subtle)",
          color: "var(--mosaic-color-text-secondary)",
        };
      case "queued":
        return {
          icon: (
            <AlertCircle
              size={14}
              color="var(--mosaic-color-status-warning)"
              aria-hidden="true"
            />
          ),
          defaultLabel: "Queued",
          bg: "var(--mosaic-color-status-warning-subtle)",
          color: "var(--mosaic-color-status-warning)",
        };
      case "error":
        return {
          icon: (
            <AlertCircle
              size={14}
              color="var(--mosaic-color-status-danger)"
              aria-hidden="true"
            />
          ),
          defaultLabel: "Error",
          bg: "var(--mosaic-color-status-danger-subtle)",
          color: "var(--mosaic-color-status-danger)",
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div
      role="status"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 10px",
        borderRadius: "var(--mosaic-radius-full)",
        backgroundColor: config.bg,
        color: config.color,
        fontSize: "0.8125rem",
        fontWeight: 600,
        userSelect: "none",
      }}
    >
      {config.icon}
      <span>{label || config.defaultLabel}</span>
    </div>
  );
};
