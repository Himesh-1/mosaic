"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Share2,
  Users,
  MessageSquare,
  Image as ImageIcon,
  CheckCircle2,
  Sparkles,
  QrCode,
  UserX,
  Clock,
  Shield,
  Activity,
  Plus,
  Send,
  Vote,
  CheckSquare,
  Square,
  UploadCloud,
  File,
  ExternalLink,
  Wifi,
  Lock,
  Download,
  Settings,
  RefreshCw,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../../context/AuthContext";
import { api } from "../../../lib/api";
import { useSpaceRealtime } from "../../../hooks/useSpaceRealtime";
import { Button } from "../../../components/Button";
import { Card } from "../../../components/Card";
import { Avatar } from "../../../components/Avatar";
import { StatusChip } from "../../../components/StatusChip";
import { InviteModal } from "../../../components/InviteModal";
import { CreatePollModal } from "../../../components/CreatePollModal";
import { CreateChecklistModal } from "../../../components/CreateChecklistModal";
import { UploadModal } from "../../../components/UploadModal";
import { MediaLightbox } from "../../../components/MediaLightbox";
import { DirectTransferModal } from "../../../components/DirectTransferModal";
import { IncomingTransferModal } from "../../../components/IncomingTransferModal";
import { SpaceSummaryModal } from "../../../components/SpaceSummaryModal";
import { CompleteSpaceModal } from "../../../components/CompleteSpaceModal";
import { DiagnosticsModal } from "../../../components/DiagnosticsModal";
import {
  ArtifactResponse,
  AssetResponse,
  DirectTransferResponse,
} from "@mosaic/contracts";
import {
  WebRTCTransferSender,
  WebRTCTransferReceiver,
  TransferProgress,
} from "../../../lib/webrtc";

type TabId = "home" | "chat" | "gallery" | "organize" | "people";

