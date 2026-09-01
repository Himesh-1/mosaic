# Mosaic — Implementation Guide for AI Agents

**Purpose:** This file is the operating contract for any AI coding agent or human contributor implementing Mosaic.  
**Project status:** Web-first MVP; no repository implementation exists yet.  
**Read this with:** `PROJECT_SPEC.md`, `SYSTEM_DESIGN.md`, and `UI_UX_SPEC.md`.

---

## 1. Start here

Mosaic is a private, web-first platform that lets small real-world groups create a temporary **Space** to share activity, messages, media, files, decisions, and a final memory of an event. It begins as a responsive browser application for phones and laptops, with reliable cloud-backed shared state and optional direct browser-to-browser file transfer using WebRTC.

Before making any product or code decision, read these documents in order:

1. `PROJECT_SPEC.md` — product purpose, MVP scope, non-goals, and acceptance criteria.
2. `SYSTEM_DESIGN.md` — architecture, data model, API/event rules, P2P behavior, security, and testing.
3. `UI_UX_SPEC.md` — navigation, screens, components, interaction states, accessibility, and responsive behavior.
4. This file — implementation workflow and guardrails.

If documents conflict, follow this precedence:

```text
User’s current explicit instruction
    ↓
PROJECT_SPEC.md  (what Mosaic is allowed/required to do)
    ↓
SYSTEM_DESIGN.md (how the system behaves technically)
    ↓
UI_UX_SPEC.md    (how the behavior is presented)
    ↓
AGENTS.md        (how work is performed)
```

Do not silently resolve a material conflict by inventing behavior. Record the issue in the relevant specification or ask for direction if it changes user-visible scope.

## 2. The MVP in one paragraph

An authenticated host creates a private Space and invites people through a QR code or link. Members join in a browser, see each other and a live shared activity timeline, chat, upload/share media, create polls and checklists, and recover supported actions after a temporary disconnection. The server provides durable authorization and shared state; an explicit, recipient-approved WebRTC DataChannel transfer demonstrates direct browser-to-browser sharing when possible. A completed Space becomes read-only but remains browsable/exportable according to its retention policy.

The MVP is for **2–15 private participants**, not a public social network, native mobile app, Bluetooth mesh, or generalized peer-to-peer database.

## 3. Non-negotiable product truths

Every implementation must preserve these truths.

- A **Space** is the primary product unit. Do not build global feeds, public discovery, followers, or an unrelated dashboard.
- The web client is phone-first and also works on laptops. No native app dependency belongs in the MVP.
- Cloud-backed services are the durable source of truth for Phase 1. WebRTC is an optional direct-delivery path, not the only copy of important shared data.
- Direct transfer is explicit and recipient-approved. Never claim a direct transfer happened if the system used an upload/fallback route.
- Browser offline support is honest: queue supported actions, show their state, and do not promise unsupported background behavior.
- Privacy and membership checks are server enforced. Hiding a button is not authorization.
- The interface must be warm and understandable. Technical network details stay behind optional diagnostics.
- Completed Spaces are read-only, not automatically deleted.

## 4. Default implementation stack

Use the stack specified in `SYSTEM_DESIGN.md` unless the user approves a documented change.

```text
apps/web       Next.js + TypeScript + PWA
apps/api       FastAPI + Pydantic + SQLAlchemy + Alembic
apps/worker    Python background worker
PostgreSQL     durable state and ordered activity events
Redis          presence, fan-out, rate limits, worker broker
S3-compatible  private object storage (MinIO locally)
WebSockets     realtime events and WebRTC signaling
WebRTC         direct DataChannel file transfer
coturn         STUN/TURN service
Docker Compose local environment
pytest/Vitest/Playwright verification
```

Use a monorepo. Keep API contracts generated from OpenAPI or another single source; never maintain divergent client/server request types by hand.

## 5. Required repository structure

When scaffolding the project, create this shape unless an existing repository has an agreed equivalent:

```text
mosaic/
  apps/
    web/
    api/
    worker/
  packages/
    contracts/
    ui/                 # optional until reuse justifies it
    config/
  infra/
    compose/
    coturn/
  docs/
    PROJECT_SPEC.md
    SYSTEM_DESIGN.md
    UI_UX_SPEC.md
    AGENTS.md
  tests/
    e2e/
  .env.example
  README.md
```

