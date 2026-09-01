# Mosaic — System Design

**Status:** Foundation technical specification  
**Scope:** Web-first MVP and the extension points required for later Mosaic phases  
**Companion product contract:** `PROJECT_SPEC.md`  
**Audience:** Engineers and AI implementation agents

---

## 1. Purpose and scope

This document defines how Mosaic should be built technically. It turns the product contract into an implementable, observable, and honest web system.

Mosaic is a **hybrid, local-first collaborative system** for small private groups. In Phase 1, a responsive web client provides durable collaboration through backend services while using WebRTC peer connections for direct transfers where the browser and network permit it.

### This document decides

- the baseline architecture and responsibility of each component;
- the initial implementation stack;
- domain entities, persistence model, event model, and authorization boundaries;
- HTTP, WebSocket, and peer-signaling contracts;
- offline/retry and conflict-handling behavior;
- direct P2P transfer behavior, reliability, and fallbacks;
- security, privacy, operations, and test requirements.

### This document does not decide

- visual layout, branding, microcopy, and screen-level interaction rules (`UI_UX_SPEC.md`);
- contribution workflow and repository conventions (`AGENTS.md`);
- native mobile implementation details;
- full end-to-end encryption or multi-hop mesh routing. Those are explicitly later research/development work.

## 2. Non-negotiable technical principles

1. **Cloud is the durable source of truth for Phase 1 shared state.** A peer connection improves delivery; it does not become the only copy of an important artifact.
2. **Every mutation is idempotent.** Retries caused by disconnects, refreshes, or a worker retry must not duplicate a message, upload, vote, or activity.
3. **The client is optimistic but never deceptive.** It immediately renders a pending action, then transitions to confirmed, queued, or failed based on an authoritative result.
4. **WebRTC is best-effort.** Signaling, STUN/TURN, peer permissions, timeouts, and fallback behavior are first-class system components.
5. **Small, private spaces first.** Optimize for 2–15 actively connected members, not public scale or a large peer mesh.
6. **Server-side authorization is mandatory.** UI visibility is never authorization.
7. **Events are durable product data.** The activity timeline is derived from a server-side event log, not unreliable client callbacks.
8. **Local persistence protects user intent.** Offline-safe drafts and queued mutations live in IndexedDB until resolved.
9. **Browser constraints are a product constraint.** No component may claim persistent background networking, Bluetooth mesh, or universal direct connectivity in Phase 1.

## 3. Architecture overview

```text
                           ┌───────────────────────────┐
                           │        Web client         │
                           │ Next.js + TypeScript/PWA  │
                           │ UI · IndexedDB · WebRTC   │
                           └───────┬─────────┬─────────┘
                                   │ HTTPS   │ WSS
                                   │         │ signaling/presence/events
             direct DataChannel   │         │
        ┌──────────────────────────┘         └────────────────────────────┐
        │                                                                   │
┌───────▼────────┐                                                 ┌────────▼────────┐
│ Other browser  │                                                 │  API service     │
│  WebRTC peer   │                                                 │ FastAPI          │
└────────────────┘                                                 │ REST + WebSocket │
                                                                   └──┬─────┬─────┬──┘
                                                                      │     │     │
                                                     ┌────────────────┘     │     └───────────────┐
                                                     ▼                      ▼                     ▼
                                             ┌──────────────┐      ┌─────────────┐        ┌──────────────┐
                                             │ PostgreSQL   │      │ Redis       │        │ Object store │
                                             │ durable data │      │ presence,   │        │ S3-compatible│
                                             │ + event log  │      │ pub/sub/jobs│        │ media/files  │
                                             └──────────────┘      └─────────────┘        └──────────────┘
                                                                                                  │
                                                                                    ┌─────────────▼─────────────┐
                                                                                    │ Background worker service  │
                                                                                    │ thumbnails, cleanup, scan, │
                                                                                    │ summaries later            │
                                                                                    └───────────────────────────┘

                                  ┌────────────────────────────────────────────────┐
                                  │ STUN/TURN service (coturn or managed equivalent)│
                                  │ NAT traversal / relay for WebRTC only           │
                                  └────────────────────────────────────────────────┘
```

### 3.1 Component responsibilities

| Component    | Responsibilities                                                                                                                               | Must not own                                                                     |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Web client   | UI, local cache/queue, media selection, realtime subscription, WebRTC peer lifecycle, rendering statuses                                       | authoritative authorization, final mutation ordering, sole durable artifact copy |
| API service  | identity/session checks, authorization, validation, transactional writes, REST APIs, websocket sessions, signaling routing, signed upload URLs | long-running media processing, file bytes relayed between peers                  |
| PostgreSQL   | users, spaces, memberships, artifacts, mutable feature state, activity events, idempotency records                                             | online presence, raw media bytes, transient WebSocket routing                    |
| Redis        | presence leases, WebSocket fan-out, signaling routing hints, rate limits, job dispatch                                                         | any data that cannot be lost without recovery                                    |
| Object store | encrypted-at-rest original uploads, derived media, export bundles                                                                              | authorization decisions, public unbounded links                                  |
| Worker       | media metadata, thumbnails, scanning integration, expiring content, exports, later AI jobs                                                     | realtime request/response path                                                   |
| STUN/TURN    | establish/relay WebRTC connectivity                                                                                                            | app authorization or persistence                                                 |

