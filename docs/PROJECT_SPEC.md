# Mosaic — Product Specification

**Status:** Foundation specification  
**Product:** Mosaic  
**Initial release:** Web-first MVP  
**Audience:** Product builders, designers, and AI coding agents  
**Companion documents:** `SYSTEM_DESIGN.md`, `UI_UX_SPEC.md`, and `AGENTS.md` (to be created)

---

## 1. Product in one sentence

**Mosaic lets a group create a temporary, private digital space where their browsers and devices cooperate to communicate, share media and files, stay coordinated, and preserve the memory of a real-world experience.**

Examples: a college trip, birthday, hackathon, trek, festival, campus event, sports day, or a group working together in a place with poor connectivity.

Mosaic is not a generic group-chat app. Its defining idea is that a physical group can form a small, local-first digital environment around an event.

## 2. The problem

When people gather, their digital experience is fragmented:

- Photos, videos, files, notes, and plans are scattered across personal devices and multiple apps.
- Coordination happens through noisy chat groups that are not designed around the event itself.
- Sharing is slow, duplicated, and dependent on internet/cloud services.
- Useful context disappears after the event: who attended, what happened, what was shared, and where the final memories are.
- Weak or missing internet makes ordinary collaboration tools unreliable exactly when groups need them most.

People do not need another permanent social network. They need a **shared environment that exists for the life of an experience**, is easy to enter, works across nearby devices, and becomes a meaningful record afterward.

## 3. Vision

Mosaic will become a cross-platform cooperative layer for groups in the real world.

When a person creates a **Mosaic Space**, participating devices contribute to one shared environment. Depending on their capabilities and connectivity, the Space can provide communication, sharing, synchronization, coordination, discovery, games, collective memory, and local services.

The long-term principle is:

```text
People + nearby devices + shared intent = a temporary digital world
```

The product should feel less like opening several utilities and more like entering the digital counterpart of a trip, event, or gathering.

### Long-term characteristics

- **Temporary by default:** Spaces have a defined purpose and lifecycle, rather than becoming another permanent feed.
- **Local-first:** A participant can keep working during poor connectivity; the system reconciles later.
- **Device-cooperative:** Devices communicate directly when possible and use cloud infrastructure when necessary.
- **Privacy-conscious:** Participants decide who enters, what is shared, and how long it is retained.
- **Capability-aware:** The product adapts to browser, mobile, network, and device limits instead of making false promises.

## 4. Product principles

Every product decision must support these principles.

1. **A Space is the primary unit.** Features belong inside a Space; Mosaic is not a collection of unrelated tools.
2. **Join in seconds.** A QR code or short join link should let a new participant enter with minimal friction and no app installation for the web MVP.
3. **The shared experience comes before profiles.** Identity should be lightweight and contextual.
4. **Graceful connectivity beats perfect connectivity.** The product must visibly handle offline, reconnecting, and peer-unavailable states.
5. **P2P is valuable, not theatrical.** Direct device transfer is used where it improves speed, resilience, privacy, or demo value; reliable fallback is always planned.
6. **Make the group visible.** Members, presence, activity, transfers, and shared artifacts should make cooperation tangible.
7. **Earn complexity.** Do not build a feature merely because it is technically interesting. It must deepen a Space’s shared value.
8. **Preserve memory with consent.** The final Space should become a useful, exportable memory rather than locked-in data.

## 5. Users and jobs to be done

### 5.1 Space host

A host creates and configures a Space.

**Jobs:** start a shared event hub quickly; invite people; decide who can contribute; keep the group coordinated; retain a clean event record.

### 5.2 Participant

A participant joins a Space from a phone or laptop.

**Jobs:** see what is happening; share a photo, file, message, or update; receive group material; collaborate even when connectivity is weak.

### 5.3 Curator (optional role)

A curator helps organize an active or completed Space.

**Jobs:** highlight key moments, manage shared media, and help turn raw activity into a final memory.

