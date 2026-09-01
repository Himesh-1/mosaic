"use client";

import React, { useState } from "react";
import { X, CheckCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "./Button";
import { api } from "../lib/api";

interface CompleteSpaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
  spaceTitle: string;
  isCompleted: boolean;
  onStatusChanged: () => void;
}

export const CompleteSpaceModal: React.FC<CompleteSpaceModalProps> = ({
  isOpen,
  onClose,
  spaceId,
  spaceTitle,
  isCompleted,
  onStatusChanged,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAction = async () => {
    setError(null);
    setIsLoading(true);
    try {
      if (isCompleted) {
        await api.reopenSpace(spaceId);
      } else {
        await api.completeSpace(spaceId);
      }
      onStatusChanged();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to update Space status.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="complete-space-title"
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
        if (e.target === e.currentTarget && !isLoading) onClose();
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
            {isCompleted ? (
              <RefreshCw size={20} color="var(--mosaic-color-brand-primary)" />
            ) : (
              <CheckCircle
                size={20}
                color="var(--mosaic-color-brand-primary)"
              />
            )}
            <h2
              id="complete-space-title"
              style={{ fontSize: "1.125rem", fontWeight: 700 }}
            >
              {isCompleted ? "Reopen Space" : "Complete Space"}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
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

          {isCompleted ? (
            <div>
              <p
                style={{
                  color: "var(--mosaic-color-text-primary)",
                  fontSize: "0.9375rem",
                  lineHeight: 1.5,
                  marginBottom: "var(--mosaic-space-4)",
                }}
              >
                Reopening <strong>{spaceTitle}</strong> will make it active
                again. Members will be able to send new messages, upload photos,
                and create polls.
              </p>
            </div>
          ) : (
            <div>
              <p
                style={{
                  color: "var(--mosaic-color-text-primary)",
                  fontSize: "0.9375rem",
                  lineHeight: 1.5,
                  marginBottom: "var(--mosaic-space-4)",
                }}
              >
                Marking <strong>{spaceTitle}</strong> as completed wraps up this
                gathering and turns it into a permanent shared memory.
              </p>
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: "var(--mosaic-radius-md)",
                  backgroundColor: "var(--mosaic-color-surface-subtle)",
                  fontSize: "0.8125rem",
                  color: "var(--mosaic-color-text-secondary)",
                  lineHeight: 1.4,
                  marginBottom: "var(--mosaic-space-6)",
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    color: "var(--mosaic-color-text-primary)",
                    marginBottom: "4px",
                  }}
                >
                  What happens when a Space is completed?
                </div>
                <ul
                  style={{
                    paddingLeft: "18px",
                    margin: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <li>
                    The Space becomes <strong>read-only</strong>.
                  </li>
                  <li>
                    All photos, messages, checklists, and decisions remain
                    safely preserved.
                  </li>
                  <li>
                    Members can view the final <strong>Memory Summary</strong>{" "}
                    and export the archive anytime.
                  </li>
                  <li>As host, you can reopen the Space at any time.</li>
                </ul>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div
            style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}
          >
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleAction}
              isLoading={isLoading}
            >
              {isCompleted ? "Reopen Space" : "Complete & Preserve Space"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
