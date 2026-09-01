"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Sparkles,
  Users,
  User,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../context/AuthContext";
import { api } from "../../../lib/api";
import { Button } from "../../../components/Button";
import { Card } from "../../../components/Card";
import { Avatar } from "../../../components/Avatar";

export default function JoinSpacePage() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token as string;
  const { user, refresh } = useAuth();

  const [displayName, setDisplayName] = useState(user?.display_name || "");
  const [deviceLabel, setDeviceLabel] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Fetch Invite Preview
  const {
    data: preview,
    isLoading,
    error: previewError,
  } = useQuery({
    queryKey: ["invite-preview", token],
    queryFn: () => api.previewInvite(token),
    enabled: !!token,
    retry: 1,
  });

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsJoining(true);

    try {
      const space = await api.joinSpace(token, {
        display_name: !user ? displayName.trim() : undefined,
        device_label: deviceLabel.trim() || undefined,
      });

      // Refresh auth state to ensure guest session is loaded if created
      await refresh();
      router.push(`/spaces/${space.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to join Space.");
    } finally {
      setIsJoining(false);
    }
  };

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--mosaic-color-text-secondary)",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <Sparkles
            size={32}
            color="var(--mosaic-color-brand-primary)"
            style={{
              animation: "spin 2s linear infinite",
              marginBottom: "12px",
            }}
          />
          <div>Loading invitation...</div>
        </div>
      </div>
    );
  }

  if (previewError || !preview) {
    return (
      <div
        className="container"
        style={{ maxWidth: "480px", margin: "var(--mosaic-space-10) auto" }}
      >
        <Card padding="lg" style={{ textAlign: "center" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              backgroundColor: "var(--mosaic-color-status-danger-subtle)",
              color: "var(--mosaic-color-status-danger)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto var(--mosaic-space-4) auto",
            }}
          >
            <AlertCircle size={24} />
          </div>
          <h2
            style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              marginBottom: "8px",
            }}
          >
            Invalid or Expired Invite
          </h2>
          <p
            style={{
              color: "var(--mosaic-color-text-secondary)",
              marginBottom: "var(--mosaic-space-6)",
            }}
          >
            This invite link is invalid, expired, or was revoked by the host.
            Please ask the host for a new link.
          </p>
          <Button variant="secondary" onClick={() => router.push("/")}>
            <ArrowLeft size={16} />
            <span>Go to Mosaic Home</span>
          </Button>
        </Card>
      </div>
    );
  }

  if (!preview.is_valid) {
    const getReasonText = () => {
      switch (preview.status_reason) {
        case "expired":
          return "This invite has expired. Ask the host for a new link.";
        case "revoked":
          return "This invite is no longer active. Ask the host for a new link.";
        case "max_uses_reached":
          return "This Space has reached its maximum invite limit. Ask the host for a new link.";
        default:
          return "This invite is no longer valid. Ask the host for a new link.";
      }
    };

    return (
      <div
        className="container"
        style={{ maxWidth: "480px", margin: "var(--mosaic-space-10) auto" }}
      >
        <Card padding="lg" style={{ textAlign: "center" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              backgroundColor: "var(--mosaic-color-status-warning-subtle)",
              color: "var(--mosaic-color-status-warning)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto var(--mosaic-space-4) auto",
            }}
          >
            <AlertCircle size={24} />
          </div>
          <h2
            style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              marginBottom: "8px",
            }}
          >
            Invite Unavailable
          </h2>
          <p
            style={{
              color: "var(--mosaic-color-text-secondary)",
              marginBottom: "var(--mosaic-space-6)",
            }}
          >
            {getReasonText()}
          </p>
          <Button variant="secondary" onClick={() => router.push("/")}>
            <ArrowLeft size={16} />
            <span>Go to Mosaic Home</span>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "var(--mosaic-space-6) 0",
      }}
    >
      <div className="container" style={{ maxWidth: "460px" }}>
        {/* Brand */}
        <div
          style={{ textAlign: "center", marginBottom: "var(--mosaic-space-6)" }}
        >
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              color: "var(--mosaic-color-text-primary)",
              fontWeight: 700,
              fontSize: "1.25rem",
              textDecoration: "none",
            }}
          >
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "var(--mosaic-radius-sm)",
                backgroundColor: "var(--mosaic-color-brand-primary)",
                color: "#FFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Sparkles size={16} />
            </div>
            <span>Mosaic</span>
          </Link>
        </div>

        {/* Space Preview Card */}
        <Card padding="lg" style={{ boxShadow: "var(--mosaic-shadow-lg)" }}>
          <div
            style={{
              textAlign: "center",
              marginBottom: "var(--mosaic-space-6)",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 10px",
                borderRadius: "var(--mosaic-radius-full)",
                backgroundColor: "var(--mosaic-color-brand-subtle)",
                color: "var(--mosaic-color-brand-strong)",
                fontSize: "0.75rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: "var(--mosaic-space-3)",
              }}
            >
              <span>{preview.space_template}</span>
            </div>
            <h1
              style={{
                fontSize: "1.5rem",
                fontWeight: 800,
                color: "var(--mosaic-color-text-primary)",
                marginBottom: "6px",
              }}
            >
              {preview.space_title}
            </h1>
            <p
              style={{
                color: "var(--mosaic-color-text-secondary)",
                fontSize: "0.9375rem",
              }}
            >
              Hosted by{" "}
              <strong style={{ color: "var(--mosaic-color-text-primary)" }}>
                {preview.host_display_name}
              </strong>{" "}
              · {preview.member_count}{" "}
              {preview.member_count === 1 ? "member" : "members"}
            </p>
            {preview.description && (
              <p
                style={{
                  color: "var(--mosaic-color-text-secondary)",
                  fontSize: "0.875rem",
                  marginTop: "var(--mosaic-space-2)",
                  fontStyle: "italic",
                }}
              >
                “{preview.description}”
              </p>
            )}
          </div>

          {/* Join Form */}
          <form onSubmit={handleJoin}>
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

            {user ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 14px",
                  backgroundColor: "var(--mosaic-color-surface-subtle)",
                  borderRadius: "var(--mosaic-radius-md)",
                  marginBottom: "var(--mosaic-space-5)",
                }}
              >
                <Avatar name={user.display_name} size="md" />
                <div>
                  <div
                    style={{
                      fontSize: "0.8125rem",
                      color: "var(--mosaic-color-text-secondary)",
                    }}
                  >
                    Joining as
                  </div>
                  <div style={{ fontWeight: 700, fontSize: "0.9375rem" }}>
                    {user.display_name}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: "var(--mosaic-space-5)" }}>
                <label
                  htmlFor="join-display-name"
                  style={{
                    display: "block",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    marginBottom: "6px",
                    color: "var(--mosaic-color-text-secondary)",
                  }}
                >
                  Your Name
                </label>
                <div style={{ position: "relative" }}>
                  <User
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
                    id="join-display-name"
                    type="text"
                    required
                    placeholder="Enter your name to join"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px 10px 38px",
                      borderRadius: "var(--mosaic-radius-md)",
                      border: "1px solid var(--mosaic-color-border-subtle)",
                      backgroundColor: "var(--mosaic-color-surface-base)",
                      fontSize: "1rem",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isJoining}
              style={{ width: "100%", marginBottom: "var(--mosaic-space-4)" }}
            >
              <span>Join Space</span>
              <ArrowRight size={18} />
            </Button>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                fontSize: "0.75rem",
                color: "var(--mosaic-color-text-muted)",
              }}
            >
              <ShieldCheck size={14} />
              <span>Private temporary space. No app download needed.</span>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