### 5.4 Primary early use cases

- A 6–15 person trip wants one place for photos, chat, documents, locations, and decisions.
- A hackathon team needs a temporary collaboration space across laptops and phones.
- An event organizer wants attendees to join a private hub by scanning a QR code.
- A group in weak connectivity wants to keep sharing and synchronize once a connection returns.

## 6. Scope model

Mosaic is intentionally built in layers. Later phases are part of the product vision, not commitments for the first usable release.

```text
Phase 1: Web Space Foundation
    ↓
Phase 2: Cooperative Web Network
    ↓
Phase 3: Complete Event Experience
    ↓
Phase 4: Native Mobile + Nearby Networking
```

### Phase 1 — Web Space Foundation (MVP)

**Goal:** Demonstrate a real group entering one browser-based Space and sharing a live, durable experience across multiple devices.

The MVP must support the following.

| Area                         | Required behavior                                                                                                                                                                                                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Space creation               | A host creates a named, private Space with optional cover image, dates, and a simple purpose/template.                                                                                                                                                                 |
| Joining                      | A participant joins by QR code, short link, or join code; they provide a display name and optionally an avatar.                                                                                                                                                        |
| Membership                   | Hosts can see members, participant status, and remove a member. Roles are Host, Member, and optional Curator.                                                                                                                                                          |
| Home / live timeline         | The Space home shows recent shared activity in chronological order: joins, messages, uploads, polls, and important updates.                                                                                                                                            |
| Group chat                   | Members send messages in real time. Chat must work reliably through the normal realtime transport; direct P2P chat is an enhancement, not a prerequisite for message durability.                                                                                       |
| Shared gallery               | Members upload photos and small-to-medium files; everyone can view, download, and identify the contributor. Media is associated with the Space and an activity event.                                                                                                  |
| Direct sharing demonstration | When two eligible browsers are connected, a member can send a selected file directly through a peer connection, with visible connection, transfer, progress, completion, failure, and fallback states. The system must never falsely claim a direct transfer occurred. |
| Simple coordination          | Space members can create a poll and a checklist. These are deliberately minimal but prove shared state.                                                                                                                                                                |
| Presence and recovery        | Members can see active/reconnecting/offline status. A refresh or temporary disconnection must not silently lose completed actions.                                                                                                                                     |
| Local resilience             | The web client stores essential local pending work and retries or reconciles when connectivity returns.                                                                                                                                                                |
| Closing a Space              | The host can mark a Space complete. Members can view an organized summary and export/download their own accessible content.                                                                                                                                            |

#### MVP success moment

A host displays a QR code. Several people join from browsers on phones and laptops. They see each other arrive, exchange messages, add photos, vote on a poll, and transfer a file between two connected devices. If one browser briefly loses connectivity, its pending update recovers when it reconnects. At the end, the group can revisit the Space’s shared timeline and gallery.

#### Explicitly out of scope for the MVP

- Native iOS or Android applications.
- Bluetooth, Wi-Fi Direct, background mesh networking, or arbitrary multi-hop peer routing.
- Continuous background GPS tracking.
- Automatic photo ingestion from device camera rolls.
- Full expense splitting, inventory, maps, games, and AI memory search.
- End-to-end encrypted group protocol beyond the security baseline defined later.
- Large-scale public events or thousands of concurrent participants.
- A social feed, follower graph, advertising, or public discovery.

### Phase 2 — Cooperative Web Network

**Goal:** Make the cooperative-network aspect materially useful in browser constraints.

- WebRTC DataChannel mesh for eligible small groups.
- Peer capability and topology view for debugging/demo purposes.
- Resumable, chunked direct transfer with integrity checks.
- Transfer scheduling and graceful cloud fallback.
- IndexedDB-backed offline action queue and more complete synchronization.
- Optional ephemeral local cache / shared content availability indicators.
- Browser-permitted geolocation and a lightweight group map, with clear consent and foreground limitations.

