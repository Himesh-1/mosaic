"use client";

import React, { useState, useRef } from "react";
import { X, UploadCloud, File, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "./Button";
import { api } from "../lib/api";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
  onUploadCompleted?: () => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  spaceId,
  onUploadCompleted,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [progressPct, setProgressPct] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = (file: File) => {
    if (file.size > 52428800) {
      setError("File is too large (max 50 MB allowed).");
      return;
    }
    setError(null);
    setSelectedFile(file);
    setIsSuccess(false);
    setProgressPct(0);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || isUploading) return;

    setError(null);
    setIsUploading(true);
    setProgressPct(5);

    try {
      const signMutationId = `sign-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const completeMutationId = `complete-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // 1. Sign upload request
      const signData = await api.signUpload(spaceId, {
        original_name: selectedFile.name,
        mime_type: selectedFile.type || "application/octet-stream",
        size_bytes: selectedFile.size,
        client_mutation_id: signMutationId,
      });

      setProgressPct(20);

      // 2. Direct binary upload to S3 presigned PUT URL via XMLHttpRequest for progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(signData.method, signData.upload_url);

        if (signData.headers) {
          Object.entries(signData.headers).forEach(([k, v]) => {
            xhr.setRequestHeader(k, v);
          });
        }

        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) {
            const pct = Math.round(20 + (evt.loaded / evt.total) * 65);
            setProgressPct(pct);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(
              new Error(
                `Direct storage upload failed with status ${xhr.status}`,
              ),
            );
          }
        };

        xhr.onerror = () => {
          reject(new Error("Network error during file upload. Please check your connection."));
        };

        xhr.send(selectedFile);
      });

      setProgressPct(90);

      // 3. Complete Upload
      await api.completeUpload(spaceId, signData.asset_id, {
        client_mutation_id: completeMutationId,
      });

      setProgressPct(100);
      setIsSuccess(true);

      setTimeout(() => {
        setIsSuccess(false);
        setSelectedFile(null);
        onClose();
        if (onUploadCompleted) onUploadCompleted();
      }, 1000);
    } catch (err: any) {
      setError(err.message || "Failed to upload file. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-modal-title"
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
        if (e.target === e.currentTarget && !isUploading) onClose();
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
            <UploadCloud size={20} color="var(--mosaic-color-brand-primary)" />
            <h2
              id="upload-modal-title"
              style={{ fontSize: "1.125rem", fontWeight: 700 }}
            >
              Upload Photos & Files
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isUploading}
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

          {/* Dropzone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => !isUploading && fileInputRef.current?.click()}
            style={{
              border: "2px dashed var(--mosaic-color-border-strong)",
              borderRadius: "var(--mosaic-radius-md)",
              padding: "var(--mosaic-space-8) var(--mosaic-space-4)",
              textAlign: "center",
              cursor: isUploading ? "not-allowed" : "pointer",
              backgroundColor: "var(--mosaic-color-surface-subtle)",
              marginBottom: "var(--mosaic-space-5)",
              transition: "border-color 0.2s ease",
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
                  gap: "8px",
                }}
              >
                <File size={32} color="var(--mosaic-color-brand-primary)" />
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
                <UploadCloud
                  size={36}
                  color="var(--mosaic-color-brand-primary)"
                  style={{ margin: "0 auto 10px auto" }}
                />
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: "0.9375rem",
                    marginBottom: "4px",
                  }}
                >
                  Click to browse or drag and drop
                </div>
                <div
                  style={{
                    fontSize: "0.8125rem",
                    color: "var(--mosaic-color-text-muted)",
                  }}
                >
                  JPG, PNG, WebP, PDF, documents up to 50 MB
                </div>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          {isUploading && (
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
                <span>Uploading directly to private storage...</span>
                <span>{progressPct}%</span>
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
                    width: `${progressPct}%`,
                    height: "100%",
                    backgroundColor: "var(--mosaic-color-brand-primary)",
                    transition: "width 0.2s ease",
                  }}
                />
              </div>
            </div>
          )}

          {isSuccess && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                color: "var(--mosaic-color-status-success)",
                fontWeight: 600,
                fontSize: "0.9375rem",
                marginBottom: "var(--mosaic-space-4)",
              }}
            >
              <CheckCircle2 size={18} />
              <span>Upload complete!</span>
            </div>
          )}

          <Button
            type="button"
            variant="primary"
            size="lg"
            disabled={!selectedFile || isUploading}
            isLoading={isUploading}
            onClick={handleUpload}
            style={{ width: "100%" }}
          >
            Upload to Space
          </Button>
        </div>
      </div>
    </div>
  );
};
