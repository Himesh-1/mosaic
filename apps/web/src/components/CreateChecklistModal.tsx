"use client";

import React, { useState } from "react";
import { X, CheckSquare, Plus, Trash2 } from "lucide-react";
import { Button } from "./Button";
import { api } from "../lib/api";

interface CreateChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
  onChecklistCreated?: () => void;
}

export const CreateChecklistModal: React.FC<CreateChecklistModalProps> = ({
  isOpen,
  onClose,
  spaceId,
  onChecklistCreated,
}) => {
  const [title, setTitle] = useState("");
  const [items, setItems] = useState<string[]>(["", ""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddItem = () => {
    if (items.length < 50) {
      setItems([...items, ""]);
    }
  };

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleItemChange = (index: number, val: string) => {
    const updated = [...items];
    updated[index] = val;
    setItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = items
      .map((it) => it.trim())
      .filter((it) => it.length > 0);

    if (!title.trim()) {
      setError("Please enter a checklist title.");
      return;
    }
    if (validItems.length < 1) {
      setError("Please provide at least 1 item.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const clientMutationId = `chk-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      await api.createChecklist(spaceId, {
        title: title.trim(),
        items: validItems,
        client_mutation_id: clientMutationId,
      });

      setTitle("");
      setItems(["", ""]);
      onClose();
      if (onChecklistCreated) onChecklistCreated();
    } catch (err: any) {
      setError(err.message || "Failed to create checklist.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-checklist-title"
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
            <CheckSquare size={20} color="var(--mosaic-color-brand-primary)" />
            <h2
              id="create-checklist-title"
              style={{ fontSize: "1.125rem", fontWeight: 700 }}
            >
              Create a Checklist
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
              }}
            >
              {error}
            </div>
          )}

          {/* Title */}
          <div style={{ marginBottom: "var(--mosaic-space-5)" }}>
            <label
              htmlFor="checklist-title"
              style={{
                display: "block",
                fontSize: "0.875rem",
                fontWeight: 600,
                marginBottom: "6px",
                color: "var(--mosaic-color-text-secondary)",
              }}
            >
              Checklist Title
            </label>
            <input
              id="checklist-title"
              type="text"
              required
              placeholder="e.g. Packing List, Food & Snacks, Setup Tasks"
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

          {/* Items */}
          <div style={{ marginBottom: "var(--mosaic-space-6)" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.875rem",
                fontWeight: 600,
                marginBottom: "6px",
                color: "var(--mosaic-color-text-secondary)",
              }}
            >
              Items
            </label>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              {items.map((it, i) => (
                <div
                  key={i}
                  style={{ display: "flex", gap: "8px", alignItems: "center" }}
                >
                  <input
                    type="text"
                    required
                    placeholder={`Item ${i + 1}`}
                    value={it}
                    onChange={(e) => handleItemChange(i, e.target.value)}
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      borderRadius: "var(--mosaic-radius-md)",
                      border: "1px solid var(--mosaic-color-border-subtle)",
                      backgroundColor: "var(--mosaic-color-surface-base)",
                      fontSize: "0.9375rem",
                    }}
                  />
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(i)}
                      title="Remove item"
                      style={{
                        color: "var(--mosaic-color-status-danger)",
                        padding: "4px",
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {items.length < 50 && (
              <button
                type="button"
                onClick={handleAddItem}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  color: "var(--mosaic-color-brand-primary)",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  marginTop: "8px",
                  cursor: "pointer",
                }}
              >
                <Plus size={16} />
                <span>Add Item</span>
              </button>
            )}
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isSubmitting}
            style={{ width: "100%" }}
          >
            Create Checklist
          </Button>
        </form>
      </div>
    </div>
  );
};
