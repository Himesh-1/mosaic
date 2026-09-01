"use client";

import React, { useState, useEffect } from "react";
import { X, Download, File, ExternalLink, RefreshCw } from "lucide-react";
import { AssetResponse } from "@mosaic/contracts";
import { Button } from "./Button";
import { api } from "../lib/api";

interface MediaLightboxProps {
  asset: AssetResponse | null;
  spaceId: string;
  onClose: () => void;
}

export const MediaLightbox: React.FC<MediaLightboxProps> = ({
  asset,
  spaceId,
  onClose,
}) => {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(asset?.download_url || null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (asset) {
      if (asset.download_url) {
        setDownloadUrl(asset.download_url);
      } else {
        setIsLoading(true);
        api
          .getAssetUrl(spaceId, asset.id)
          .then((res) => setDownloadUrl(res.download_url))
          .catch(() => setDownloadUrl(null))
          .finally(() => setIsLoading(false));
      }
    } else {
      setDownloadUrl(null);
    }
  }, [asset, spaceId]);

  if (!asset) return null;

  const isImage = asset.mime_type.startsWith("image/");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lightbox-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: "var(--mosaic-z-modal)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(20, 22, 20, 0.85)",
        backdropFilter: "blur(8px)",
        padding: "var(--mosaic-space-4)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "800px",
          maxHeight: "90vh",
          backgroundColor: "var(--mosaic-color-surface-base)",
          borderRadius: "var(--mosaic-radius-lg)",
          boxShadow: "var(--mosaic-shadow-lg)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "var(--mosaic-space-4) var(--mosaic-space-6)",
            borderBottom: "1px solid var(--mosaic-color-border-subtle)",
          }}
        >
          <div>
            <h3
              id="lightbox-title"
              style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}
            >
              {asset.original_name}
            </h3>
            <div
              style={{
                fontSize: "0.8125rem",
                color: "var(--mosaic-color-text-secondary)",
              }}
            >
              Uploaded by {asset.uploader.display_name} ·{" "}
              {(asset.size_bytes / (1024 * 1024)).toFixed(2)} MB
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {downloadUrl && (
              <a
                href={downloadUrl}
                target="_blank"
                rel="noreferrer"
                download={asset.original_name}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  borderRadius: "var(--mosaic-radius-md)",
                  backgroundColor: "var(--mosaic-color-brand-primary)",
                  color: "#FFFFFF",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                <Download size={16} />
                <span>Download</span>
              </a>
            )}
            <button
              onClick={onClose}
              aria-label="Close preview"
              style={{
                padding: "6px",
                borderRadius: "var(--mosaic-radius-sm)",
                color: "var(--mosaic-color-text-secondary)",
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Preview Area */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "var(--mosaic-space-6)",
            backgroundColor: "var(--mosaic-color-surface-subtle)",
            overflow: "hidden",
          }}
        >
          {isLoading ? (
            <RefreshCw
              size={28}
              style={{ animation: "spin 1s linear infinite" }}
            />
          ) : isImage && downloadUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={downloadUrl}
              alt={asset.original_name}
              style={{
                maxWidth: "100%",
                maxHeight: "65vh",
                objectFit: "contain",
                borderRadius: "var(--mosaic-radius-md)",
                boxShadow: "var(--mosaic-shadow-md)",
              }}
            />
          ) : (
            <div
              style={{ textAlign: "center", padding: "var(--mosaic-space-8)" }}
            >
              <File
                size={64}
                color="var(--mosaic-color-brand-primary)"
                style={{ margin: "0 auto 16px auto" }}
              />
              <div
                style={{
                  fontSize: "1.125rem",
                  fontWeight: 700,
                  marginBottom: "6px",
                }}
              >
                {asset.original_name}
              </div>
              <div
                style={{
                  color: "var(--mosaic-color-text-secondary)",
                  marginBottom: "var(--mosaic-space-5)",
                }}
              >
                {asset.mime_type} ·{" "}
                {(asset.size_bytes / (1024 * 1024)).toFixed(2)} MB
              </div>
              {downloadUrl && (
                <a
                  href={downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  download={asset.original_name}
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
                  <span>Download File</span>
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