The four specifications must be copied or linked into `docs/` before meaningful implementation begins. `README.md` is a brief developer entry point; it does not replace the specifications.

## 6. Working method

### 6.1 Work in vertical slices

Implement in this sequence. Finish and verify each slice before expanding scope.

1. Repository/bootstrap, local services, health checks, formatting/lint/test commands.
2. Authentication/session foundation, Spaces, memberships, secure invite and join flow.
3. Ordered activity events, realtime subscription/catch-up, presence, responsive Space shell.
4. Messages, polls, checklists, idempotent mutation receipts, optimistic UI and outbox.
5. Private media upload, gallery, thumbnail/processing path.
6. Recipient-approved WebRTC direct transfer, TURN, checksums, truthful failure/fallback UX.
7. Complete Space, summary, export/retention hooks.
8. Security, accessibility, observability, resilience tests, pilot hardening.

Do not begin AI memory features, maps, expenses, native clients, Bluetooth, multi-hop routing, games, or full CRDT documents during the MVP unless the user explicitly changes scope.

### 6.2 Before editing

1. Inspect the current repository and existing changes.
2. Read the relevant spec sections and existing code/tests before proposing a replacement.
3. Identify the smallest coherent slice that addresses the request.
4. State assumptions only when they affect behavior or scope; otherwise make a reasonable local choice.
5. Preserve unrelated existing work. Do not reset, delete, or reformat unrelated files.

### 6.3 During implementation

- Prefer clear, boring, typed code over clever abstractions.
- Keep business policy in the API service; the web app can mirror validation for user feedback but is never authoritative.
- Add a migration for every persistent-schema change. Never rely on startup code to mutate production schema.
- Add/adjust tests with the behavior. A feature without its unhappy-path behavior is incomplete.
- Implement pending, queued, failed, permission-denied, empty, and loading states as part of the feature, not later polish.
- Use feature flags/configuration for genuinely experimental infrastructure only; do not leave permanent unfinished branches in the main UI.
- Comment why a non-obvious decision exists, especially around retries, transactions, security, or WebRTC limits. Do not comment obvious syntax.

### 6.4 Before handing off

1. Run formatting, linting, type checks, unit tests, and relevant integration/E2E tests.
2. Test a narrow phone viewport and desktop viewport for any interface change.
3. Test authorization boundaries for every new Space-scoped endpoint/action.
4. Test at least one failure/retry state for realtime, upload, or direct-transfer changes.
5. Review the diff for accidental secrets, debug output, untyped escape hatches, and unrelated edits.
6. Update the relevant spec when a real decision, limitation, or user-visible behavior has changed.
7. Report what changed, how it was verified, and any remaining known limitation.

## 7. Domain vocabulary

Use the following names consistently in code, APIs, tests, analytics, and UI. Do not invent synonyms such as `room`, `channel`, `workspace`, or `node` for the core concepts.

| Term             | Code/API guidance                                                  |
| ---------------- | ------------------------------------------------------------------ |
| Mosaic           | Product/repository namespace only.                                 |
| Space            | `space`, `space_id`; private, purpose-bound shared environment.    |
| Member           | `membership`; a user’s authorized relationship to a Space.         |
| Host             | membership role with Space management rights.                      |
| Curator          | optional future/limited membership role.                           |
| Artifact         | Shared content: message, media, file, poll, or checklist.          |
| Activity event   | Immutable human-meaningful chronological Space event.              |
| Asset            | File/blob metadata and object-storage representation.              |
| Device session   | Active browser/device identity used for presence and peer routing. |
| Peer connection  | Authorized, temporary direct connection intent.                    |
| Transfer         | Direct or fallback file-delivery attempt and outcome.              |
| Mutation receipt | Idempotency/reconciliation record for a client action.             |

## 8. API and data rules

### 8.1 All mutations are idempotent

Every state-changing client request must include a stable `X-Client-Mutation-Id` generated once. Store it with the client outbox record before attempting network delivery.

Server rule:

```text
same actor + same client mutation ID + same request fingerprint
    → return prior outcome; do not apply twice

same actor + same client mutation ID + different fingerprint
    → reject with 409 idempotency_key_reused
```

Never implement a retry by merely re-sending an untracked POST and hoping duplication does not matter.

### 8.2 Durable event rule

For a user-meaningful mutation, write the domain record, its `ActivityEvent` (when appropriate), sequence allocation, and `MutationReceipt` in **one database transaction**. Publish realtime notification only after commit.