### Phase 3 — Complete Event Experience

**Goal:** Turn a functional Space into a genuinely valuable event operating system and memory.

- Expenses and settlement suggestions.
- Shared packing/inventory lists and responsibility tracking.
- More flexible polls, plans, and decision history.
- Curated timeline and memory album.
- AI-assisted search, summaries, media grouping, and trip/event recap; all AI must be opt-in and disclose what content is processed.
- Offline-friendly maps/content packs where licensing and platform rules allow.
- Space templates for trips, hackathons, parties, clubs, and events.
- Lightweight collaborative, location-based experiences or games.

### Phase 4 — Native Mobile and Nearby Networking

**Goal:** Extend the same Space and protocol to device capabilities not reliably available in a browser.

- Native mobile apps using the established Mosaic identity, Space, sync, and content model.
- Better camera, notifications, local storage, GPS, and background synchronization.
- Nearby discovery and local-network options, subject to platform permissions and feasibility.
- Bluetooth/Wi-Fi Direct experiments; no claim of universal mesh support until proven across target devices.
- Multi-hop relay and device capability orchestration only after reliable test evidence.

## 7. Core domain language

Use these terms consistently in product copy, code, and future specifications.

| Term                | Meaning                                                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Mosaic**          | The overall product/platform.                                                                                         |
| **Space**           | A private, purpose-bound shared environment created for a real-world group or event.                                  |
| **Member**          | A person who has joined a Space.                                                                                      |
| **Host**            | The owner/administrator who creates or manages a Space.                                                               |
| **Artifact**        | Shared content inside a Space: media, file, message, poll, checklist item, plan, or later an expense/location/memory. |
| **Activity**        | A chronological event that records meaningful changes in a Space.                                                     |
| **Node**            | A participating browser or native device connection. A person can have more than one node.                            |
| **Peer connection** | A direct, temporary connection between two compatible nodes.                                                          |
| **Sync**            | The process of reconciling a Space’s shared state between local devices and the service.                              |
| **Space lifecycle** | Draft → Active → Completed → Archived/deleted, as permitted by retention settings.                                    |

## 8. Functional requirements

### 8.1 Space lifecycle

- A host can create a Space in under one minute.
- A Space has a title, cover/purpose, creator, creation time, lifecycle status, and member list.
- The host can create, rotate, revoke, and view invite methods.
- Joining must require a valid invite unless the host explicitly selects a public/demo mode in a future phase.
- Members can leave. Hosts can remove members. Removal immediately ends access to future content and connections; data-retention behavior must be clear.
- Completed Spaces remain readable according to the selected retention policy.

### 8.2 Identity and membership

- The MVP supports a lightweight account or guest identity model, but a participant must have a stable identity within a Space.
- Display names must be editable; identity changes produce an auditable activity if relevant.
- A person’s global profile must not be required for basic participation.
- Role-sensitive actions must be enforced by the service, not only hidden in the interface.

### 8.3 Activity and realtime behavior

- Every completed share, join, message, poll creation, checklist update, and important membership change produces an ordered activity record.
- The user interface updates promptly for connected members and clearly distinguishes optimistic/pending, delivered, and failed actions.
- Ordering should be understandable to people, even when exact device clocks differ.
- Duplicate retry actions must not create duplicate artifacts.

### 8.4 Chat, polls, and checklists

- Chat supports text messages, sender, timestamp, and delivery state in the MVP.
- Polls support a question, 2–10 options, one vote per member by default, a visible result, and a host-controlled close action.
- Checklists support create, edit, check/uncheck, assignee optional, and change attribution.
- Future richer collaboration must preserve history rather than overwriting shared state silently.

### 8.5 Media and file sharing