## 4. Chosen technology baseline

The following stack is the default. Do not introduce alternatives unless a documented constraint requires it.

| Layer             | Choice                                                                          | Notes                                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Web client        | Next.js (App Router) + TypeScript                                               | Responsive PWA; server rendering is optional for public/landing routes, authenticated Space UI is client-interactive.         |
| Client state/data | TanStack Query + lightweight client store (Zustand or equivalent)               | Query cache for server state; small store for UI/realtime/transfer state.                                                     |
| Local persistence | IndexedDB via Dexie                                                             | Pending mutation queue, drafts, metadata cache, resumable-upload state. Never store access tokens unencrypted in a custom DB. |
| PWA               | Service worker/Workbox or Next-compatible PWA setup                             | App shell and conservative asset caching. Do not promise background sync where unsupported.                                   |
| Backend           | Python 3.12 + FastAPI + Pydantic v2 + SQLAlchemy 2                              | Typed HTTP/WebSocket service.                                                                                                 |
| Database          | PostgreSQL 16                                                                   | UUID/ULID identifiers, transactions, JSONB only for flexible metadata.                                                        |
| Migrations        | Alembic                                                                         | Every schema alteration is a migration.                                                                                       |
| Cache/realtime    | Redis 7                                                                         | Pub/sub or streams for service fan-out; TTL-backed presence.                                                                  |
| Async work        | Celery/Dramatiq/RQ backed by Redis                                              | Pick one before implementation; default to Dramatiq for a small, typed Python service.                                        |
| Object storage    | S3-compatible private bucket                                                    | Local development uses MinIO.                                                                                                 |
| Realtime          | WebSockets                                                                      | Primary path for presence, activity, message delivery, signaling.                                                             |
| P2P               | Native browser WebRTC DataChannels                                              | No custom protocol library required in MVP.                                                                                   |
| NAT traversal     | coturn                                                                          | Development and production must both support TURN credentials.                                                                |
| Auth              | Email/password or magic-link session authentication behind a provider interface | Use secure HttpOnly SameSite cookies. Guest join is a scoped identity/session, not unauthenticated access.                    |
| Deployment        | Docker Compose locally; container deployment in production                      | Infrastructure provider is deliberately deferred.                                                                             |
| Observability     | Structured logs, OpenTelemetry-compatible traces, error reporting               | No private content in routine telemetry.                                                                                      |
| Tests             | pytest + Playwright + Vitest                                                    | Contract, API, WebSocket, and multi-browser E2E coverage are required.                                                        |

### Why not native/mobile in Phase 1?

The web client validates the core collaboration and protocol model across phones and laptops with no application installation. Native apps later consume the same logical API/event model and add device capabilities where platform support warrants it.

## 5. Repository shape

Use a monorepo to make client/server contracts and end-to-end tests easier to evolve.

```text
mosaic/
  apps/
    web/                    # Next.js web/PWA client
    api/                    # FastAPI service
    worker/                 # background processing entrypoints
  packages/
    contracts/              # versioned JSON Schema/OpenAPI-generated TS types
    ui/                     # shared presentational components (optional initially)
    config/                 # lint/format/tsconfig shared configuration
  infra/
    compose/                # Docker Compose for local development
    coturn/                 # safe development TURN configuration
  docs/
    PROJECT_SPEC.md
    SYSTEM_DESIGN.md
    UI_UX_SPEC.md
    AGENTS.md
  tests/
    e2e/                    # Playwright multi-context tests
  .env.example
```

Keep business rules in the API service. The web client may validate for fast feedback but cannot be the only enforcement point.

## 6. Domain model

All IDs are ULIDs or UUIDv7 generated server-side unless a client-generated ID is explicitly required for an offline mutation. Timestamps are UTC ISO 8601 at API boundaries and `timestamptz` in PostgreSQL.

### 6.1 Core entities