Events have a monotonically increasing `sequence` per Space. Clients deduplicate by event ID and reconcile/catch up by sequence; they do not trust local clock ordering.

### 8.3 Authorization rule

Every API endpoint, WebSocket subscription, asset download, transfer status update, and WebRTC signal must verify the current Space membership and role on the server.

Resource IDs are not capabilities. Do not permit access because someone knows an ID, object key, or old URL.

### 8.4 Upload rule

Large file bytes go directly from the browser to private object storage through short-lived signed URLs after API validation. API processes metadata, authorization, and completion—not arbitrary media streams in its request worker.

Do not expose bucket keys, long-lived public links, or private storage credentials to clients.

### 8.5 Versioning rule

- HTTP API paths begin with `/api/v1`.
- Use OpenAPI-generated TypeScript types or an equivalent single contract source.
- Add a new optional field before making a breaking response change.
- Use migrations; do not edit an already-applied migration.

## 9. Realtime, offline, and WebRTC rules

### 9.1 Realtime

- WebSockets carry presence, compact Space events, and WebRTC signaling.
- A socket reconnect is expected, not exceptional. The client must subscribe with `after_sequence` and fetch/catch up as needed.
- Presence is ephemeral Redis-backed state, not a permanent audit fact.
- Keep WebSocket payloads schema-validated, size-bounded, rate-limited, and authorized per message.

### 9.2 Offline

- Use IndexedDB for drafts and a mutation outbox.
- A queued mutation always exposes its actual state in the UI.
- Queue only operations with a safe request payload and idempotency key. Do not queue an unsafe direct transfer as if it will resume in the background.
- On reconnect, reconcile snapshot/events before or alongside controlled outbox flushing; preserve server rejections and user drafts for recovery.
- Do not claim offline availability merely because an app shell is cached.

### 9.3 Direct file transfer

- Peer transfer begins only after sender selection, recipient identification, recipient acceptance, and server-issued authorization.
- WebRTC signaling is routed over authenticated WebSockets. Never expose arbitrary signaling between unauthenticated clients.
- Use STUN/TURN with short-lived credentials. Relay failure is a normal product state.
- Use ordered/reliable DataChannels initially, bounded chunk sizes, backpressure, cancellation, and SHA-256 verification.
- A direct transfer is complete only after recipient verification/receipt. A dropped connection is `interrupted`, never `completed`.
- Provide a clearly labeled cloud-backed Space-share fallback when applicable.
- Do not call a relay transfer “local,” “offline,” or “peer-to-peer” in user-facing text unless it actually fits that description.

## 10. Security and privacy checklist

Treat these as implementation requirements, not a future audit wish list.

- Use TLS in every non-local deployment; test HTTPS/WSS flows because device APIs and WebRTC behavior differ from localhost.
- Keep authentication credentials in Secure, HttpOnly cookies; do not put bearer secrets in localStorage.
- Apply CSRF and Origin protections to unsafe cookie-authenticated requests.
- Hash invite tokens at rest. Make them random, expirable, revocable, and rate-limited.
- Validate all request payloads with typed server-side schemas.
- Escape/sanitize user-generated text. Do not render arbitrary HTML.
- Enforce file type, size, quota, and private-object-storage policy before issuing upload URLs.
- Use least-privilege storage credentials and short-lived signed URLs.
- Do not log message bodies, invite tokens, auth cookies, storage URLs, raw file names by default, IP addresses unnecessarily, SDP, or ICE candidate data.
- Add rate limits to invite preview/join, authentication, uploads, WebSocket connection, and signaling routes.
- Test removed-member behavior across REST, WebSocket, asset download, and peer signaling.
- Ask for browser permissions at the action that needs them and explain the benefit in the UI.

## 11. UI implementation rules

`UI_UX_SPEC.md` is not optional styling guidance; it defines behavior required for a trustworthy product.

### Required principles

- Build phone-first; check at 320–360 px and a standard desktop width for each changed screen.
- Use semantic design tokens and reusable components. Do not scatter raw colors, arbitrary margins, or one-off button styles.
- The Space home is an activity view, not a generic card dashboard.
- Preserve a clear primary action: **Share**, **Join**, **Send**, **Vote**, or **Retry**, depending on context.
- Never hide a failed/queued action only in developer tools or a transient toast.
- Use accessible labels, keyboard focus, live regions, and non-color status cues from the beginning.
- Technical connection details belong in an optional expansion, not the main participant interface.

