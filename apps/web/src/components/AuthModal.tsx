"use client";

import React, { useState } from "react";
import {
  X,
  Sparkles,
  User as UserIcon,
  Lock,
  Mail,
  Smartphone,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Button } from "./Button";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabMode = "login" | "register" | "guest";

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { login, register, guestLogin } = useAuth();
  const [tab, setTab] = useState<TabMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [deviceLabel, setDeviceLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (tab === "login") {
        await login({
          email,
          password,
          device_label: deviceLabel || undefined,
        });
      } else if (tab === "register") {
        if (password.length < 8) {
          setError("Password must be at least 8 characters long.");
          setIsSubmitting(false);
          return;
        }
        await register({
          email,
          password,
          display_name: displayName,
          device_label: deviceLabel || undefined,
        });
      } else if (tab === "guest") {
        await guestLogin({
          display_name: displayName,
          device_label: deviceLabel || undefined,
        });
      }
      onClose();
    } catch (err: any) {
      setError(err.message || "An error occurred during authentication.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
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
        {/* Modal Header */}
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
              id="auth-modal-title"
              style={{ fontSize: "1.125rem", fontWeight: 700 }}
            >
              {tab === "login"
                ? "Welcome back"
                : tab === "register"
                  ? "Create an account"
                  : "Join as Guest"}
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

        {/* Tab Selector */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid var(--mosaic-color-border-subtle)",
            backgroundColor: "var(--mosaic-color-surface-subtle)",
          }}
        >
          {(["login", "register", "guest"] as TabMode[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setError(null);
              }}
              style={{
                flex: 1,
                padding: "12px 8px",
                fontSize: "0.875rem",
                fontWeight: tab === t ? 700 : 500,
                color:
                  tab === t
                    ? "var(--mosaic-color-brand-primary)"
                    : "var(--mosaic-color-text-secondary)",
                borderBottom:
                  tab === t
                    ? "2px solid var(--mosaic-color-brand-primary)"
                    : "none",
                backgroundColor:
                  tab === t
                    ? "var(--mosaic-color-surface-base)"
                    : "transparent",
              }}
            >
              {t === "login"
                ? "Sign in"
                : t === "register"
                  ? "Register"
                  : "Guest"}
            </button>
          ))}
        </div>

        {/* Form Body */}
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

          {/* Display Name (for Register & Guest) */}
          {tab !== "login" && (
            <div style={{ marginBottom: "var(--mosaic-space-4)" }}>
              <label
                htmlFor="auth-display-name"
                style={{
                  display: "block",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  marginBottom: "6px",
                  color: "var(--mosaic-color-text-secondary)",
                }}
              >
                Display Name
              </label>
              <div style={{ position: "relative" }}>
                <UserIcon
                  size={18}
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--mosaic-color-text-muted)",
                  }}
                />
                <input
                  id="auth-display-name"
                  type="text"
                  required
                  placeholder="e.g. Asha Kumar"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px 10px 38px",
                    borderRadius: "var(--mosaic-radius-md)",
                    border: "1px solid var(--mosaic-color-border-subtle)",
                    backgroundColor: "var(--mosaic-color-surface-base)",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>
          )}

          {/* Email & Password (for Login & Register) */}
          {tab !== "guest" && (
            <>
              <div style={{ marginBottom: "var(--mosaic-space-4)" }}>
                <label
                  htmlFor="auth-email"
                  style={{
                    display: "block",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    marginBottom: "6px",
                    color: "var(--mosaic-color-text-secondary)",
                  }}
                >
                  Email Address
                </label>
                <div style={{ position: "relative" }}>
                  <Mail
                    size={18}
                    style={{
                      position: "absolute",
                      left: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "var(--mosaic-color-text-muted)",
                    }}
                  />
                  <input
                    id="auth-email"
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px 10px 38px",
                      borderRadius: "var(--mosaic-radius-md)",
                      border: "1px solid var(--mosaic-color-border-subtle)",
                      backgroundColor: "var(--mosaic-color-surface-base)",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "var(--mosaic-space-4)" }}>
                <label
                  htmlFor="auth-password"
                  style={{
                    display: "block",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    marginBottom: "6px",
                    color: "var(--mosaic-color-text-secondary)",
                  }}
                >
                  Password
                </label>
                <div style={{ position: "relative" }}>
                  <Lock
                    size={18}
                    style={{
                      position: "absolute",
                      left: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "var(--mosaic-color-text-muted)",
                    }}
                  />
                  <input
                    id="auth-password"
                    type="password"
                    required
                    minLength={tab === "register" ? 8 : undefined}
                    placeholder={tab === "register" ? "At least 8 characters" : "Your password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px 10px 38px",
                      borderRadius: "var(--mosaic-radius-md)",
                      border: "1px solid var(--mosaic-color-border-subtle)",
                      backgroundColor: "var(--mosaic-color-surface-base)",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>
            </>
          )}

          {/* Optional Device Label */}
          <div style={{ marginBottom: "var(--mosaic-space-6)" }}>
            <label
              htmlFor="auth-device-label"
              style={{
                display: "block",
                fontSize: "0.875rem",
                fontWeight: 600,
                marginBottom: "6px",
                color: "var(--mosaic-color-text-secondary)",
              }}
            >
              Device Label (Optional)
            </label>
            <div style={{ position: "relative" }}>
              <Smartphone
                size={18}
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--mosaic-color-text-muted)",
                }}
              />
              <input
                id="auth-device-label"
                type="text"
                placeholder="e.g. My Phone, Work Laptop"
                value={deviceLabel}
                onChange={(e) => setDeviceLabel(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px 10px 38px",
                  borderRadius: "var(--mosaic-radius-md)",
                  border: "1px solid var(--mosaic-color-border-subtle)",
                  backgroundColor: "var(--mosaic-color-surface-base)",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isSubmitting}
            style={{ width: "100%" }}
          >
            {tab === "login"
              ? "Sign In"
              : tab === "register"
                ? "Create Account"
                : "Continue to Mosaic"}
          </Button>
        </form>
      </div>
    </div>
  );
};