- A member chooses content and explicitly confirms sharing it to the Space.
- The gallery shows a preview/metadata where safely supported, owner/contributor, timestamp, transfer/upload status, and download access.
- Uploads need validation, size limits, error feedback, retry, and cancellation behavior.
- Direct peer transfer is an opt-in delivery path for a selected artifact. It must show the recipient and never expose a device to unapproved peers.
- If a peer path is unavailable, the product either uses the approved fallback path or tells the sender exactly why the transfer cannot proceed.
- File safety, retention, scanning, and limits will be made precise in `SYSTEM_DESIGN.md`; no implementation may assume user files are trusted.

### 8.6 Offline and recovery

- The MVP must not pretend that all features work offline. It must disclose current connectivity.
- Drafts and actions that can safely be queued must persist locally before retrying.
- On reconnect, queued work must be submitted once and reconciled visibly.
- Conflicts should be rare in Phase 1 because the shared features are simple. Where a conflict is possible, preserve both user inputs for resolution rather than dropping one.
- The exact sync/event strategy belongs in `SYSTEM_DESIGN.md`; product behavior above is non-negotiable.

## 9. Non-functional requirements and guardrails

### Reliability

- The MVP target is a private Space of 2–15 active members.
- A user should recover gracefully from refresh, temporary network loss, peer rejection, browser permission denial, and expired invitations.
- Persistent artifacts may not depend solely on a single participant browser being open.

### Performance

- Common user actions should feel immediate on ordinary mobile and laptop browsers over typical Wi-Fi/mobile data.
- Large media handling must provide progress and avoid blocking the app interface.
- The P2P path must use safe limits and backpressure; it must not freeze a browser attempting a large transfer.

### Privacy and security baseline

- Spaces are private by default.
- Invitations are unguessable, revocable, and scoped to a Space.
- Authorization is checked on every protected action and content retrieval.
- Collect only data required for the feature; request camera, location, and file permissions at the moment of use with a clear reason.
- Presence and location are sensitive. Location is always opt-in, clearly time-bounded, and absent from the MVP unless introduced safely in Phase 2.
- Do not use member media or content for model training or AI processing without explicit consent.
- Logs, analytics, and error reports must not expose private message/file contents by default.

### Accessibility and inclusion

- The web product must work with keyboard navigation, readable focus states, semantic controls, adequate contrast, and screen-reader labels for core workflows.
- Do not use color alone for transfer, connection, poll, or error status.
- Support narrow phone screens first as well as laptop screens.

## 10. Product boundaries and honest platform constraints

The web MVP runs in modern browsers on phones and laptops. It can use browser capabilities such as camera/file picking, IndexedDB, service workers, WebSockets, WebRTC DataChannels, and foreground geolocation where permitted.

It must **not** claim that a browser can reliably provide:

- background P2P while the page is closed;
- arbitrary multi-hop Bluetooth routing;
- universal nearby-device discovery;
- persistent background location tracking;
- unrestricted access to a device’s media library, sensors, or local network.

The design must support future native clients without requiring a change to the meaning of a Space, membership, artifact, activity, or synchronization event.

## 11. Key experience flows

### Flow A — Create and invite

1. A user selects **Create a Space**.
2. They enter a name, choose a lightweight template/purpose, and optionally add dates/cover image.
3. Mosaic creates the Space and opens its home.
4. The host chooses **Invite** and receives a QR code, link, and optional short code.
5. The host can later revoke or rotate the invite.

### Flow B — Join in seconds

1. A person scans the QR code or opens the link.
2. They see the Space name, purpose, privacy notice, and a request for display name.
3. They join; the host and existing members see a join activity.
4. The participant arrives at the Space home with a concise orientation, not a tutorial wall.

### Flow C — Share a moment

1. A member chooses **Share**.
2. They select a photo/file or compose a message/poll/checklist item.
3. Mosaic clearly states whether it will upload/sync, transfer peer-to-peer, or queue until a connection returns.
4. The artifact appears as pending, then completed or recoverably failed.
5. The group sees it in the relevant view and the activity timeline.

### Flow D — Direct peer transfer