| Entity          | Purpose                                      | Important fields                                                                                                              |
| --------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| User            | Account-level identity                       | id, email (optional for scoped guest), display_name, avatar_asset_id, created_at, status                                      |
| DeviceSession   | Browser/device session                       | id, user_id, session_id, device_label, last_seen_at, revoked_at                                                               |
| Space           | Shared event environment                     | id, slug/code, title, description, template, cover_asset_id, status, created_by, starts_at, ends_at, created_at, completed_at |
| Membership      | User’s access inside a Space                 | space_id, user_id, role, joined_at, removed_at, notification preferences                                                      |
| Invite          | Revocable invite capability                  | id, space_id, token_hash, mode, role_on_join, expires_at, max_uses, uses_count, revoked_at                                    |
| Artifact        | Common representation for shared content     | id, space_id, kind, creator_id, status, visibility, payload/version, created_at, updated_at, deleted_at                       |
| MediaAsset      | File stored in object storage                | id, owner_id, bucket_key, original_filename, mime_type, byte_size, checksum_sha256, processing_status, metadata               |
| ActivityEvent   | Immutable, human-meaningful Space event      | id, space_id, type, actor_id, artifact_id nullable, payload, occurred_at, sequence                                            |
| MutationReceipt | Idempotency and reconciliation record        | actor_id, client_mutation_id, operation, request_hash, outcome, resource_id, created_at, expires_at                           |
| PeerConnection  | Ephemeral authorization/audit record         | id, space_id, initiator_session_id, recipient_session_id, purpose, state, expires_at, completed_at                            |
| Transfer        | Auditable direct or fallback transfer intent | id, space_id, artifact_id, sender_id, recipient_id, transport, status, size, checksum, started_at, completed_at, failure_code |

### 6.2 Artifact kinds

The `Artifact` table uses a constrained `kind` enum and a versioned `payload` document. Do not create independent ad-hoc tables for every simple activity in the MVP.

| Kind        | Payload highlights                                                             |
| ----------- | ------------------------------------------------------------------------------ |
| `message`   | text, reply_to_artifact_id nullable                                            |
| `media`     | asset_id, caption nullable, capture_time nullable                              |
| `file`      | asset_id, description nullable                                                 |
| `poll`      | question, options, closes_at nullable, is_closed                               |
| `checklist` | title, item data; items may be normalized later if concurrent edits require it |
| `system`    | reserved for generated notices; clients may not create this kind               |

For MVP simplicity, poll votes are stored in a normalized `poll_votes` table with unique `(poll_artifact_id, user_id)`; checklist items are stored in `checklist_items` with stable IDs and independent `updated_at` fields. This prevents whole-document overwrites during common concurrent edits.

### 6.3 Required relational constraints

- `memberships(space_id, user_id)` is unique where `removed_at IS NULL`.
- `invites.token_hash` is unique; the raw token is never persisted.
- `mutation_receipts(actor_id, client_mutation_id)` is unique.
- `poll_votes(poll_artifact_id, user_id)` is unique.
- `activity_events(space_id, sequence)` is unique and monotonically assigned inside a transaction.
- Every content row containing `space_id` has an indexed authorization path through current membership.
- Soft deletion is only for records that need audit/recovery. Object bytes are removed through a controlled retention worker, not ad-hoc request handlers.

## 7. Authoritative state and event model

### 7.1 Write path

Each state-changing request carries a required `X-Client-Mutation-Id` UUID generated once by the client and stored with the queued action.

```text
Client action
  → validate local input
  → persist queued/optimistic action in IndexedDB
  → HTTP/WS mutation with X-Client-Mutation-Id
  → API authenticates + authorizes + validates
  → single DB transaction:
       apply domain change
       allocate Space sequence
       insert ActivityEvent (when user-meaningful)
       insert MutationReceipt
  → commit
  → publish compact realtime event after commit
  → return authoritative resource + receipt
  → client marks queue record confirmed and reconciles cache
```

If a duplicate mutation ID arrives with the same actor and request fingerprint, return the original receipt/outcome. If the same ID has a different fingerprint, return `409 idempotency_key_reused` and do not apply it.

### 7.2 Activity ordering

- `occurred_at` records server receipt time; client-provided capture time is separate metadata.
- `sequence` is an increasing integer unique per Space. It provides deterministic order for the timeline and WebSocket catch-up.
- A PostgreSQL transaction allocates the next sequence by locking/updating a per-Space counter. Do not derive the sequence from client clocks.
- Event delivery may arrive out of order. Clients deduplicate by event ID and render/reconcile by sequence.

### 7.3 Event envelope

All server-to-client Space events use this shape:

```json
{
  "event_id": "01J...",
  "space_id": "01J...",
  "sequence": 42,
  "type": "artifact.created",
  "occurred_at": "2026-08-31T12:00:00Z",
  "actor": { "id": "01J...", "display_name": "Asha" },
  "data": { "artifact_id": "01J...", "kind": "message" }
}
```

Payloads must contain only data authorized for every current recipient of the Space channel. A client fetches the complete resource through the API if an event is intentionally compact.

### 7.4 Event types for MVP