export default function SpaceDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const spaceId = params?.id as string;
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isPollModalOpen, setIsPollModalOpen] = useState(false);
  const [isChecklistModalOpen, setIsChecklistModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isDirectTransferOpen, setIsDirectTransferOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [selectedAssetForPreview, setSelectedAssetForPreview] =
    useState<AssetResponse | null>(null);

  // WebRTC Incoming & Outgoing Transfer state
  const [incomingTransfer, setIncomingTransfer] =
    useState<DirectTransferResponse | null>(null);
  const [incomingProgress, setIncomingProgress] =
    useState<TransferProgress | null>(null);
  const [receivedBlobUrl, setReceivedBlobUrl] = useState<string | null>(null);
  const activeSenderRef = useRef<WebRTCTransferSender | null>(null);
  const activeReceiverRef = useRef<WebRTCTransferReceiver | null>(null);

  // Chat message input
  const [messageInput, setMessageInput] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Check if just created to auto-open invite sheet
  useEffect(() => {
    if (searchParams?.get("justCreated") === "true") {
      setIsInviteOpen(true);
    }
  }, [searchParams]);

  // 1. Fetch Space details
  const {
    data: space,
    isLoading: isSpaceLoading,
    error: spaceError,
  } = useQuery({
    queryKey: ["space", spaceId],
    queryFn: () => api.getSpace(spaceId),
    enabled: !!spaceId,
    retry: 1,
  });

  // 2. Fetch Members
  const { data: membersData } = useQuery({
    queryKey: ["space-members", spaceId],
    queryFn: () => api.getMembers(spaceId),
    enabled: !!spaceId,
    refetchInterval: 10000,
  });

  // 3. Fetch All Artifacts
  const { data: artifactsData } = useQuery({
    queryKey: ["space-artifacts", spaceId],
    queryFn: () => api.listArtifacts(spaceId),
    enabled: !!spaceId,
  });

  // 4. Fetch Gallery Assets
  const { data: assetsData } = useQuery({
    queryKey: ["space-assets", spaceId],
    queryFn: () => api.listAssets(spaceId),
    enabled: !!spaceId,
  });

  // 5. Realtime Activity & Connection Sync
  const { events, connectionStatus, sendWebSocketMessage } = useSpaceRealtime({
    spaceId,
    onEventReceived: () => {
      queryClient.invalidateQueries({ queryKey: ["space-artifacts", spaceId] });
      queryClient.invalidateQueries({ queryKey: ["space-assets", spaceId] });
      queryClient.invalidateQueries({ queryKey: ["space-members", spaceId] });
      queryClient.invalidateQueries({ queryKey: ["space", spaceId] });
    },
    onRawMessageReceived: (msg: any) => {
      // Direct transfer notifications
      if (msg.type === "direct_transfer.requested" && msg.transfer) {
        if (msg.transfer.recipient_id === user?.id) {
          setIncomingTransfer(msg.transfer);
        }
      } else if (msg.type === "direct_transfer.signal") {
        if (msg.target_user_id === user?.id) {
          if (activeSenderRef.current) {
            activeSenderRef.current.handleSignal(msg.signal);
          }
          if (activeReceiverRef.current) {
            if (msg.signal?.type === "offer") {
              activeReceiverRef.current.handleOffer(msg.signal.sdp);
            } else {
              activeReceiverRef.current.handleSignal(msg.signal);
            }
          }
        }
      }
    },
  });

  // Scroll chat to bottom when switching to Chat tab or when new messages arrive
  useEffect(() => {
    if (activeTab === "chat") {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeTab, artifactsData]);

  // 6. WebRTC Sender Flow Helper
  const handleStartDirectTransfer = async (
    file: File,
    recipientId: string,
    onProgress: (p: TransferProgress) => void,
  ) => {
    const iceResp = await api.getIceServers(spaceId);
    const iceServers: RTCIceServer[] = iceResp.ice_servers.map((s) => ({
      urls: s.urls,
      username: s.username || undefined,
      credential: s.credential || undefined,
    }));

    const sender = new WebRTCTransferSender(
      file,
      iceServers,
      (signal) => {
        sendWebSocketMessage({
          type: "direct_transfer.signal",
          space_id: spaceId,
          target_user_id: recipientId,
          signal,
        });
      },
      onProgress,
    );

    activeSenderRef.current = sender;
    await sender.startOffer();
  };

  // 7. WebRTC Recipient Accepted Helper
  const handleRecipientAccepted = async () => {
    if (!incomingTransfer) return;
    const iceResp = await api.getIceServers(spaceId);
    const iceServers: RTCIceServer[] = iceResp.ice_servers.map((s) => ({
      urls: s.urls,
      username: s.username || undefined,
      credential: s.credential || undefined,
    }));

    const receiver = new WebRTCTransferReceiver(
      iceServers,
      (signal) => {
        sendWebSocketMessage({
          type: "direct_transfer.signal",
          space_id: spaceId,
          target_user_id: incomingTransfer.sender_id,
          transfer_id: incomingTransfer.id,
          signal,
        });
      },
      (p) => setIncomingProgress(p),
      (blob) => {
        const url = URL.createObjectURL(blob);
        setReceivedBlobUrl(url);
      },
    );

    activeReceiverRef.current = receiver;
  };

  // 8. Mutations
  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => api.removeMember(spaceId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["space-members", spaceId] });
      queryClient.invalidateQueries({ queryKey: ["space", spaceId] });
    },
  });

  const votePollMutation = useMutation({
    mutationFn: ({
      pollId,
      optionIds,
    }: {
      pollId: string;
      optionIds: string[];
    }) =>
      api.votePoll(spaceId, pollId, {
        option_ids: optionIds,
        client_mutation_id: `vote-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["space-artifacts", spaceId] });
    },
  });

  const toggleChecklistMutation = useMutation({
    mutationFn: ({
      checklistId,
      itemId,
      completed,
    }: {
      checklistId: string;
      itemId: string;
      completed: boolean;
    }) =>
      api.toggleChecklistItem(spaceId, checklistId, itemId, {
        completed,
        client_mutation_id: `toggle-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["space-artifacts", spaceId] });
    },
  });

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (
      !messageInput.trim() ||
      isSendingMessage ||
      space?.status === "completed"
    )
      return;

    const textToSend = messageInput.trim();
    setMessageInput("");
    setIsSendingMessage(true);

    try {
      const clientMutationId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      await api.createMessage(spaceId, {
        text: textToSend,
        client_mutation_id: clientMutationId,
      });
      queryClient.invalidateQueries({ queryKey: ["space-artifacts", spaceId] });
    } catch (err: any) {
      alert(err.message || "Failed to send message.");
      setMessageInput(textToSend);
    } finally {
      setIsSendingMessage(false);
    }
  };

  if (isSpaceLoading) {
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
          <div>Loading Space...</div>
        </div>
      </div>
    );
  }

  if (spaceError || !space) {
    return (
      <div
        className="container"
        style={{ padding: "var(--mosaic-space-8) 0", maxWidth: "600px" }}
      >
        <Card padding="lg" style={{ textAlign: "center" }}>
          <h2
            style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              marginBottom: "var(--mosaic-space-3)",
            }}
          >
            Access Denied or Space Not Found
          </h2>
          <p
            style={{
              color: "var(--mosaic-color-text-secondary)",
              marginBottom: "var(--mosaic-space-6)",
            }}
          >
            You may not be an active member of this Space, or the Space no
            longer exists.
          </p>
          <Button variant="primary" onClick={() => router.push("/")}>
            <ArrowLeft size={16} />
            <span>Back to My Spaces</span>
          </Button>
        </Card>
      </div>
    );
  }

  const isHost = space.current_role === "host";
  const isCompleted = space.status === "completed";
  const members = membersData?.members || [];
  const artifacts = artifactsData?.artifacts || [];
  const assets = assetsData?.assets || [];

  const messages = artifacts.filter((a) => a.type === "message");
  const polls = artifacts.filter((a) => a.type === "poll");
  const checklists = artifacts.filter((a) => a.type === "checklist");

  const renderEventDescription = (
    type: string,
    data: Record<string, any>,
    actorName: string,
  ) => {
    switch (type) {
      case "space.created":
        return `created the Space "${data.title || space.title}"`;
      case "space.updated":
        return `updated Space details`;
      case "space.completed":
        return `completed this Space and preserved it as a shared memory`;
      case "space.reopened":
        return `reopened this Space`;
      case "membership.joined":
        return `joined the Space as ${data.role || "member"}`;
      case "membership.removed":
        return `removed ${data.removed_display_name || "a member"} from the Space`;
      case "artifact.created":
        if (data.type === "message")
          return `sent a message: "${data.text?.slice(0, 40)}${data.text?.length > 40 ? "..." : ""}"`;
        if (data.type === "poll") return `created a poll: "${data.question}"`;
        if (data.type === "checklist")
          return `created a checklist: "${data.title}"`;
        if (data.type === "file")
          return `uploaded a file: "${data.original_name}"`;
        return `shared an artifact`;
      case "poll.voted":
        return `voted on poll "${data.poll_question || "Poll"}"`;
      case "checklist.updated":
        return `${data.completed ? "completed" : "uncompleted"} "${data.item_text}" in ${data.checklist_title}`;
      default:
        return `shared an update`;
    }
  };

  return (
    <div
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
    >
      {/* Space Header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: "var(--mosaic-z-header)",
          backgroundColor: "var(--mosaic-color-surface-base)",
          borderBottom: "1px solid var(--mosaic-color-border-subtle)",
          boxShadow: "var(--mosaic-shadow-sm)",
        }}
      >
        <div
          className="container"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: "64px",
          }}
        >
          {/* Left: Back & Title */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Link
              href="/"
              aria-label="Back to Spaces"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "36px",
                height: "36px",
                borderRadius: "var(--mosaic-radius-sm)",
                color: "var(--mosaic-color-text-primary)",
              }}
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    backgroundColor:
                      space.cover_color || "var(--mosaic-color-brand-primary)",
                  }}
                />
                <h1
                  style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0 }}
                >
                  {space.title}
                </h1>
                <span
                  style={{
                    fontSize: "0.75rem",
                    padding: "2px 8px",
                    borderRadius: "var(--mosaic-radius-full)",
                    backgroundColor: isCompleted
                      ? "var(--mosaic-color-brand-subtle)"
                      : "var(--mosaic-color-surface-subtle)",
                    color: isCompleted
                      ? "var(--mosaic-color-brand-strong)"
                      : "var(--mosaic-color-text-secondary)",
                    fontWeight: 700,
                    textTransform: "capitalize",
                  }}
                >
                  {isCompleted ? "Completed Memory" : space.template}
                </span>
              </div>
              <div
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--mosaic-color-text-secondary)",
                }}
              >
                {members.length} {members.length === 1 ? "person" : "people"} ·{" "}
                {space.status}
              </div>
            </div>
          </div>

          {/* Right: Realtime Status, Summary, & Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              onClick={() => setIsDiagnosticsOpen(true)}
              style={{ cursor: "pointer" }}
              title="Click to view network diagnostics"
            >
              <StatusChip
                status={connectionStatus}
                label={
                  connectionStatus === "connected"
                    ? "Live"
                    : connectionStatus === "reconnecting"
                      ? "Reconnecting"
                      : "Offline"
                }
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsSummaryOpen(true)}
              title="Space Memory Recap"
            >
              <Sparkles size={16} />
              <span>Memory</span>
            </Button>
            {!isCompleted && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsDirectTransferOpen(true)}
                  title="Direct P2P transfer"
                >
                  <Wifi size={16} />
                  <span>Direct Transfer</span>
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsInviteOpen(true)}
                  title="Invite people"
                >
                  <QrCode size={16} />
                  <span>Invite</span>
                </Button>
              </>
            )}

            {isHost && (
              <Button
                variant={isCompleted ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setIsCompleteModalOpen(true)}
                title={isCompleted ? "Reopen Space" : "Complete Space"}
              >
                {isCompleted ? (
                  <RefreshCw size={16} />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                <span>{isCompleted ? "Reopen" : "Complete"}</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Completed Space Read-Only Banner */}
      {isCompleted && (
        <div
          style={{
            backgroundColor: "var(--mosaic-color-brand-subtle)",
            borderBottom: "1px solid var(--mosaic-color-border-subtle)",
            padding: "10px var(--mosaic-space-4)",
          }}
        >
          <div
            className="container"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "0.875rem",
              color: "var(--mosaic-color-text-primary)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Lock size={16} color="var(--mosaic-color-brand-primary)" />
              <span>
                <strong>Space Completed</strong> — Preserved as a read-only
                memory. All media, activity, and decisions remain browsable and
                exportable.
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSummaryOpen(true)}
            >
              <span>View Memory Recap</span>
            </Button>
          </div>
        </div>
      )}

      {/* Main Container with Tabs */}
      <div
        className="container"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: "var(--mosaic-space-6) 0",
        }}
      >
        {/* Navigation Tabs Bar */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            borderBottom: "1px solid var(--mosaic-color-border-subtle)",
            marginBottom: "var(--mosaic-space-6)",
            overflowX: "auto",
          }}
        >
          {[
            {
              id: "home",
              label: `Activity (${events.length})`,
              icon: Activity,
            },
            {
              id: "chat",
              label: `Chat (${messages.length})`,
              icon: MessageSquare,
            },
            {
              id: "gallery",
              label: `Gallery (${assets.length})`,
              icon: ImageIcon,
            },
            {
              id: "organize",
              label: `Organize (${polls.length + checklists.length})`,
              icon: CheckCircle2,
            },
            { id: "people", label: `People (${members.length})`, icon: Users },
          ].map((t) => {
            const Icon = t.icon;
            const isSelected = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as TabId)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "12px 16px",
                  fontSize: "0.9375rem",
                  fontWeight: isSelected ? 700 : 500,
                  color: isSelected
                    ? "var(--mosaic-color-brand-primary)"
                    : "var(--mosaic-color-text-secondary)",
                  borderBottom: isSelected
                    ? "2px solid var(--mosaic-color-brand-primary)"
                    : "2px solid transparent",
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                }}
              >
                <Icon size={18} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: HOME (Live Activity Timeline) */}
        {activeTab === "home" && (
          <div style={{ maxWidth: "760px", margin: "0 auto", width: "100%" }}>
            {/* Quick Share / Action Row (disabled if completed) */}
            {!isCompleted ? (
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  marginBottom: "var(--mosaic-space-6)",
                  flexWrap: "wrap",
                }}
              >
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => setActiveTab("chat")}
                  style={{ flex: 1, minWidth: "140px" }}
                >
                  <MessageSquare size={16} />
                  <span>Message</span>
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setIsUploadModalOpen(true)}
                >
                  <UploadCloud size={16} />
                  <span>Upload Media</span>
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setIsDirectTransferOpen(true)}
                >
                  <Wifi size={16} />
                  <span>Direct Transfer</span>
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setIsPollModalOpen(true)}
                >
                  <Vote size={16} />
                  <span>Create Poll</span>
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setIsChecklistModalOpen(true)}
                >
                  <CheckSquare size={16} />
                  <span>Create Checklist</span>
                </Button>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  borderRadius: "var(--mosaic-radius-md)",
                  backgroundColor: "var(--mosaic-color-surface-subtle)",
                  marginBottom: "var(--mosaic-space-6)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "0.875rem",
                  }}
                >
                  <Sparkles
                    size={18}
                    color="var(--mosaic-color-brand-primary)"
                  />
                  <span>
                    Explore the complete story and timeline of this event below.
                  </span>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsSummaryOpen(true)}
                >
                  <Download size={14} />
                  <span>Export Memory</span>
                </Button>
              </div>
            )}

            {/* Live Ordered Timeline Feed */}
            {events.length > 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--mosaic-space-3)",
                }}
              >
                {events.map((ev) => (
                  <Card key={ev.event_id} padding="md">
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "12px",
                      }}
                    >
                      <Avatar name={ev.actor.display_name} size="md" />
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: "4px",
                          }}
                        >
                          <span style={{ fontSize: "0.9375rem" }}>
                            <strong
                              style={{
                                color: "var(--mosaic-color-text-primary)",
                              }}
                            >
                              {ev.actor.display_name}
                            </strong>{" "}
                            <span
                              style={{
                                color: "var(--mosaic-color-text-secondary)",
                              }}
                            >
                              {renderEventDescription(
                                ev.type,
                                ev.data,
                                ev.actor.display_name,
                              )}
                            </span>
                          </span>
                          <span
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--mosaic-color-text-muted)",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <Clock size={12} />
                            <span>
                              {new Date(ev.occurred_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </span>
                        </div>

                        {/* Optional Event payload card */}
                        {ev.type === "space.created" && (
                          <div
                            style={{
                              marginTop: "8px",
                              padding: "8px 12px",
                              borderRadius: "var(--mosaic-radius-sm)",
                              backgroundColor:
                                "var(--mosaic-color-surface-subtle)",
                              fontSize: "0.875rem",
                              color: "var(--mosaic-color-text-secondary)",
                            }}
                          >
                            Welcome to <strong>{space.title}</strong>! This
                            Space was initialized with template:{" "}
                            <em>{space.template}</em>.
                          </div>
                        )}
                        {ev.type === "artifact.created" &&
                          ev.data.type === "message" && (
                            <div
                              style={{
                                marginTop: "6px",
                                padding: "10px 14px",
                                borderRadius: "var(--mosaic-radius-md)",
                                backgroundColor:
                                  "var(--mosaic-color-surface-subtle)",
                                fontSize: "0.9375rem",
                                color: "var(--mosaic-color-text-primary)",
                              }}
                            >
                              {ev.data.text}
                            </div>
                          )}
                        {ev.type === "artifact.created" &&
                          ev.data.type === "file" && (
                            <div
                              style={{
                                marginTop: "6px",
                                padding: "10px 14px",
                                borderRadius: "var(--mosaic-radius-md)",
                                backgroundColor:
                                  "var(--mosaic-color-surface-subtle)",
                                fontSize: "0.9375rem",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                }}
                              >
                                <File
                                  size={18}
                                  color="var(--mosaic-color-brand-primary)"
                                />
                                <span style={{ fontWeight: 600 }}>
                                  {ev.data.original_name}
                                </span>
                                <span
                                  style={{
                                    fontSize: "0.8125rem",
                                    color: "var(--mosaic-color-text-muted)",
                                  }}
                                >
                                  (
                                  {(ev.data.size_bytes / (1024 * 1024)).toFixed(
                                    2,
                                  )}{" "}
                                  MB)
                                </span>
                              </div>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setActiveTab("gallery")}
                              >
                                View in Gallery
                              </Button>
                            </div>
                          )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card
                padding="lg"
                style={{
                  textAlign: "center",
                  padding: "var(--mosaic-space-8) var(--mosaic-space-6)",
                }}
              >
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "var(--mosaic-radius-full)",
                    backgroundColor: "var(--mosaic-color-brand-subtle)",
                    color: "var(--mosaic-color-brand-primary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto var(--mosaic-space-4) auto",
                  }}
                >
                  <Sparkles size={24} />
                </div>
                <h3
                  style={{
                    fontSize: "1.125rem",
                    fontWeight: 700,
                    marginBottom: "var(--mosaic-space-2)",
                  }}
                >
                  Your Space is ready
                </h3>
                <p
                  style={{
                    color: "var(--mosaic-color-text-secondary)",
                    maxWidth: "420px",
                    margin: "0 auto var(--mosaic-space-5) auto",
                    lineHeight: 1.5,
                  }}
                >
                  Invite people to join by scanning a QR code or opening a link.
                  Shared activity and messages will appear here in real time.
                </p>
                <Button variant="primary" onClick={() => setIsInviteOpen(true)}>
                  <QrCode size={16} />
                  <span>Invite People to Space</span>
                </Button>
              </Card>
            )}
          </div>
        )}

        {/* Tab 2: CHAT */}
        {activeTab === "chat" && (
          <div
            style={{
              maxWidth: "760px",
              margin: "0 auto",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              height: "calc(100vh - 220px)",
            }}
          >
            {/* Message Feed */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "var(--mosaic-space-3)",
                paddingRight: "4px",
                marginBottom: "var(--mosaic-space-4)",
              }}
            >
              {messages.length === 0 ? (
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--mosaic-color-text-secondary)",
                  }}
                >
                  <MessageSquare
                    size={32}
                    style={{ marginBottom: "8px", opacity: 0.5 }}
                  />
                  <div>No messages yet.</div>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.created_by === user?.id;
                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                        flexDirection: isMe ? "row-reverse" : "row",
                      }}
                    >
                      <Avatar name={msg.creator.display_name} size="sm" />
                      <div
                        style={{
                          maxWidth: "70%",
                          padding: "10px 14px",
                          borderRadius: isMe
                            ? "var(--mosaic-radius-lg) var(--mosaic-radius-sm) var(--mosaic-radius-lg) var(--mosaic-radius-lg)"
                            : "var(--mosaic-radius-sm) var(--mosaic-radius-lg) var(--mosaic-radius-lg) var(--mosaic-radius-lg)",
                          backgroundColor: isMe
                            ? "var(--mosaic-color-brand-primary)"
                            : "var(--mosaic-color-surface-subtle)",
                          color: isMe
                            ? "#FFFFFF"
                            : "var(--mosaic-color-text-primary)",
                          boxShadow: "var(--mosaic-shadow-sm)",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            marginBottom: "2px",
                            opacity: isMe ? 0.9 : 0.7,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "8px",
                          }}
                        >
                          <span>{msg.creator.display_name}</span>
                          <span>
                            {new Date(msg.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: "0.9375rem",
                            lineHeight: 1.4,
                            wordBreak: "break-word",
                          }}
                        >
                          {msg.content?.text}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Bottom Message Composer (or read-only indicator) */}
            {!isCompleted ? (
              <form
                onSubmit={handleSendMessage}
                style={{ display: "flex", gap: "8px", alignItems: "center" }}
              >
                <input
                  type="text"
                  placeholder={`Message ${space.title}...`}
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "12px 16px",
                    borderRadius: "var(--mosaic-radius-full)",
                    border: "1px solid var(--mosaic-color-border-subtle)",
                    backgroundColor: "var(--mosaic-color-surface-base)",
                    fontSize: "0.9375rem",
                    outline: "none",
                  }}
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={!messageInput.trim() || isSendingMessage}
                  isLoading={isSendingMessage}
                >
                  <Send size={16} />
                  <span>Send</span>
                </Button>
              </form>
            ) : (
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: "var(--mosaic-radius-md)",
                  backgroundColor: "var(--mosaic-color-surface-subtle)",
                  textAlign: "center",
                  fontSize: "0.875rem",
                  color: "var(--mosaic-color-text-secondary)",
                }}
              >
                Chat is archived in read-only mode for this completed Space.
              </div>
            )}
          </div>
        )}

        {/* Tab 3: GALLERY */}
        {activeTab === "gallery" && (
          <div style={{ maxWidth: "860px", margin: "0 auto", width: "100%" }}>
            {/* Gallery Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "var(--mosaic-space-5)",
              }}
            >
              <div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>
                  Media & Files ({assets.length})
                </h2>
                <span
                  style={{
                    fontSize: "0.875rem",
                    color: "var(--mosaic-color-text-secondary)",
                  }}
                >
                  Photos and documents shared with this Space
                </span>
              </div>
              {!isCompleted && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsUploadModalOpen(true)}
                >
                  <UploadCloud size={16} />
                  <span>Upload Media</span>
                </Button>
              )}
            </div>

            {assets.length === 0 ? (
              <Card
                padding="lg"
                style={{
                  textAlign: "center",
                  padding: "var(--mosaic-space-10) var(--mosaic-space-6)",
                }}
              >
                <ImageIcon
                  size={36}
                  color="var(--mosaic-color-brand-primary)"
                  style={{ margin: "0 auto 12px auto" }}
                />
                <h3
                  style={{
                    fontSize: "1.125rem",
                    fontWeight: 700,
                    marginBottom: "6px",
                  }}
                >
                  No media shared yet
                </h3>
                <p
                  style={{
                    color: "var(--mosaic-color-text-secondary)",
                    marginBottom: "var(--mosaic-space-5)",
                  }}
                >
                  Photos, travel itineraries, and files for everyone in the
                  Space.
                </p>
                {!isCompleted && (
                  <Button
                    variant="primary"
                    onClick={() => setIsUploadModalOpen(true)}
                  >
                    <UploadCloud size={16} />
                    <span>Upload your first photo / file</span>
                  </Button>
                )}
              </Card>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                  gap: "var(--mosaic-space-4)",
                }}
              >
                {assets.map((asset) => {
                  const isImage = asset.mime_type.startsWith("image/");
                  return (
                    <Card
                      key={asset.id}
                      padding="none"
                      onClick={() => setSelectedAssetForPreview(asset)}
                      style={{
                        overflow: "hidden",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        transition:
                          "transform 0.15s ease, box-shadow 0.15s ease",
                      }}
                    >
                      <div
                        style={{
                          height: "140px",
                          backgroundColor: "var(--mosaic-color-surface-subtle)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          overflow: "hidden",
                          position: "relative",
                        }}
                      >
                        {isImage && asset.download_url ? (
                          <img
                            src={asset.download_url}
                            alt={asset.original_name}
                            loading="lazy"
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                              display: "block",
                            }}
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        ) : isImage ? (
                          <ImageIcon
                            size={32}
                            color="var(--mosaic-color-brand-primary)"
                          />
                        ) : (
                          <File
                            size={36}
                            color="var(--mosaic-color-brand-primary)"
                          />
                        )}
                      </div>
                      <div style={{ padding: "10px 12px" }}>
                        <div
                          style={{
                            fontSize: "0.875rem",
                            fontWeight: 700,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            marginBottom: "4px",
                          }}
                        >
                          {asset.original_name}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            fontSize: "0.75rem",
                            color: "var(--mosaic-color-text-secondary)",
                          }}
                        >
                          <span>{asset.uploader.display_name}</span>
                          <span>
                            {(asset.size_bytes / (1024 * 1024)).toFixed(1)} MB
                          </span>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: ORGANIZE (Polls & Checklists) */}
        {activeTab === "organize" && (
          <div style={{ maxWidth: "760px", margin: "0 auto", width: "100%" }}>
            {/* Header actions */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "var(--mosaic-space-5)",
              }}
            >
              <div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>
                  Decisions & Tasks
                </h2>
                <span
                  style={{
                    fontSize: "0.875rem",
                    color: "var(--mosaic-color-text-secondary)",
                  }}
                >
                  Polls and collaborative checklists for this Space
                </span>
              </div>
              {!isCompleted && (
                <div style={{ display: "flex", gap: "8px" }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsPollModalOpen(true)}
                  >
                    <Vote size={16} />
                    <span>New Poll</span>
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsChecklistModalOpen(true)}
                  >
                    <CheckSquare size={16} />
                    <span>New Checklist</span>
                  </Button>
                </div>
              )}
            </div>

            {/* List Polls & Checklists */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--mosaic-space-6)",
              }}
            >
              {/* Polls Section */}
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
                  Polls ({polls.length})
                </h3>
                {polls.length === 0 ? (
                  <Card
                    padding="md"
                    style={{
                      textAlign: "center",
                      color: "var(--mosaic-color-text-secondary)",
                    }}
                  >
                    No polls recorded.
                  </Card>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "var(--mosaic-space-4)",
                    }}
                  >
                    {polls.map((poll) => {
                      const options: Array<{
                        id: string;
                        label: string;
                        votes: string[];
                      }> = poll.content?.options || [];
                      const totalVotes = options.reduce(
                        (sum, o) => sum + (o.votes?.length || 0),
                        0,
                      );
                      const myVotes = options
                        .filter((o) => o.votes?.includes(user?.id || ""))
                        .map((o) => o.id);

                      return (
                        <Card key={poll.id} padding="lg">
                          <div
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: "12px",
                              marginBottom: "12px",
                            }}
                          >
                            <Avatar
                              name={poll.creator.display_name}
                              size="md"
                            />
                            <div>
                              <h4
                                style={{
                                  fontSize: "1.125rem",
                                  fontWeight: 700,
                                  margin: 0,
                                }}
                              >
                                {poll.content?.question}
                              </h4>
                              <div
                                style={{
                                  fontSize: "0.8125rem",
                                  color: "var(--mosaic-color-text-secondary)",
                                }}
                              >
                                By {poll.creator.display_name} · {totalVotes}{" "}
                                {totalVotes === 1 ? "vote" : "votes"}
                              </div>
                            </div>
                          </div>

                          {/* Options */}
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "8px",
                            }}
                          >
                            {options.map((opt) => {
                              const voteCount = opt.votes?.length || 0;
                              const pct =
                                totalVotes > 0
                                  ? Math.round((voteCount / totalVotes) * 100)
                                  : 0;
                              const isVoted = myVotes.includes(opt.id);

                              return (
                                <button
                                  key={opt.id}
                                  disabled={isCompleted}
                                  onClick={() => {
                                    if (isCompleted) return;
                                    const nextVotes = isVoted
                                      ? myVotes.filter((id) => id !== opt.id)
                                      : poll.content?.allow_multiple
                                        ? [...myVotes, opt.id]
                                        : [opt.id];
                                    votePollMutation.mutate({
                                      pollId: poll.id,
                                      optionIds: nextVotes,
                                    });
                                  }}
                                  style={{
                                    position: "relative",
                                    padding: "10px 14px",
                                    borderRadius: "var(--mosaic-radius-md)",
                                    border: isVoted
                                      ? "2px solid var(--mosaic-color-brand-primary)"
                                      : "1px solid var(--mosaic-color-border-subtle)",
                                    backgroundColor:
                                      "var(--mosaic-color-surface-base)",
                                    overflow: "hidden",
                                    textAlign: "left",
                                    cursor: isCompleted ? "default" : "pointer",
                                  }}
                                >
                                  {/* Progress bar background */}
                                  <div
                                    style={{
                                      position: "absolute",
                                      left: 0,
                                      top: 0,
                                      bottom: 0,
                                      width: `${pct}%`,
                                      backgroundColor: isVoted
                                        ? "var(--mosaic-color-brand-subtle)"
                                        : "var(--mosaic-color-surface-subtle)",
                                      zIndex: 0,
                                      transition: "width 0.3s ease",
                                    }}
                                  />
                                  <div
                                    style={{
                                      position: "relative",
                                      zIndex: 1,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "space-between",
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontWeight: isVoted ? 700 : 500,
                                        fontSize: "0.9375rem",
                                      }}
                                    >
                                      {opt.label}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: "0.8125rem",
                                        color:
                                          "var(--mosaic-color-text-secondary)",
                                      }}
                                    >
                                      {voteCount} ({pct}%)
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Checklists Section */}
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
                  Checklists ({checklists.length})
                </h3>
                {checklists.length === 0 ? (
                  <Card
                    padding="md"
                    style={{
                      textAlign: "center",
                      color: "var(--mosaic-color-text-secondary)",
                    }}
                  >
                    No checklists recorded.
                  </Card>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "var(--mosaic-space-4)",
                    }}
                  >
                    {checklists.map((chk) => {
                      const items: Array<{
                        id: string;
                        text: string;
                        completed: boolean;
                      }> = chk.content?.items || [];
                      const completedCount = items.filter(
                        (it) => it.completed,
                      ).length;
                      const progressPct =
                        items.length > 0
                          ? Math.round((completedCount / items.length) * 100)
                          : 0;

                      return (
                        <Card key={chk.id} padding="lg">
                          <div
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              justifyContent: "space-between",
                              marginBottom: "12px",
                            }}
                          >
                            <div>
                              <h4
                                style={{
                                  fontSize: "1.125rem",
                                  fontWeight: 700,
                                  margin: 0,
                                }}
                              >
                                {chk.content?.title}
                              </h4>
                              <div
                                style={{
                                  fontSize: "0.8125rem",
                                  color: "var(--mosaic-color-text-secondary)",
                                }}
                              >
                                {completedCount} of {items.length} completed (
                                {progressPct}%)
                              </div>
                            </div>
                            <span
                              style={{
                                fontSize: "0.75rem",
                                padding: "2px 8px",
                                borderRadius: "var(--mosaic-radius-full)",
                                backgroundColor:
                                  progressPct === 100
                                    ? "var(--mosaic-color-status-success-subtle)"
                                    : "var(--mosaic-color-brand-subtle)",
                                color:
                                  progressPct === 100
                                    ? "var(--mosaic-color-status-success)"
                                    : "var(--mosaic-color-brand-strong)",
                                fontWeight: 700,
                              }}
                            >
                              {progressPct === 100 ? "Done" : `${progressPct}%`}
                            </span>
                          </div>

                          {/* Progress bar */}
                          <div
                            style={{
                              width: "100%",
                              height: "6px",
                              backgroundColor:
                                "var(--mosaic-color-surface-subtle)",
                              borderRadius: "var(--mosaic-radius-full)",
                              overflow: "hidden",
                              marginBottom: "14px",
                            }}
                          >
                            <div
                              style={{
                                width: `${progressPct}%`,
                                height: "100%",
                                backgroundColor:
                                  "var(--mosaic-color-brand-primary)",
                                transition: "width 0.3s ease",
                              }}
                            />
                          </div>

                          {/* Checklist Items */}
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "8px",
                            }}
                          >
                            {items.map((it) => (
                              <button
                                key={it.id}
                                disabled={isCompleted}
                                onClick={() => {
                                  if (isCompleted) return;
                                  toggleChecklistMutation.mutate({
                                    checklistId: chk.id,
                                    itemId: it.id,
                                    completed: !it.completed,
                                  });
                                }}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "10px",
                                  padding: "8px 12px",
                                  borderRadius: "var(--mosaic-radius-md)",
                                  backgroundColor: it.completed
                                    ? "var(--mosaic-color-surface-subtle)"
                                    : "var(--mosaic-color-surface-base)",
                                  border:
                                    "1px solid var(--mosaic-color-border-subtle)",
                                  textAlign: "left",
                                  cursor: isCompleted ? "default" : "pointer",
                                }}
                              >
                                {it.completed ? (
                                  <CheckSquare
                                    size={18}
                                    color="var(--mosaic-color-brand-primary)"
                                  />
                                ) : (
                                  <Square
                                    size={18}
                                    color="var(--mosaic-color-text-muted)"
                                  />
                                )}
                                <span
                                  style={{
                                    fontSize: "0.9375rem",
                                    textDecoration: it.completed
                                      ? "line-through"
                                      : "none",
                                    color: it.completed
                                      ? "var(--mosaic-color-text-muted)"
                                      : "var(--mosaic-color-text-primary)",
                                  }}
                                >
                                  {it.text}
                                </span>
                              </button>
                            ))}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: PEOPLE */}
        {activeTab === "people" && (
          <div style={{ maxWidth: "760px", margin: "0 auto", width: "100%" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "var(--mosaic-space-4)",
              }}
            >
              <div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>
                  People ({members.length})
                </h2>
                <span
                  style={{
                    fontSize: "0.875rem",
                    color: "var(--mosaic-color-text-secondary)",
                  }}
                >
                  Members of this Space
                </span>
              </div>
              {!isCompleted && (
                <div style={{ display: "flex", gap: "8px" }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsDirectTransferOpen(true)}
                  >
                    <Wifi size={16} />
                    <span>Direct Transfer</span>
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsInviteOpen(true)}
                  >
                    <Plus size={16} />
                    <span>Invite</span>
                  </Button>
                </div>
              )}
            </div>

            <Card padding="none">
              {members.map((member, index) => (
                <div
                  key={member.user_id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "var(--mosaic-space-4) var(--mosaic-space-5)",
                    borderBottom:
                      index < members.length - 1
                        ? "1px solid var(--mosaic-color-border-subtle)"
                        : "none",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <Avatar
                      name={member.display_name}
                      size="md"
                      status={
                        member.presence_status === "online"
                          ? "online"
                          : undefined
                      }
                    />
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <span
                          style={{ fontWeight: 600, fontSize: "0.9375rem" }}
                        >
                          {member.display_name}
                        </span>
                        {member.role === "host" && (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              fontSize: "0.75rem",
                              padding: "2px 8px",
                              borderRadius: "var(--mosaic-radius-full)",
                              backgroundColor:
                                "var(--mosaic-color-brand-subtle)",
                              color: "var(--mosaic-color-brand-strong)",
                              fontWeight: 700,
                            }}
                          >
                            <Shield size={12} />
                            <span>Host</span>
                          </span>
                        )}
                        {member.is_guest && (
                          <span
                            style={{
                              fontSize: "0.75rem",
                              padding: "2px 8px",
                              borderRadius: "var(--mosaic-radius-full)",
                              backgroundColor:
                                "var(--mosaic-color-surface-subtle)",
                              color: "var(--mosaic-color-text-secondary)",
                            }}
                          >
                            Guest
                          </span>
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: "0.8125rem",
                          color: "var(--mosaic-color-text-muted)",
                        }}
                      >
                        Joined {new Date(member.joined_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "6px" }}>
                    {!isCompleted && member.user_id !== user?.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsDirectTransferOpen(true)}
                        title="Direct WebRTC Transfer"
                      >
                        <Wifi size={14} />
                        <span>Send File</span>
                      </Button>
                    )}

                    {/* Host Action: Remove Member */}
                    {!isCompleted && isHost && member.role !== "host" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (
                            confirm(
                              `Remove ${member.display_name} from this Space?`,
                            )
                          ) {
                            removeMemberMutation.mutate(member.user_id);
                          }
                        }}
                        title="Remove member"
                        style={{ color: "var(--mosaic-color-status-danger)" }}
                      >
                        <UserX size={16} />
                        <span>Remove</span>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </Card>
          </div>
        )}
      </div>

      {/* Modals */}
      <InviteModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        spaceId={space.id}
        spaceTitle={space.title}
        isHost={isHost}
      />
      <CreatePollModal
        isOpen={isPollModalOpen}
        onClose={() => setIsPollModalOpen(false)}
        spaceId={space.id}
        onPollCreated={() =>
          queryClient.invalidateQueries({
            queryKey: ["space-artifacts", spaceId],
          })
        }
      />
      <CreateChecklistModal
        isOpen={isChecklistModalOpen}
        onClose={() => setIsChecklistModalOpen(false)}
        spaceId={space.id}
        onChecklistCreated={() =>
          queryClient.invalidateQueries({
            queryKey: ["space-artifacts", spaceId],
          })
        }
      />
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        spaceId={space.id}
        onUploadCompleted={() => {
          queryClient.invalidateQueries({
            queryKey: ["space-assets", spaceId],
          });
          queryClient.invalidateQueries({
            queryKey: ["space-artifacts", spaceId],
          });
        }}
      />
      <MediaLightbox
        asset={selectedAssetForPreview}
        spaceId={space.id}
        onClose={() => setSelectedAssetForPreview(null)}
      />
      <DirectTransferModal
        isOpen={isDirectTransferOpen}
        onClose={() => setIsDirectTransferOpen(false)}
        spaceId={space.id}
        members={members}
        currentUserId={user?.id}
        onStartTransfer={handleStartDirectTransfer}
        onFallbackToCloud={() => setIsUploadModalOpen(true)}
      />
      <IncomingTransferModal
        transfer={incomingTransfer}
        spaceId={space.id}
        progress={incomingProgress}
        receivedBlobUrl={receivedBlobUrl}
        onClose={() => {
          setIncomingTransfer(null);
          setIncomingProgress(null);
          setReceivedBlobUrl(null);
        }}
        onAccepted={handleRecipientAccepted}
      />
      <SpaceSummaryModal
        isOpen={isSummaryOpen}
        onClose={() => setIsSummaryOpen(false)}
        spaceId={space.id}
      />
      <CompleteSpaceModal
        isOpen={isCompleteModalOpen}
        onClose={() => setIsCompleteModalOpen(false)}
        spaceId={space.id}
        spaceTitle={space.title}
        isCompleted={isCompleted}
        onStatusChanged={() => {
          queryClient.invalidateQueries({ queryKey: ["space", spaceId] });
          queryClient.invalidateQueries({
            queryKey: ["space-summary", spaceId],
          });
        }}
      />
      <DiagnosticsModal
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
        spaceId={space.id}
        connectionStatus={connectionStatus}
        latestSequence={
          events.length > 0 ? Math.max(...events.map((e) => e.sequence)) : 0
        }
      />
    </div>
  );
}
