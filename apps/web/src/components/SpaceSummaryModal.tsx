"use client";

import React, { useState } from "react";
import {
  X,
  Sparkles,
  Users,
  MessageSquare,
  Image as ImageIcon,
  Vote,
  CheckSquare,
  Clock,
  Download,
  Calendar,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "./Button";
import { Card } from "./Card";
import { api } from "../lib/api";
import { SpaceSummaryDetailResponse } from "@mosaic/contracts";

interface SpaceSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
}

export const SpaceSummaryModal: React.FC<SpaceSummaryModalProps> = ({
  isOpen,
  onClose,
  spaceId,
}) => {
  const [isExporting, setIsExporting] = useState(false);

  const {
    data: summary,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["space-summary", spaceId],
    queryFn: () => api.getSpaceSummary(spaceId),
    enabled: isOpen && !!spaceId,
  });

  if (!isOpen) return null;

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const exportData = await api.exportSpace(spaceId);
      const dataStr =
        "data:text/json;charset=utf-8," +
        encodeURIComponent(JSON.stringify(exportData, null, 2));
      const downloadAnchor = document.createElement("a");
      const safeTitle = (exportData.space?.title || "space")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute(
        "download",
        `mosaic-${safeTitle}-archive.json`,
      );
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err: any) {
      alert(err.message || "Failed to export Space archive.");
    } finally {
      setIsExporting(false);
    }
  };

  const formatDuration = (seconds?: number | null) => {
    if (!seconds || seconds <= 0) return "Ongoing";
    const hours = Math.floor(seconds / 3600);
    const days = Math.floor(hours / 24);
    if (days > 0) {
      const remHours = hours % 24;
      return `${days} day${days > 1 ? "s" : ""}${remHours > 0 ? ` ${remHours} hr` : ""}`;
    }
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours} hr${hours > 1 ? "s" : ""} ${mins} min`;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="summary-modal-title"
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
          maxWidth: "540px",
          backgroundColor: "var(--mosaic-color-surface-base)",
          borderRadius: "var(--mosaic-radius-lg)",
          boxShadow: "var(--mosaic-shadow-lg)",
          border: "1px solid var(--mosaic-color-border-subtle)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "90vh",
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
            <Sparkles size={20} color="var(--mosaic-color-brand-primary)" />
            <h2
              id="summary-modal-title"
              style={{ fontSize: "1.125rem", fontWeight: 700 }}
            >
              Space Memory Recap
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

        {/* Body */}
        <div style={{ padding: "var(--mosaic-space-6)", overflowY: "auto" }}>
          {isLoading && (
            <div
              style={{
                textAlign: "center",
                padding: "var(--mosaic-space-8) 0",
                color: "var(--mosaic-color-text-secondary)",
              }}
            >
              Loading memory recap...
            </div>
          )}

          {error && (
            <div
              style={{
                color: "var(--mosaic-color-status-danger)",
                textAlign: "center",
              }}
            >
              Failed to load Space summary.
            </div>
          )}

          {summary && (
            <div>
              {/* Title & Template Banner */}
              <div
                style={{
                  textAlign: "center",
                  padding: "var(--mosaic-space-5) var(--mosaic-space-4)",
                  backgroundColor: "var(--mosaic-color-brand-subtle)",
                  borderRadius: "var(--mosaic-radius-md)",
                  marginBottom: "var(--mosaic-space-6)",
                }}
              >
                <h3
                  style={{
                    fontSize: "1.375rem",
                    fontWeight: 800,
                    color: "var(--mosaic-color-text-primary)",
                    marginBottom: "4px",
                  }}
                >
                  {summary.title}
                </h3>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    fontSize: "0.8125rem",
                    color: "var(--mosaic-color-text-secondary)",
                  }}
                >
                  <span
                    style={{ textTransform: "capitalize", fontWeight: 600 }}
                  >
                    {summary.template}
                  </span>
                  <span>·</span>
                  <span>
                    Created {new Date(summary.created_at).toLocaleDateString()}
                  </span>
                  <span>·</span>
                  <span
                    style={{
                      fontWeight: 700,
                      color:
                        summary.status === "completed"
                          ? "var(--mosaic-color-brand-strong)"
                          : "inherit",
                    }}
                  >
                    {summary.status === "completed" ? "Completed" : "Active"}
                  </span>
                </div>
              </div>

              {/* Metrics Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "12px",
                  marginBottom: "var(--mosaic-space-6)",
                }}
              >
                <div
                  style={{
                    padding: "14px",
                    borderRadius: "var(--mosaic-radius-md)",
                    backgroundColor: "var(--mosaic-color-surface-subtle)",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <Users size={24} color="var(--mosaic-color-brand-primary)" />
                  <div>
                    <div style={{ fontSize: "1.25rem", fontWeight: 800 }}>
                      {summary.member_count}
                    </div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--mosaic-color-text-secondary)",
                      }}
                    >
                      Participants
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    padding: "14px",
                    borderRadius: "var(--mosaic-radius-md)",
                    backgroundColor: "var(--mosaic-color-surface-subtle)",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <MessageSquare
                    size={24}
                    color="var(--mosaic-color-brand-primary)"
                  />
                  <div>
                    <div style={{ fontSize: "1.25rem", fontWeight: 800 }}>
                      {summary.message_count}
                    </div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--mosaic-color-text-secondary)",
                      }}
                    >
                      Messages Sent
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    padding: "14px",
                    borderRadius: "var(--mosaic-radius-md)",
                    backgroundColor: "var(--mosaic-color-surface-subtle)",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <ImageIcon
                    size={24}
                    color="var(--mosaic-color-brand-primary)"
                  />
                  <div>
                    <div style={{ fontSize: "1.25rem", fontWeight: 800 }}>
                      {summary.asset_count}
                    </div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--mosaic-color-text-secondary)",
                      }}
                    >
                      Media & Files (
                      {(summary.total_asset_bytes / (1024 * 1024)).toFixed(1)}{" "}
                      MB)
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    padding: "14px",
                    borderRadius: "var(--mosaic-radius-md)",
                    backgroundColor: "var(--mosaic-color-surface-subtle)",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <Vote size={24} color="var(--mosaic-color-brand-primary)" />
                  <div>
                    <div style={{ fontSize: "1.25rem", fontWeight: 800 }}>
                      {summary.poll_count}
                    </div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--mosaic-color-text-secondary)",
                      }}
                    >
                      Group Polls
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    padding: "14px",
                    borderRadius: "var(--mosaic-radius-md)",
                    backgroundColor: "var(--mosaic-color-surface-subtle)",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <CheckSquare
                    size={24}
                    color="var(--mosaic-color-brand-primary)"
                  />
                  <div>
                    <div style={{ fontSize: "1.25rem", fontWeight: 800 }}>
                      {summary.completed_checklist_items}
                    </div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--mosaic-color-text-secondary)",
                      }}
                    >
                      Checklist Tasks Done
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    padding: "14px",
                    borderRadius: "var(--mosaic-radius-md)",
                    backgroundColor: "var(--mosaic-color-surface-subtle)",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <Clock size={24} color="var(--mosaic-color-brand-primary)" />
                  <div>
                    <div style={{ fontSize: "1.125rem", fontWeight: 800 }}>
                      {formatDuration(summary.duration_seconds)}
                    </div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--mosaic-color-text-secondary)",
                      }}
                    >
                      Event Duration
                    </div>
                  </div>
                </div>
              </div>

              {/* Export Archive Action */}
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: "var(--mosaic-radius-md)",
                  backgroundColor: "var(--mosaic-color-surface-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontSize: "0.875rem", fontWeight: 700 }}>
                    Export Space Archive
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--mosaic-color-text-secondary)",
                    }}
                  >
                    Download complete JSON with timeline, messages & media
                    metadata
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleExport}
                  isLoading={isExporting}
                >
                  <Download size={16} />
                  <span>Download .json</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