```text
space.updated
membership.joined | membership.left | membership.removed
presence.changed
artifact.created | artifact.updated | artifact.deleted
poll.voted | poll.closed
checklist.item_updated
asset.ready | asset.failed
transfer.created | transfer.updated
peer.offer | peer.answer | peer.ice_candidate | peer.closed
space.completed
```

`peer.*` events are signaling messages and must never be added to the permanent human activity timeline.

## 8. API design

### 8.1 API rules

- Version API paths: `/api/v1/...`.
- JSON uses lower_snake_case keys. Generated client types are derived from OpenAPI; handwritten duplicate type definitions are prohibited.
- Authentication uses secure HttpOnly cookies. All unsafe requests require origin checks and CSRF protection appropriate to the selected session mechanism.
- Every mutation returns the final authoritative representation and `mutation_receipt`.
- Use standard error envelope: `{ "error": { "code", "message", "details", "request_id" } }`.
- Never expose object-store bucket keys, invite token hashes, raw peer ICE credentials, or internal stack traces.

### 8.2 HTTP endpoints (MVP)

| Method / path                                                  | Purpose                                    | Access                         |
| -------------------------------------------------------------- | ------------------------------------------ | ------------------------------ |
| `POST /auth/register`, `POST /auth/login`, `POST /auth/logout` | Account/session lifecycle                  | public/current user            |
| `GET /me`                                                      | Current identity/session                   | signed in                      |
| `POST /spaces`                                                 | Create a Space                             | signed in                      |
| `GET /spaces`                                                  | Current user’s Spaces                      | signed in                      |
| `GET /spaces/{space_id}`                                       | Space metadata and current role            | current member                 |
| `PATCH /spaces/{space_id}`                                     | Host updates permitted metadata/status     | Host                           |
| `POST /spaces/{space_id}/invites`                              | Create/rotate invite                       | Host                           |
| `POST /invites/{token}/preview`                                | Safe Space preview before joining          | valid invite                   |
| `POST /invites/{token}/join`                                   | Create membership/session context          | valid invite                   |
| `GET /spaces/{space_id}/members`                               | Membership list                            | current member                 |
| `DELETE /spaces/{space_id}/members/{user_id}`                  | Remove member                              | Host                           |
| `GET /spaces/{space_id}/activity?after_sequence=`              | Cursor-based event catch-up                | current member                 |
| `GET /spaces/{space_id}/artifacts`                             | Paginated artifact views                   | current member                 |
| `POST /spaces/{space_id}/messages`                             | Create message artifact                    | current member                 |
| `POST /spaces/{space_id}/polls`                                | Create poll                                | current member                 |
| `POST /polls/{artifact_id}/vote`                               | Cast/replace permitted vote                | current member                 |
| `POST /polls/{artifact_id}/close`                              | Close poll                                 | Host/creator policy            |
| `POST /spaces/{space_id}/checklists`                           | Create checklist                           | current member                 |
| `PATCH /checklist-items/{item_id}`                             | Update/check one checklist item            | current member                 |
| `POST /spaces/{space_id}/assets/initiate`                      | Validate and create signed upload plan     | current member                 |
| `POST /assets/{asset_id}/complete`                             | Verify completed upload / queue processing | uploader/current member        |
| `GET /assets/{asset_id}/download`                              | Authorized short-lived download URL        | current member with access     |
| `POST /spaces/{space_id}/transfers`                            | Create authorized direct-transfer intent   | current member                 |
| `PATCH /transfers/{transfer_id}`                               | Report transport status/receipt            | authorized sender/recipient    |
| `POST /spaces/{space_id}/complete`                             | Complete Space                             | Host                           |
| `GET /spaces/{space_id}/export`                                | Request/retrieve export                    | current member, scoped content |

Large file bytes go directly from client to private object storage through short-lived signed multipart URLs. They never pass through the API process after `initiate` validation.

### 8.3 WebSocket protocol

Open one authenticated socket per active client session:

```text
wss://api.example.com/api/v1/realtime
```

The client sends a `hello` message containing its device session ID, application version, and last known sequence for each active Space. The server returns a `welcome`, then delivers missing events or directs the client to use cursor catch-up.

Client messages:

```json
{ "type": "subscribe", "space_id": "01J...", "after_sequence": 37 }
{ "type": "presence.heartbeat", "space_id": "01J..." }
{ "type": "peer.offer", "connection_id": "01J...", "to_session_id": "01J...", "sdp": "..." }
{ "type": "peer.answer", "connection_id": "01J...", "to_session_id": "01J...", "sdp": "..." }
{ "type": "peer.ice_candidate", "connection_id": "01J...", "to_session_id": "01J...", "candidate": { } }
```

Server behavior:

