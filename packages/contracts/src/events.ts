export type ActivityEventType =
  | "space.updated"
  | "membership.joined"
  | "membership.left"
  | "membership.removed"
  | "presence.changed"
  | "artifact.created"
  | "artifact.updated"
  | "artifact.deleted"
  | "poll.voted"
  | "poll.closed"
  | "checklist.item_updated"
  | "asset.ready"
  | "asset.failed"
  | "transfer.created"
  | "transfer.updated"
  | "peer.offer"
  | "peer.answer"
  | "peer.ice_candidate"
  | "peer.closed"
  | "space.completed";

export interface EventActor {
  id: string;
  display_name: string;
  avatar_asset_id?: string | null;
}

export interface ActivityEventEnvelope<T = Record<string, unknown>> {
  event_id: string;
  space_id: string;
  sequence: number;
  type: ActivityEventType;
  occurred_at: string;
  actor: EventActor;
  data: T;
}

export type RealtimeClientMessage =
  | {
      type: "hello";
      session_id: string;
      app_version: string;
      last_sequences: Record<string, number>;
    }
  | { type: "subscribe"; space_id: string; after_sequence?: number }
  | { type: "presence.heartbeat"; space_id: string }
  | {
      type: "peer.offer";
      connection_id: string;
      to_session_id: string;
      sdp: string;
    }
  | {
      type: "peer.answer";
      connection_id: string;
      to_session_id: string;
      sdp: string;
    }
  | {
      type: "peer.ice_candidate";
      connection_id: string;
      to_session_id: string;
      candidate: RTCIceCandidateInit;
    }
  | { type: "peer.close"; connection_id: string; to_session_id: string };
