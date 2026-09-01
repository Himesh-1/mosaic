"use client";

import React, { useState } from "react";
import { X, Vote, Plus, Trash2 } from "lucide-react";
import { Button } from "./Button";
import { api } from "../lib/api";

interface CreatePollModalProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
  onPollCreated?: () => void;
}

export const CreatePollModal: React.FC<CreatePollModalProps> = ({
  isOpen,
  onClose,
  spaceId,
  onPollCreated,
}) => {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddOption = () => {
    if (options.length < 10) {
      setOptions([...options, ""]);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (index: number, val: string) => {
    const updated = [...options];
    updated[index] = val;
    setOptions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validOptions = options
      .map((o) => o.trim())
      .filter((o) => o.length > 0);

    if (!question.trim()) {
      setError("Please enter a question.");
      return;
    }
    if (validOptions.length < 2) {
      setError("Please provide at least 2 options.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const clientMutationId = `poll-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      await api.createPoll(spaceId, {
        question: question.trim(),
        options: validOptions,
        allow_multiple: allowMultiple,
        client_mutation_id: clientMutationId,
      });

      setQuestion("");
      setOptions(["", ""]);
      setAllowMultiple(false);
      onClose();
      if (onPollCreated) onPollCreated();
    } catch (err: any) {
      setError(err.message || "Failed to create poll.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-poll-title"
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
            <Vote size={20} color="var(--mosaic-color-brand-primary)" />
            <h2
              id="create-poll-title"
              style={{ fontSize: "1.125rem", fontWeight: 700 }}
            >
              Create a Poll
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

          {/* Question */}
          <div style={{ marginBottom: "var(--mosaic-space-5)" }}>
            <label
              htmlFor="poll-question"
              style={{
                display: "block",
                fontSize: "0.875rem",
                fontWeight: 600,
                marginBottom: "6px",
                color: "var(--mosaic-color-text-secondary)",
              }}
            >
              Question
            </label>
            <input
              id="poll-question"
              type="text"
              required
              placeholder="e.g. Which cafe should we meet at?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
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

          {/* Options */}
          <div style={{ marginBottom: "var(--mosaic-space-5)" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.875rem",
                fontWeight: 600,
                marginBottom: "6px",
                color: "var(--mosaic-color-text-secondary)",
              }}
            >
              Options
            </label>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              {options.map((opt, i) => (
                <div
                  key={i}
                  style={{ display: "flex", gap: "8px", alignItems: "center" }}
                >
                  <input
                    type="text"
                    required
                    placeholder={`Option ${i + 1}`}
                    value={opt}
                    onChange={(e) => handleOptionChange(i, e.target.value)}
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      borderRadius: "var(--mosaic-radius-md)",
                      border: "1px solid var(--mosaic-color-border-subtle)",
                      backgroundColor: "var(--mosaic-color-surface-base)",
                      fontSize: "0.9375rem",
                    }}
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(i)}
                      title="Remove option"
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
            {options.length < 10 && (
              <button
                type="button"
                onClick={handleAddOption}
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
                <span>Add Option</span>
              </button>
            )}
          </div>

          {/* Multiple choice toggle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "var(--mosaic-space-6)",
            }}
          >
            <input
              id="allow-multiple"
              type="checkbox"
              checked={allowMultiple}
              onChange={(e) => setAllowMultiple(e.target.checked)}
              style={{ cursor: "pointer" }}
            />
            <label
              htmlFor="allow-multiple"
              style={{
                fontSize: "0.875rem",
                color: "var(--mosaic-color-text-secondary)",
                cursor: "pointer",
              }}
            >
              Allow participants to select multiple options
            </label>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isSubmitting}
            style={{ width: "100%" }}
          >
            Create Poll
          </Button>
        </form>
      </div>
    </div>
  );
};
