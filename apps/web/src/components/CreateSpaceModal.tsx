"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Sparkles,
  Compass,
  Calendar,
  Users,
  Briefcase,
  Plus,
} from "lucide-react";
import { api } from "../lib/api";
import { Button } from "./Button";

interface CreateSpaceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TEMPLATES = [
  { id: "trip", label: "Trip", icon: Compass, color: "#246A5A" },
  { id: "event", label: "Event", icon: Calendar, color: "#7667B4" },
  { id: "team", label: "Team", icon: Briefcase, color: "#3167A7" },
  { id: "gathering", label: "Gathering", icon: Users, color: "#9A6500" },
  { id: "custom", label: "Custom", icon: Plus, color: "#246A5A" },
];

export const CreateSpaceModal: React.FC<CreateSpaceModalProps> = ({
  isOpen,
  onClose,
}) => {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [template, setTemplate] = useState("gathering");
  const [description, setDescription] = useState("");
  const [coverColor, setCoverColor] = useState("#246A5A");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const space = await api.createSpace({
        title: title.trim(),
        template,
        description: description.trim() || undefined,
        cover_color: coverColor,
      });
      onClose();
      router.push(`/spaces/${space.id}?justCreated=true`);
    } catch (err: any) {
      setError(err.message || "Failed to create Space. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-space-modal-title"
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
          maxWidth: "500px",
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
            <Sparkles size={20} color="var(--mosaic-color-brand-primary)" />
            <h2
              id="create-space-modal-title"
              style={{ fontSize: "1.125rem", fontWeight: 700 }}
            >
              Create a Space
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

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          style={{ padding: "var(--mosaic-space-6)" }}
        >
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
                fontWeight: 500,
              }}
            >
              {error}
            </div>
          )}

          {/* Space Name */}
          <div style={{ marginBottom: "var(--mosaic-space-5)" }}>
            <label
              htmlFor="space-title"
              style={{
                display: "block",
                fontSize: "0.875rem",
                fontWeight: 600,
                marginBottom: "6px",
                color: "var(--mosaic-color-text-secondary)",
              }}
            >
              Space Name
            </label>
            <input
              id="space-title"
              type="text"
              required
              placeholder="e.g. Mount Abu Trip, Hackathon 2026, Birthday"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "var(--mosaic-radius-md)",
                border: "1px solid var(--mosaic-color-border-subtle)",
                backgroundColor: "var(--mosaic-color-surface-base)",
                fontSize: "1rem",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Template Selection */}
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
              Purpose / Template
            </label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))",
                gap: "8px",
              }}
            >
              {TEMPLATES.map((t) => {
                const Icon = t.icon;
                const isSelected = template === t.id;
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => {
                      setTemplate(t.id);
                      setCoverColor(t.color);
                    }}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "6px",
                      padding: "10px 8px",
                      borderRadius: "var(--mosaic-radius-md)",
                      border: isSelected
                        ? "2px solid var(--mosaic-color-brand-primary)"
                        : "1px solid var(--mosaic-color-border-subtle)",
                      backgroundColor: isSelected
                        ? "var(--mosaic-color-brand-subtle)"
                        : "var(--mosaic-color-surface-base)",
                      color: isSelected
                        ? "var(--mosaic-color-brand-strong)"
                        : "var(--mosaic-color-text-secondary)",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <Icon size={20} />
                    <span
                      style={{
                        fontSize: "0.8125rem",
                        fontWeight: isSelected ? 700 : 500,
                      }}
                    >
                      {t.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description (Optional) */}
          <div style={{ marginBottom: "var(--mosaic-space-6)" }}>
            <label
              htmlFor="space-description"
              style={{
                display: "block",
                fontSize: "0.875rem",
                fontWeight: 600,
                marginBottom: "6px",
                color: "var(--mosaic-color-text-secondary)",
              }}
            >
              Description (Optional)
            </label>
            <textarea
              id="space-description"
              rows={2}
              placeholder="What are we doing together?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "var(--mosaic-radius-md)",
                border: "1px solid var(--mosaic-color-border-subtle)",
                backgroundColor: "var(--mosaic-color-surface-base)",
                fontSize: "0.9375rem",
                boxSizing: "border-box",
                resize: "none",
              }}
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isSubmitting}
            style={{ width: "100%" }}
          >
            Create Space
          </Button>
        </form>
      </div>
    </div>
  );
};
