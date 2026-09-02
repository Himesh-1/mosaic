"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ActivityEventResponse } from "@mosaic/contracts";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export type ConnectionStatus = "connected" | "reconnecting" | "offline";

interface UseSpaceRealtimeOptions {
  spaceId: string;
  initialEvents?: ActivityEventResponse[];
  onEventReceived?: (event: ActivityEventResponse) => void;
  onRawMessageReceived?: (msg: any) => void;
}

export function useSpaceRealtime({
  spaceId,
  initialEvents = [],
  onEventReceived,
  onRawMessageReceived,
}: UseSpaceRealtimeOptions) {
  const { session, isLoading: isAuthLoading } = useAuth();
  const [events, setEvents] = useState<ActivityEventResponse[]>(initialEvents);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("offline");
  const [latestSequence, setLatestSequence] = useState<number>(() => {
    if (initialEvents.length > 0) {
      return Math.max(...initialEvents.map((e) => e.sequence));
    }
    return 0;
  });

  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestSequenceRef = useRef<number>(latestSequence);
  latestSequenceRef.current = latestSequence;

  // Store volatile callbacks in refs to prevent reconnection render-loops
  const onEventReceivedRef = useRef(onEventReceived);
  onEventReceivedRef.current = onEventReceived;

  const onRawMessageReceivedRef = useRef(onRawMessageReceived);
  onRawMessageReceivedRef.current = onRawMessageReceived;

  // Send message helper
  const sendWebSocketMessage = useCallback((msg: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  // Merge helper: deduplicates by event_id, sorts by sequence ASC
  const mergeEvents = useCallback((newEvents: ActivityEventResponse[]) => {
    if (newEvents.length === 0) return;

    setEvents((prev) => {
      const map = new Map<string, ActivityEventResponse>();
      prev.forEach((e) => map.set(e.event_id, e));
      newEvents.forEach((e) => map.set(e.event_id, e));

      const merged = Array.from(map.values()).sort(
        (a, b) => a.sequence - b.sequence,
      );
      const maxSeq = merged.length > 0 ? merged[merged.length - 1].sequence : 0;
      setLatestSequence(maxSeq);
      return merged;
    });
  }, []);

  // Catch up from REST API
  const performCatchup = useCallback(async () => {
    if (!spaceId) return;
    try {
      const feed = await api.getActivity(
        spaceId,
        latestSequenceRef.current,
        100,
      );
      if (feed.events && feed.events.length > 0) {
        mergeEvents(feed.events);
      }
    } catch {
      // Ignored
    }
  }, [spaceId, mergeEvents]);

  useEffect(() => {
    if (!spaceId || typeof window === "undefined") return;

    let isUnmounted = false;

    const getStoredToken = () => {
      if (session?.token) return session.token;
      if (session?.id) return session.id;
      if (typeof window !== "undefined") {
        return localStorage.getItem("mosaic_session_token") || null;
      }
      return null;
    };

    const storedToken = getStoredToken();
    if (isAuthLoading && !storedToken) {
      return;
    }

    const buildWsUrl = () => {
      let base = process.env.NEXT_PUBLIC_WS_URL;
      if (!base) {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        if (window.location.port === "3000") {
          base = `${protocol}//${window.location.hostname}:8000/api/v1/realtime`;
        } else {
          base = `${protocol}//${window.location.host}/api/v1/realtime`;
        }
      }

      const activeToken = getStoredToken();
      if (activeToken) {
        const separator = base.includes("?") ? "&" : "?";
        return `${base}${separator}token=${encodeURIComponent(activeToken)}`;
      }
      return base;
    };

    const connect = () => {
      if (isUnmounted) return;
      if (
        wsRef.current &&
        (wsRef.current.readyState === WebSocket.OPEN ||
          wsRef.current.readyState === WebSocket.CONNECTING)
      ) {
        return;
      }

      setConnectionStatus("reconnecting");

      try {
        const currentUrl = buildWsUrl();
        const ws = new WebSocket(currentUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (isUnmounted) {
            ws.close();
            return;
          }
          setConnectionStatus("connected");

          // Subscribe to Space with latest sequence cursor
          ws.send(
            JSON.stringify({
              type: "subscribe",
              space_id: spaceId,
              after_sequence: latestSequenceRef.current,
            }),
          );

          // Perform REST catch-up to ensure zero gap
          performCatchup();

          // Start Heartbeat every 25 seconds
          if (heartbeatIntervalRef.current)
            clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: "presence.heartbeat",
                  space_id: spaceId,
                }),
              );
            }
          }, 25000);
        };

        ws.onmessage = (event) => {
          if (isUnmounted) return;
          try {
            const msg = JSON.parse(event.data);

            if (msg.type === "error" && msg.code === "unauthorized") {
              setConnectionStatus("offline");
              if (reconnectTimeoutRef.current)
                clearTimeout(reconnectTimeoutRef.current);
              return;
            }

            if (onRawMessageReceivedRef.current) {
              onRawMessageReceivedRef.current(msg);
            }

            // Handle ActivityEvent message envelope
            if (msg.event_id && msg.sequence !== undefined) {
              const activityEvent: ActivityEventResponse = {
                event_id: msg.event_id,
                space_id: msg.space_id,
                sequence: msg.sequence,
                type: msg.type,
                occurred_at: msg.occurred_at,
                actor: msg.actor,
                data: msg.data || {},
              };
              mergeEvents([activityEvent]);
              if (onEventReceivedRef.current) {
                onEventReceivedRef.current(activityEvent);
              }
            }
          } catch {
            // Ignored non-json
          }
        };

        let retryCount = 0;

        ws.onclose = () => {
          if (isUnmounted) return;
          setConnectionStatus("offline");
          if (heartbeatIntervalRef.current)
            clearInterval(heartbeatIntervalRef.current);

          // Exponential backoff: 2s, 4s, 8s, 16s, max 30s
          const delay = Math.min(2000 * Math.pow(1.5, retryCount), 30000);
          retryCount++;

          if (reconnectTimeoutRef.current)
            clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch {
        if (isUnmounted) return;
        setConnectionStatus("offline");
        if (reconnectTimeoutRef.current)
          clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 5000);
      }
    };

    performCatchup();
    connect();

    return () => {
      isUnmounted = true;
      if (heartbeatIntervalRef.current)
        clearInterval(heartbeatIntervalRef.current);
      if (reconnectTimeoutRef.current)
        clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        const socket = wsRef.current;
        wsRef.current = null;
        if (socket.readyState === WebSocket.OPEN) {
          socket.close();
        } else if (socket.readyState === WebSocket.CONNECTING) {
          socket.onopen = () => {
            socket.close();
          };
        }
      }
    };
  }, [spaceId, performCatchup, mergeEvents, session?.token, session?.id]);

  return {
    events,
    connectionStatus,
    latestSequence,
    refreshCatchup: performCatchup,
    sendWebSocketMessage,
  };
}