- Authenticate socket before subscribing.
- Verify active Space membership for every subscribe and every peer signal.
- Enforce message schema, maximum size, type-specific rate limits, and connection expiry.
- Publish durable activity through Redis fan-out after database commit.
- Store presence as Redis leases (`space:{id}:presence:{session_id}`) with a 45-second TTL refreshed by heartbeat or observed socket traffic.
- On reconnect, clients must reconcile through sequence/cursor rather than assume WebSocket messages were complete.

## 9. Media upload and delivery

### 9.1 Cloud-backed artifact upload flow

1. Client obtains file metadata locally: name, byte length, MIME hint, and SHA-256 while streaming where practical.
2. Client calls `assets/initiate` with metadata and a mutation ID.
3. API checks membership, role, Space quota, file policy, and allowed MIME/type; creates a `MediaAsset` in `pending_upload` status.
4. API returns short-lived single/multipart signed upload URL(s) and required headers.
5. Client uploads directly to object storage, displaying progress.
6. Client calls `assets/{id}/complete`; API verifies storage-side metadata/checksum where available and enqueues processing.
7. Worker extracts safe metadata and generates a thumbnail where applicable. It marks asset `ready` or `failed`.
8. Client creates/updates the artifact reference only after the asset is usable, or the API atomically creates a pending artifact if the product flow demands it.

The exact max file sizes begin conservatively (for example 100 MB for MVP direct uploads and 250 MB for approved direct-transfer experiments) and are environment-configured. UI limits and API/object storage policies must match.

### 9.2 Access rules

- Original object keys are private and random; there is no publicly browsable bucket.
- Download links are generated only after an authorization check and expire quickly.
- Asset availability is independent of the contributor staying online.
- Deleting/removing membership changes future authorization immediately; background cleanup handles retention according to policy.

## 10. WebRTC direct-transfer design

### 10.1 What WebRTC is for

Phase 1 uses WebRTC DataChannels to demonstrate and provide **explicit, recipient-approved direct transfer** of a selected artifact/file between two active browsers. It is not used as the canonical transport for chat or durable Space state.

### 10.2 Preconditions

- Both members belong to the same active Space.
- Both have an active authenticated device session and a recent presence lease.
- Recipient accepts the transfer request.
- API creates a `PeerConnection` and `Transfer` with a short expiration (for example 10 minutes).
- Client receives ephemeral STUN/TURN configuration and time-limited TURN credentials after authorization.

### 10.3 Signaling sequence

```text
Sender → API: create Transfer intent (recipient, artifact/file metadata)
API → Recipient: transfer.requested realtime event
Recipient → API: accepts
API: creates authorized PeerConnection
Sender ↔ API WS ↔ Recipient: SDP offer/answer + ICE candidates
Sender ↔ Recipient: encrypted WebRTC DataChannel
Sender → Recipient: chunks + acknowledgements / completion receipt
Both → API: status updates
```

Signaling messages are ephemeral and never persisted as normal Space content. A minimal audit record stores connection/transfer outcome and reason codes, not SDP or ICE payloads.

### 10.4 Transfer protocol over DataChannel

Use a dedicated ordered, reliable DataChannel for MVP. The sender slices a file into fixed-size chunks initially around 64 KiB, adjusting only after measured browser reliability. Control messages are JSON or compact binary framing; chunk payloads are binary.

Required control records:

```text
transfer_init: transfer_id, filename, MIME, byte_size, chunk_size, sha256
chunk: index, payload
ack: highest_contiguous_index, optional missing indices
transfer_complete: sha256
receipt: verified true/false
cancel: reason
error: code, message
```

Rules:

- Limit buffered DataChannel bytes and pause reads/sends under backpressure.
- Recipient writes chunks progressively to memory/storage where browser support allows; do not accumulate arbitrary large files in RAM.
- Verify size and SHA-256 before a success receipt.
- A refresh or peer connection loss marks the transfer `interrupted`. Phase 1 may retry from the beginning; Phase 2 adds resumable ranges.
- Both parties can cancel. Cancellation does not delete an already cloud-backed artifact.
- Direct transfer of a locally selected file must show that it is not persisted to the Space unless the sender separately chooses to add it.

### 10.5 Fallback behavior

| Condition                          | User-visible result                    | System behavior                                            |
| ---------------------------------- | -------------------------------------- | ---------------------------------------------------------- |
| Recipient declines                 | “Recipient declined transfer”          | Close intent; audit outcome.                               |
| Peer not present                   | “Recipient is not currently available” | Offer cloud-backed Space share if user has permission.     |
| ICE/TURN cannot connect in timeout | “Direct connection unavailable”        | Offer approved upload/share route; do not imply P2P.       |
| Connection drops mid-transfer      | “Transfer interrupted”                 | Preserve outcome and offer retry; no false completion.     |
| Checksum mismatch                  | “Verification failed”                  | Discard incomplete result and offer retry.                 |
| Sender/recipient removed           | “Transfer no longer permitted”         | Server rejects signaling/status and clients close channel. |