1. A sender selects an artifact and chooses a recipient/device where direct transfer is available.
2. Both sides see an explicit connection/permission state.
3. The transfer shows progress and can be cancelled.
4. Completion includes integrity/receipt confirmation; failure offers retry or the approved fallback route.
5. The activity record describes the outcome truthfully.

### Flow E — Complete and remember

1. The host marks the Space completed.
2. Members see a final summary of participants, activity, media, polls, and checklists.
3. Each member can retrieve the artifacts they are entitled to access.
4. The Space remains read-only except for permitted curation until archived/deleted under the chosen retention policy.

## 12. Measurement and acceptance criteria

### Product measures for an MVP pilot

- At least 80% of invited test users complete joining without assistance.
- A new participant reaches useful shared content within two minutes of scanning a QR code.
- In a 5-device session, chat and activity updates visibly reach all connected participants.
- A selected direct transfer can be completed between two compatible browser peers and reports truthful status when it cannot.
- A queued supported action survives a short disconnection and is reconciled without duplicate creation.
- Test users can identify the Space’s purpose, members, current activity, and how to share content without being instructed.

### Release acceptance scenarios

The MVP is not complete until all of these work in an end-to-end demo:

1. Create a private Space; join five devices through a QR invitation.
2. Send messages, create a poll, and update a checklist; verify each becomes shared activity.
3. Upload a photo and retrieve it from another member’s device.
4. Complete one direct WebRTC file transfer and show progress/completion.
5. Simulate a short network interruption while creating a supported action; verify it has a clear pending state and eventually appears once.
6. Revoke an invitation or remove a member; verify access is denied afterward.
7. Complete the Space and show its readable summary/gallery.

## 13. Decisions already made

- **Start web-first.** The first client is a responsive browser application for laptops and phones; no native setup is required for the MVP.
- **Use a hybrid connectivity model.** Cloud-coordinated realtime behavior is the reliability baseline. Direct peer communication is introduced where browser support and conditions permit it.
- **Keep the ultimate vision cross-platform.** Native clients later extend capabilities; they do not replace the fundamental product model.
- **Prioritize a compelling distributed-systems demo.** The MVP must visibly demonstrate live collaboration, recovery, and at least one honest P2P transfer.
- **Optimize for small private groups.** Scale comes after interaction quality, reliability, and the core protocol are proven.

## 14. Deferred decisions

These must be resolved in the companion technical/design specifications before implementation that depends on them.

- Exact authentication approach and guest-to-account upgrade path.
- Database schema, event model, conflict-resolution method, and local storage model.
- Signaling service, TURN/STUN deployment, peer-connection policy, and fallback transport.
- File-size limits, object storage strategy, malware scanning, quotas, and retention defaults.
- Encryption/key-management model and legal/privacy requirements for the intended deployment region.
- Exact supported browser matrix and hosting/deployment environments.
- Whether AI capabilities process only user-selected artifacts or a Space-wide corpus.
- Visual identity, copy tone, motion, and final information architecture.

## 15. Instructions for future implementation agents

- Treat this document as the product contract. Do not expand MVP scope without recording the decision.
- Build vertically: complete create/join → membership → realtime timeline → chat → gallery → direct transfer → recovery, rather than scattering partial features across the product.
- Prefer robust, observable behavior over sophisticated but untestable networking claims.
- Preserve the domain concepts in Section 7 across APIs, storage, UI, and tests.
- Whenever a browser/platform limitation blocks a desired feature, implement an explicit degraded state and document it; do not simulate success.
- Keep later-phase modules isolated from the Phase 1 critical path.
- Update the relevant specification whenever implementation exposes a real product decision, limitation, or change in scope.

---

## Appendix: The product pitch

> **Mosaic is a temporary digital world for real-world groups.** Create a Space for a trip, event, team, or gathering; people join by scanning a QR code, then their devices work together to chat, share media and files, coordinate, and preserve the experience. Mosaic starts in the browser, remains useful through weak connectivity, and grows into a local-first, cross-platform cooperative network.