### Required state coverage per feature

Before considering a feature complete, implement:

```text
empty → loading → ready → optimistic/pending → confirmed
                         ↘ queued/offline → reconciled or recoverable failure
                         ↘ permission denied / unauthorized where relevant
```

The exact presentation comes from `UI_UX_SPEC.md`; do not invent conflicting labels.

## 12. Testing standards

### Minimum commands

Once the repository is initialized, document and maintain commands equivalent to:

```text
format / format:check
lint
typecheck
test
test:api
test:e2e
dev
```

The precise package-manager commands may evolve, but they must run from a clean clone using only documented setup steps.

### Required coverage for a completed slice

| Change type               | Minimum verification                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------------------- |
| API/domain mutation       | Unit + API/integration test for success, duplicate retry, and authorization denial.                |
| Database migration        | Fresh database migration test and upgrade from prior schema where practical.                       |
| Web UI flow               | Component/unit behavior plus Playwright or manual browser verification at phone and desktop sizes. |
| WebSocket behavior        | Subscription authorization, event delivery, reconnect/catch-up/dedupe behavior.                    |
| Media upload              | Validation, signed upload completion, private access check, failure/retry UI.                      |
| WebRTC transfer           | Two browser contexts, real signaling, successful checksum fixture, and at least one failure case.  |
| Security-sensitive change | Negative tests for the threatened authorization/validation boundary.                               |

Do not mark direct transfer finished based on mocked `RTCPeerConnection` tests alone. Keep an E2E path using real compatible browser contexts and test TURN configuration when production-like infrastructure is available.

## 13. Documentation rules

Specifications are living design decisions, not marketing documents.

Update a specification in the same change when implementation affects:

- MVP scope, a non-goal, or feature phase;
- a domain term or role policy;
- API/event/transfer contract;
- a persistence, sync, privacy, or security decision;
- user-visible navigation, state, copy, or accessibility behavior;
- a known browser limitation and its graceful fallback.

Keep updates concise and decisive. Put implementation-only details in code comments, ADRs, or developer docs—not in `PROJECT_SPEC.md`.

If a decision is provisional, mark it as such with:

```text
Status: proposed | accepted | superseded
Decision owner: <name/role>
Date: YYYY-MM-DD
```

Do not rewrite prior decisions to hide history; mark them superseded where maintaining an ADR is warranted.

## 14. Configuration and secrets

- Commit `.env.example` with variable names and safe placeholders only.
- Never commit `.env`, secrets, keys, production endpoint credentials, real invite links, production database dumps, or private user media.
- Validate required environment values at application startup and fail with a clear local-only error message.
- Keep development infrastructure isolated from production. Do not point local migrations/tests at an unknown remote database.
- Use test fixtures and generated media rather than real personal photos/files.

## 15. Definition of done

A task is done only when all applicable statements are true:

- The requested behavior matches the product/system/UI specifications.
- The happy path works end-to-end, not merely in a mocked component.
- Permission, validation, loading, offline/retry, and failure behavior are considered and implemented where relevant.
- Server-side authorization and input validation protect new access paths.
- Database changes have migrations and rollback/upgrade awareness.
- Tests appropriate to risk pass, and the exact verification run is reported.
- Phone and desktop UI are usable for user-visible changes.
- No secrets, debug-only bypasses, dead placeholder controls, or unrelated refactors were introduced.
- Relevant documentation reflects the final behavior.

## 16. How to report work

At the end of a task, give the user a short, evidence-based handoff:

```text
Outcome: what now works.
Changed: the main files/components/services affected.
Verified: exact checks/tests and result.
Notes: only real limitations, follow-up decisions, or untested external dependencies.
```

Do not claim P2P, offline, secure, accessible, or production-ready unless the corresponding behavior has been actually tested in the relevant environment.

---

## Appendix: First build prompt for an implementation agent

> Initialize the Mosaic monorepo from the four specifications in `docs/`. Implement only the first vertical slice: local Docker Compose services; the Next.js, FastAPI, and worker applications; health checks; typed API contract scaffolding; database migration setup; formatting/lint/typecheck/test scripts; and a minimal authenticated/guest-session placeholder. Do not implement Spaces, WebSockets, uploads, or WebRTC yet. Document exact local setup in the README, add a safe `.env.example`, and verify the stack starts cleanly from a fresh environment.