### 10.6 WebRTC security

WebRTC media/data transport is encrypted in transit by the browser’s DTLS/SRTP stack. Mosaic still enforces application-level authorization before exposing signaling or TURN credentials. This is **not** equivalent to a full E2E encrypted content system because cloud-backed artifacts remain accessible to the backend/storage layer under the chosen service model.

## 11. Local-first behavior and synchronization

### 11.1 Client storage layers

| Layer              | Location                         | Purpose                                                              | Retention                         |
| ------------------ | -------------------------------- | -------------------------------------------------------------------- | --------------------------------- |
| UI state           | memory/client store              | open panels, transfer progress, transient socket state               | session                           |
| Query cache        | memory with optional persistence | fetched Space views                                                  | short-lived/revalidatable         |
| Mutation outbox    | IndexedDB                        | idempotent pending actions and request payloads                      | until confirmed/cancelled/expired |
| Drafts             | IndexedDB                        | unsent message/checklist/poll drafts                                 | user-controlled                   |
| Asset upload state | IndexedDB                        | upload/transfer resume metadata                                      | until completed/failed/expired    |
| PWA cache          | Cache Storage                    | approved static shell/assets, never private API responses by default | versioned                         |

### 11.2 Outbox record

```json
{
  "client_mutation_id": "uuid",
  "operation": "message.create",
  "space_id": "01J...",
  "payload": { "text": "Meet at the gate" },
  "created_at": "2026-08-31T12:00:00Z",
  "attempt_count": 0,
  "state": "queued",
  "depends_on": [],
  "last_error": null
}
```

The outbox flushes when the application becomes online, the realtime socket reconnects, or the user explicitly retries. It sends operations in dependency order. Do not rely solely on unsupported browser Background Sync.

### 11.3 Conflict strategy for Phase 1

This MVP uses **operation-based sync**, not a generalized CRDT implementation.

- **Messages and media:** append-only; no content merge problem.
- **Poll votes:** server applies last valid vote per member until poll close; unique constraint prevents duplicates.
- **Checklist item checked state:** last successful mutation wins, with `updated_at`, actor, and a visible recent change in activity.
- **Checklist text:** use optimistic version (`If-Match`/revision) or server-side `updated_at` check. On conflict, return the authoritative value and keep the user’s unsaved text as a draft for explicit resolution.
- **Space metadata:** Host-only optimistic version; conflict returns `409 stale_revision` with current resource.
- **Membership:** server policy is authoritative; a removed member cannot replay queued writes.

Phase 2 may replace selected collaboratively edited documents with CRDTs only after a concrete collaboration need is proven. Do not adopt a CRDT merely to claim offline-first status.

### 11.4 Reconciliation algorithm

On opening/reconnecting a Space:

1. Load cached view and last applied activity sequence.
2. Authenticate and fetch current Space/membership snapshot.
3. Subscribe with `after_sequence`.
4. Fetch paginated catch-up events if server indicates a gap or the WebSocket reconnect missed retention.
5. Apply deduplicated events in sequence order; invalidate/refetch affected resource views as needed.
6. Flush compatible outbox mutations.
7. Replace optimistic placeholders with authoritative IDs/representations from receipts.
8. Surface actions rejected due to permissions, expiry, or validation; preserve relevant text/drafts for user recovery.

## 12. Authentication, authorization, and privacy

### 12.1 Identity model

- Registered users authenticate with the chosen production-capable provider implementation.
- Guest participants are allowed only through a valid Space invite. A guest has a scoped account/session with a stable `user_id` and can later upgrade/claim the identity without losing artifacts.
- Session cookies are Secure, HttpOnly, and appropriately SameSite; rotate sessions on privileged security events.
- The service issues a per-browser `DeviceSession` identifier used for presence and WebRTC routing. It is not a secret authorization token.

### 12.2 Role matrix

| Action                          | Host | Curator |  Member | Removed/non-member |
| ------------------------------- | ---: | ------: | ------: | -----------------: |
| View Space/authorized artifacts |  yes |     yes |     yes |                 no |
| Share message/media/file        |  yes |     yes |     yes |                 no |
| Create poll/checklist           |  yes |     yes |     yes |                 no |
| Manage curated content          |  yes |     yes | limited |                 no |
| Invite/rotate invite            |  yes |      no |      no |                 no |
| Remove member/change roles      |  yes |      no |      no |                 no |
| Complete/archive Space          |  yes |      no |      no |                 no |
| Open direct transfer            |  yes |     yes |     yes |                 no |

The API must perform a membership lookup on every scoped request and should cache only short-lived authorization hints that are invalidated on membership changes.

### 12.3 Threats and mitigations

