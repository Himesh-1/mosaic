"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Plus,
  QrCode,
  ArrowRight,
  ShieldCheck,
  Zap,
  Layers,
  Users,
  Calendar,
  Compass,
  Briefcase,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { Header } from "../components/Header";
import { AuthModal } from "../components/AuthModal";
import { CreateSpaceModal } from "../components/CreateSpaceModal";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { StatusChip } from "../components/StatusChip";
import { api } from "../lib/api";

export default function HomePage() {
  const { user } = useAuth();
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // 1. Live health query
  const { data: healthData, isError: isHealthError } = useQuery({
    queryKey: ["health"],
    queryFn: api.getHealth,
    refetchInterval: 15000,
  });

  // 2. Fetch User's Spaces when authenticated
  const { data: spaces, isLoading: isSpacesLoading } = useQuery({
    queryKey: ["my-spaces"],
    queryFn: api.getMySpaces,
    enabled: !!user,
    refetchInterval: 10000,
  });

  const handleCreateClick = () => {
    if (!user) {
      setIsAuthOpen(true);
    } else {
      setIsCreateOpen(true);
    }
  };

  const handleJoinClick = () => {
    const raw = prompt("Paste your Mosaic invite link or invite token:");
    if (raw) {
      const trimmed = raw.trim();
      const token = trimmed.includes("/join/")
        ? trimmed.split("/join/")[1]
        : trimmed;
      if (token) {
        window.location.href = `/join/${token}`;
      }
    }
  };

  const activeSpaces = spaces?.filter((s) => s.status === "active") || [];
  const completedSpaces = spaces?.filter((s) => s.status === "completed") || [];

  return (
    <div
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
    >
      <Header onOpenAuth={() => setIsAuthOpen(true)} />

      <main style={{ flex: 1, padding: "var(--mosaic-space-8) 0" }}>
        <div className="container">
          {/* Hero Section */}
          <section
            style={{
              textAlign: "center",
              maxWidth: "760px",
              margin: "0 auto var(--mosaic-space-10) auto",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 14px",
                borderRadius: "var(--mosaic-radius-full)",
                backgroundColor: "var(--mosaic-color-brand-subtle)",
                color: "var(--mosaic-color-brand-strong)",
                fontSize: "0.875rem",
                fontWeight: 600,
                marginBottom: "var(--mosaic-space-4)",
              }}
            >
              <Sparkles size={16} />
              <span>Temporary digital worlds for real-world groups</span>
            </div>

            <h1
              style={{
                fontSize: "clamp(2rem, 5vw, 3.25rem)",
                fontWeight: 800,
                lineHeight: 1.15,
                letterSpacing: "-0.02em",
                color: "var(--mosaic-color-text-primary)",
                marginBottom: "var(--mosaic-space-4)",
              }}
            >
              A shared place for what you’re doing together.
            </h1>

            <p
              style={{
                fontSize: "1.125rem",
                color: "var(--mosaic-color-text-secondary)",
                lineHeight: 1.6,
                marginBottom: "var(--mosaic-space-6)",
              }}
            >
              Create a private Space for a trip, event, hackathon, or gathering.
              Devices cooperate directly to chat, share media, make decisions,
              and preserve the experience.
            </p>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "center",
                gap: "var(--mosaic-space-3)",
              }}
            >
              <Button variant="primary" size="lg" onClick={handleCreateClick}>
                <Plus size={18} />
                <span>Create a Space</span>
              </Button>
              <Button variant="secondary" size="lg" onClick={handleJoinClick}>
                <QrCode size={18} />
                <span>Join with QR / link</span>
              </Button>
            </div>
          </section>

          {/* User Spaces Section */}
          <section
            style={{
              maxWidth: "900px",
              margin: "0 auto var(--mosaic-space-12) auto",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "var(--mosaic-space-4)",
              }}
            >
              <h2 style={{ fontSize: "1.375rem", fontWeight: 700 }}>
                {user ? `Your Spaces` : "Spaces"}
              </h2>
              {healthData && (
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <StatusChip
                    status={isHealthError ? "error" : "connected"}
                    label={
                      isHealthError
                        ? "API Offline"
                        : `API v${healthData.version} (${healthData.environment})`
                    }
                  />
                </div>
              )}
            </div>

            {user && spaces && spaces.length > 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--mosaic-space-6)",
                }}
              >
                {/* Active Spaces Grid */}
                {activeSpaces.length > 0 && (
                  <div>
                    <h3
                      style={{
                        fontSize: "0.9375rem",
                        fontWeight: 700,
                        color: "var(--mosaic-color-text-secondary)",
                        marginBottom: "var(--mosaic-space-3)",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      Active Spaces ({activeSpaces.length})
                    </h3>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(280px, 1fr))",
                        gap: "var(--mosaic-space-4)",
                      }}
                    >
                      {activeSpaces.map((s) => (
                        <Link
                          key={s.id}
                          href={`/spaces/${s.id}`}
                          style={{ textDecoration: "none", color: "inherit" }}
                        >
                          <Card
                            padding="md"
                            style={{
                              borderTop: `4px solid ${s.cover_color || "var(--mosaic-color-brand-primary)"}`,
                              transition:
                                "transform 0.15s ease, box-shadow 0.15s ease",
                              cursor: "pointer",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                marginBottom: "8px",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  padding: "2px 8px",
                                  borderRadius: "var(--mosaic-radius-full)",
                                  backgroundColor:
                                    "var(--mosaic-color-brand-subtle)",
                                  color: "var(--mosaic-color-brand-strong)",
                                  fontWeight: 700,
                                  textTransform: "capitalize",
                                }}
                              >
                                {s.template}
                              </span>
                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                  color: "var(--mosaic-color-text-secondary)",
                                  textTransform: "capitalize",
                                }}
                              >
                                {s.current_role}
                              </span>
                            </div>
                            <h4
                              style={{
                                fontSize: "1.125rem",
                                fontWeight: 700,
                                marginBottom: "6px",
                                color: "var(--mosaic-color-text-primary)",
                              }}
                            >
                              {s.title}
                            </h4>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                fontSize: "0.8125rem",
                                color: "var(--mosaic-color-text-secondary)",
                                marginTop: "var(--mosaic-space-3)",
                              }}
                            >
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                              >
                                <Users size={14} />
                                <span>
                                  {s.member_count}{" "}
                                  {s.member_count === 1 ? "member" : "members"}
                                </span>
                              </span>
                              <ArrowRight
                                size={16}
                                color="var(--mosaic-color-brand-primary)"
                              />
                            </div>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Completed Spaces */}
                {completedSpaces.length > 0 && (
                  <div>
                    <h3
                      style={{
                        fontSize: "0.9375rem",
                        fontWeight: 700,
                        color: "var(--mosaic-color-text-secondary)",
                        marginBottom: "var(--mosaic-space-3)",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      Completed Spaces ({completedSpaces.length})
                    </h3>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(280px, 1fr))",
                        gap: "var(--mosaic-space-4)",
                      }}
                    >
                      {completedSpaces.map((s) => (
                        <Link
                          key={s.id}
                          href={`/spaces/${s.id}`}
                          style={{ textDecoration: "none", color: "inherit" }}
                        >
                          <Card padding="md" style={{ opacity: 0.85 }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                marginBottom: "8px",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  padding: "2px 8px",
                                  borderRadius: "var(--mosaic-radius-full)",
                                  backgroundColor:
                                    "var(--mosaic-color-surface-subtle)",
                                  color: "var(--mosaic-color-text-secondary)",
                                  fontWeight: 600,
                                }}
                              >
                                Completed
                              </span>
                            </div>
                            <h4
                              style={{
                                fontSize: "1.125rem",
                                fontWeight: 700,
                                marginBottom: "6px",
                              }}
                            >
                              {s.title}
                            </h4>
                            <div
                              style={{
                                fontSize: "0.8125rem",
                                color: "var(--mosaic-color-text-secondary)",
                              }}
                            >
                              {s.member_count} members
                            </div>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Card
                padding="lg"
                style={{
                  textAlign: "center",
                  padding: "var(--mosaic-space-10) var(--mosaic-space-6)",
                }}
              >
                <div
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "var(--mosaic-radius-full)",
                    backgroundColor: "var(--mosaic-color-surface-subtle)",
                    color: "var(--mosaic-color-brand-primary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto var(--mosaic-space-4) auto",
                  }}
                >
                  <Layers size={28} />
                </div>
                <h3
                  style={{
                    fontSize: "1.125rem",
                    fontWeight: 700,
                    marginBottom: "var(--mosaic-space-2)",
                  }}
                >
                  No Spaces yet
                </h3>
                <p
                  style={{
                    color: "var(--mosaic-color-text-secondary)",
                    maxWidth: "460px",
                    margin: "0 auto var(--mosaic-space-6) auto",
                    lineHeight: 1.5,
                  }}
                >
                  Create one for a trip, event, or a group working together.
                  Spaces are temporary by default and leave a meaningful memory
                  afterward.
                </p>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: "12px",
                    flexWrap: "wrap",
                  }}
                >
                  <Button variant="primary" onClick={handleCreateClick}>
                    Create your first Space
                  </Button>
                  <Button variant="secondary" onClick={handleJoinClick}>
                    Join with an invite
                  </Button>
                </div>
              </Card>
            )}
          </section>

          {/* Value Pillars */}
          <section
            style={{
              maxWidth: "1000px",
              margin: "0 auto",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "var(--mosaic-space-5)",
            }}
          >
            <Card padding="md">
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "var(--mosaic-radius-sm)",
                  backgroundColor: "var(--mosaic-color-brand-subtle)",
                  color: "var(--mosaic-color-brand-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "var(--mosaic-space-3)",
                }}
              >
                <ShieldCheck size={22} />
              </div>
              <h3
                style={{
                  fontSize: "1.0625rem",
                  fontWeight: 700,
                  marginBottom: "var(--mosaic-space-2)",
                }}
              >
                Private & Temporary
              </h3>
              <p
                style={{
                  color: "var(--mosaic-color-text-secondary)",
                  fontSize: "0.9375rem",
                }}
              >
                No public feeds, algorithmic discovery, or followers. A Space
                exists for the life of an experience and turns into an
                exportable memory.
              </p>
            </Card>

            <Card padding="md">
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "var(--mosaic-radius-sm)",
                  backgroundColor: "var(--mosaic-color-status-warning-subtle)",
                  color: "var(--mosaic-color-status-warning)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "var(--mosaic-space-3)",
                }}
              >
                <Zap size={22} />
              </div>
              <h3
                style={{
                  fontSize: "1.0625rem",
                  fontWeight: 700,
                  marginBottom: "var(--mosaic-space-2)",
                }}
              >
                Device-Cooperative P2P
              </h3>
              <p
                style={{
                  color: "var(--mosaic-color-text-secondary)",
                  fontSize: "0.9375rem",
                }}
              >
                Direct browser-to-browser WebRTC DataChannel sharing with
                integrity checks, truthful progress, and reliable cloud
                fallback.
              </p>
            </Card>

            <Card padding="md">
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "var(--mosaic-radius-sm)",
                  backgroundColor: "var(--mosaic-color-status-info-subtle)",
                  color: "var(--mosaic-color-status-info)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "var(--mosaic-space-3)",
                }}
              >
                <Users size={22} />
              </div>
              <h3
                style={{
                  fontSize: "1.0625rem",
                  fontWeight: 700,
                  marginBottom: "var(--mosaic-space-2)",
                }}
              >
                Group-First Collaboration
              </h3>
              <p
                style={{
                  color: "var(--mosaic-color-text-secondary)",
                  fontSize: "0.9375rem",
                }}
              >
                Chronological shared activity timeline, real-time presence,
                media gallery, polls, and checklists designed for 2–15
                participants.
              </p>
            </Card>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid var(--mosaic-color-border-subtle)",
          backgroundColor: "var(--mosaic-color-surface-base)",
          padding: "var(--mosaic-space-6) 0",
        }}
      >
        <div
          className="container"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            fontSize: "0.875rem",
            color: "var(--mosaic-color-text-muted)",
          }}
        >
          <div>Mosaic © 2026 — Web-First Cooperative Spaces</div>
          <div>
            Built with Next.js, FastAPI, PostgreSQL, Redis, MinIO & WebRTC
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      <CreateSpaceModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />
    </div>
  );
}