| Threat                       | Baseline mitigation                                                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Guessed/reused invites       | Cryptographically random invite token, stored hashed, expiry/use limits/revocation, rate limiting.                           |
| IDOR access to another Space | Authorization on every resource fetch/mutation; IDs alone grant nothing.                                                     |
| Forged WebSocket/peer signal | Cookie-authenticated socket, membership and session checks per signal, expiry, payload validation.                           |
| Malware or hostile upload    | Allowlist/size limits, private storage, processing isolation, scanning integration before broad availability where feasible. |
| XSS through content          | Escape all user text; sanitize rich output; strict Content Security Policy; never render arbitrary HTML.                     |
| CSRF/session theft           | Secure HttpOnly cookies, CSRF/origin protections, TLS, session rotation; no tokens in localStorage.                          |
| Transfer abuse               | Recipient consent, quota/rate limits, peer authorization, cancellable transfers, short-lived TURN credentials.               |
| Sensitive telemetry          | Redaction and structured event names; no raw message text/file names by default.                                             |
| Data retention surprise      | Explicit Space retention configuration and auditable deletion/export jobs.                                                   |

## 13. Background jobs

Jobs must be idempotent and safe to retry. Each job has a correlation/request ID, structured outcome, bounded retry policy, and dead-letter visibility.

| Job                | Trigger                  | Result                                               |
| ------------------ | ------------------------ | ---------------------------------------------------- |
| `asset.inspect`    | completed upload         | validates size/type, extracts safe metadata          |
| `asset.thumbnail`  | image/video asset ready  | creates preview/derived asset                        |
| `asset.scan`       | configured upload policy | integrates scanning/moderation service where enabled |
| `space.export`     | member request           | creates expiring, access-controlled export bundle    |
| `space.retention`  | schedule/status change   | archives/deletes content according to policy         |
| `invite.cleanup`   | schedule                 | expires/reconciles old invitations                   |
| `presence.cleanup` | Redis TTL event/poll     | removes stale display state if needed                |
| `ai.*` (Phase 3)   | explicit opt-in          | processes only authorized selected content           |

## 14. Operational design

### 14.1 Local development

Docker Compose starts PostgreSQL, Redis, MinIO, coturn, API, worker, and web client. Development must use HTTPS/WSS-compatible configuration when testing WebRTC/camera APIs; plain localhost exceptions are not representative of phone testing.

Required environment variables are documented in `.env.example` without secrets:

```text
DATABASE_URL
REDIS_URL
OBJECT_STORAGE_ENDPOINT
OBJECT_STORAGE_BUCKET
OBJECT_STORAGE_ACCESS_KEY
OBJECT_STORAGE_SECRET_KEY
SESSION_SECRET
APP_ORIGIN
API_ORIGIN
TURN_URL
TURN_SHARED_SECRET_OR_CREDENTIAL_PROVIDER
UPLOAD_MAX_BYTES
```

Never commit a production database URL, object-storage secret, TURN secret, private OAuth credential, or real user content.

### 14.2 Production baseline

- API and workers run as separately scalable stateless containers.
- PostgreSQL has backups and point-in-time recovery appropriate to the deployment tier.
- Redis is treated as recoverable transient infrastructure; the application recovers presence/realtime state after restart.
- Object storage uses private buckets, lifecycle rules, and versioning/recovery as policy requires.
- TURN is reachable on supported UDP/TCP/TLS transports; relay usage is monitored because it can be costly.
- TLS terminates at a trusted edge/load balancer; internal service traffic remains protected according to deployment environment.

### 14.3 Observability

Every HTTP request, WebSocket connection, queued job, direct-transfer state transition, and upload flow has a request/correlation ID.

Track, without recording private content:

- HTTP error/latency rates and database transaction failures;
- WebSocket connected users, reconnects, subscription failures, event-lag gaps;
- queue age/failure/retry counts;
- asset upload completion, processing failure, and storage usage;
- WebRTC offer/answer/ICE failure stages, connection time, relay rate, transfer completion/checksum failure;
- authorization denials and invite abuse/rate-limit events.

## 15. Performance and scaling strategy

### MVP targets

- 2–15 active users per Space.
- A few concurrent Spaces per development deployment; horizontal service scaling remains possible.
- Typical messages/events deliver to healthy connected clients in under one second under normal network conditions.
- Client retains only paginated timeline/gallery views; it does not load every artifact into memory.

### Safe growth path

1. Use Redis pub/sub and a shared WebSocket routing layer before adding multiple API instances.
2. Add database indexes based on actual query plans: `(space_id, sequence)`, active memberships, artifact lists, event cursors, asset access.
3. Use CDN/cache only for authorized derived media with signed access patterns; never cache private API responses publicly.
4. Keep peer mesh limited: direct one-to-one file transfer in MVP, bounded concurrent connections in Phase 2.
5. Split workers by media/AI/export workload before optimizing core transactional APIs.

## 16. Testing and verification

### 16.1 Test layers

| Layer       | Required coverage                                                                                                              |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Unit        | Validation, policy checks, event-sequence allocation, idempotency, outbox reducers, transfer framing/checksum.                 |
| Integration | PostgreSQL transaction behavior, migrations, Redis presence, signed upload lifecycle, API authorization.                       |
| Contract    | OpenAPI schema generation and client/server compatibility.                                                                     |
| WebSocket   | subscribe/catch-up, authorization failure, reconnect/deduplication, presence expiry, signaling routing.                        |
| E2E         | Multi-browser create/join/chat/poll/checklist/upload/complete flows.                                                           |
| WebRTC E2E  | Two independent browser contexts negotiate through real STUN/TURN test infrastructure, transfer fixture file, verify checksum. |
| Security    | Auth boundaries, invitation expiry/revocation, IDOR attempts, XSS payload handling, rate-limit behavior.                       |
| Resilience  | API/Redis socket reconnect, brief network loss, duplicate mutation replay, worker retry.                                       |

### 16.2 Mandatory end-to-end test scenarios

1. Two users join the same invite; a third, unrelated user cannot read the Space by manipulating IDs.
2. Replaying the same mutation ID creates one message and one activity event.
3. A client writes a message while offline; when connectivity returns it becomes one confirmed message or a clear rejection.
4. A host removes a member; the removed user’s REST, WebSocket subscription, asset download, and peer signal attempts are denied.
5. Five browser contexts receive a poll update and converge on the same final result.
6. A file upload is inaccessible without current membership and becomes available only after valid completion/processing.
7. A direct transfer completes and validates checksum; a forced disconnect becomes `interrupted`, not `completed`.
8. The Space activity feed catches up exactly after a dropped WebSocket connection.

## 17. Build order

Implement in vertical slices. Do not start P2P or AI before durable Space foundations exist.

1. **Foundation:** monorepo, local Compose services, authentication/session skeleton, migration pipeline, health checks, typed API contract.
2. **Spaces and invites:** create/list/read Space, membership, secure QR/join link flow, role enforcement.
3. **Event/realtime core:** activity event transaction model, socket subscribe/catch-up, Redis presence, client timeline.
4. **Shared artifacts:** chat, polls, checklists, idempotency receipts, optimistic outbox and offline/reconnect behavior.
5. **Media:** signed upload, private delivery, processing/thumbnail baseline, gallery.
6. **Direct transfer:** transfer intent/consent, signaling, coturn, DataChannel chunking, checksum and tested failures.
7. **Completion/export:** complete Space, read-only behavior, member-scoped export, retention hooks.
8. **Hardening:** accessibility verification, security testing, observability, E2E/resilience suite, pilot deployment.

## 18. Explicit non-goals and future extension points

Phase 1 does not build a peer-to-peer database, mesh router, arbitrary cloud replacement, native background service, or generalized CRDT framework.

The design deliberately preserves extension points:

| Future capability      | Current extension point                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| Native mobile apps     | Stable HTTP/event/domain contracts; device sessions separate from user identity.           |
| Bluetooth/Wi-Fi Direct | `PeerConnection` and `Transfer` describe intent/outcome independently of WebRTC transport. |
| Resumable P2P transfer | Transfer chunk manifest, checksum, and explicit state machine.                             |
| CRDT documents         | Artifact kind/version model and operation event log.                                       |
| AI memory/search       | Private object storage, asset metadata, explicit consent/job framework.                    |
| Maps/location          | Capability/permission-aware client design and Space-scoped artifact/event model.           |
| Games/rules engine     | Realtime Space event stream and artifact kinds can introduce game state separately.        |

## 19. Open engineering decisions to resolve before production

- Select the exact session/auth provider and email delivery mechanism.
- Select a production deployment provider and managed-vs-self-hosted PostgreSQL/Redis/object storage/TURN posture.
- Specify supported browsers and minimum versions after real WebRTC/PWA testing.
- Finalize file types, quotas, retention/deletion policy, and malware-scan provider.
- Define regional legal/privacy requirements and a user-facing privacy policy.
- Decide whether direct P2P transfer source files must be separately cloud-backed before a transfer is permitted.
- Establish load targets from pilot data before designing horizontal scaling or a large peer mesh.

---

## Appendix: System behavior in one paragraph

Mosaic’s web client joins a private Space through an authenticated invitation, keeps a local queue of user intent, and synchronizes durable shared state through a FastAPI/PostgreSQL backend over HTTP and WebSockets. The backend authorizes every action, records ordered activity events transactionally, and stores media privately in object storage. When two active, authorized participants choose a direct transfer, the backend only coordinates consent and WebRTC signaling; browsers exchange encrypted DataChannel chunks directly, verify the checksum, and report the outcome truthfully. This hybrid design makes the first release dependable while proving the cooperative-device model Mosaic will expand later.
