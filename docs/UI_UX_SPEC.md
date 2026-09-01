# Mosaic — UI/UX Specification

**Status:** Foundation experience specification  
**Release covered:** Web-first MVP  
**Companion documents:** `PROJECT_SPEC.md` and `SYSTEM_DESIGN.md`  
**Audience:** Product designers, frontend engineers, and AI implementation agents

---

## 1. Experience goal

Mosaic should feel like entering the living digital counterpart of a real-world gathering.

It must not feel like:

- a corporate project-management dashboard;
- a generic WhatsApp/Discord clone with a few extra tabs;
- a technical network-monitoring tool;
- a social feed designed for strangers.

It should feel **warm, immediate, private, communal, and alive**. A person joining a Space should quickly understand: _who is here, what is happening, what has been shared, and what I can do next._

The interface makes collaboration and device cooperation visible without asking ordinary users to understand WebRTC, syncing, or network topology.

## 2. Design principles

1. **The Space is the place.** The Space title, people, shared activity, and current purpose are always legible.
2. **Invite, then belong.** Joining from a QR code must be a calm, one-minute flow with no technical setup.
3. **Make shared activity the home.** The landing view inside a Space is a living timeline, not an empty dashboard.
4. **One confident primary action.** On any narrow screen, the next useful action is obvious: Share, Join, Send, Vote, or Retry.
5. **Show delivery truthfully.** A user always knows whether something is sending, queued, directly transferring, uploaded, delivered, failed, or cancelled.
6. **Use progressive disclosure.** The interface is simple by default; member controls, transfer diagnostics, and advanced actions appear only when relevant.
7. **Respect personal boundaries.** Camera, file, location, notification, and peer-connection actions explain why permission is needed before asking.
8. **Design for interruptions.** Weak connectivity, a phone rotation, a page refresh, or a rejected transfer must not destroy a user’s confidence or work.
9. **Phone first, desktop enhanced.** Every core flow fits a narrow browser; laptop layouts add context, not required complexity.
10. **Leave a memory, not a mess.** When a Space ends, Mosaic helps the group revisit the experience through a clear summary and gallery.

## 3. Product personality and voice

### Personality

Mosaic is a thoughtful host: organized but never formal, technically capable but not showy, and warm without being childish.

### Voice rules

- Use plain, human language: “Sending to Riya” rather than “Initiating peer data channel.”
- Explain technical limitations as a next step: “Direct connection didn’t work. Share through this Space instead.”
- State consequences before asking for permission: “Allow camera access to add a photo to this Space.”
- Avoid blame: “Couldn’t send yet” rather than “Upload error.”
- Use friendly but restrained celebration: a small welcome when a person joins; no confetti for routine actions.

### Preferred labels

| Use             | Avoid                                     |
| --------------- | ----------------------------------------- |
| Space           | Room, channel, workspace                  |
| People          | Users, nodes (except optional debug view) |
| Share           | Submit, publish                           |
| Activity        | Event log                                 |
| Direct transfer | P2P transfer, DataChannel                 |
| Saving / queued | Sync operation pending                    |
| Connection      | Network topology                          |
| Complete Space  | Close room, terminate                     |

## 4. Primary users and device context

| User        | Typical device/context                          | Interface priority                                      |
| ----------- | ----------------------------------------------- | ------------------------------------------------------- |
| Host        | Laptop before/during event; phone in the moment | Create, invite, see people, moderate, complete Space    |
| Participant | Phone browser, possibly poor connectivity       | Join, orient, share a photo/message, see group activity |
| Contributor | Laptop or phone with a file                     | Clear media upload or direct transfer flow              |
| Curator     | Laptop after event                              | Browse media, identify highlights, view final summary   |

### Supported viewport modes

| Mode               |   Width guideline | Design behavior                                                                     |
| ------------------ | ----------------: | ----------------------------------------------------------------------------------- |
| Compact phone      |        320–599 px | Bottom navigation, full-screen sheets, one-column timeline, persistent Share button |
| Large phone/tablet |       600–1023 px | Wider cards/grid, contextual panels when useful                                     |
| Desktop            | 1024 px and above | Left Space navigation, central content, optional People/context rail                |

Support both portrait and landscape. Never require hover to discover an essential action.

## 5. Information architecture

### 5.1 Global structure

```text
Mosaic
├── Public / account area
│   ├── Landing
│   ├── Sign in / Create account
│   ├── Join invitation
│   ├── Create Space
│   └── My Spaces
│
└── Space
    ├── Home (Activity)
    ├── Chat
    ├── Gallery
    ├── Organize
    │   ├── Polls
    │   └── Checklists
    ├── People
    ├── Share (action sheet, not a permanent destination)
    └── Space settings / Complete Space
```

### 5.2 Navigation model

Use the same conceptual destinations across viewports.

| Destination | Icon concept     | Purpose                                       |
| ----------- | ---------------- | --------------------------------------------- |
| Home        | Mosaic tile/home | Live shared activity and orientation          |
| Chat        | Speech bubble    | Conversation view                             |
| Gallery     | Image stack      | Shared photos and files                       |
| Organize    | Check-circle     | Polls and checklists                          |
| People      | Group            | Members, presence, invitations, host controls |

**Desktop:** left sidebar contains Space identity and destinations. The top bar contains Space switcher/back navigation, connectivity status, and profile menu.

**Phone:** primary destinations use a bottom navigation with Home, Chat, Gallery, Organize, and People. The Share action is a central raised action button or persistent compact button above the bar; do not sacrifice a core destination for it.

### 5.3 Navigation rules

- The current Space name is always available in the header or sidebar.
- Preserve scroll position and selected filter when switching between destinations within a Space.
- Back from a deep view returns to the relevant Space destination, not an arbitrary browser history state.
- The Space’s status (`Active`, `Completing`, `Completed`) changes the header and allowed actions consistently.
- A completed Space remains browsable; contribution controls become unavailable with a helpful explanation.

## 6. Layout system

### 6.1 Desktop Space shell

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ ‹ My Spaces   [Mount Abu Trip ▾]          ◉ Connected              [You ▾]   │
├───────────────────┬───────────────────────────────────┬──────────────────────┤
│  COVER / SPACE    │                                   │                      │
│  Mount Abu Trip   │    Activity                        │  PEOPLE (optional)  │
│  12–15 Sep        │    “A shared place for the trip”  │  8 here now         │
│                   │                                   │  • Asha  ●          │
│  ◉ Active         │    [Share something]              │  • Riya  ●          │
│                   │                                   │  • Dev   reconnecting│
│  Home             │    Timeline cards                 │                      │
│  Chat             │    ┌─────────────────────────┐    │  [Invite people]    │
│  Gallery          │    │ Riya added 3 photos      │    │                      │
│  Organize         │    └─────────────────────────┘    │                      │
│  People           │    ┌─────────────────────────┐    │                      │
│                   │    │ Poll: When do we leave? │    │                      │
│  [Complete Space] │    └─────────────────────────┘    │                      │
└───────────────────┴───────────────────────────────────┴──────────────────────┘
```

The people rail is hidden at lower desktop widths and can be toggled. It is supplemental; all People controls remain available as a destination.

### 6.2 Phone Space shell

```text
┌──────────────────────────────┐
│ ‹  Mount Abu Trip       ◉     │
│    8 people · Active          │
├──────────────────────────────┤
│ Activity                      │
│ [Share something with group]  │
│                               │
│ Timeline cards                │
│                               │
│                       [＋]    │
├──────────────────────────────┤
│ Home  Chat  Gallery Organize People │
└──────────────────────────────┘
```

The floating/share control must not cover important content or browser UI. On small screens it opens a full-height action sheet.

### 6.3 Spacing, sizing, and touch

- Base spacing unit: 4 px. Use an 8 px rhythm for most layout gaps.
- Minimum interactive target: 44 × 44 px.
- App content max width: 1,280 px; timeline reading column: 640–760 px.
- Card corner radius: 12–16 px; sheets/dialogs: 20–24 px.
- Keep primary content at least 16 px from viewport edges on phones, 24–32 px on desktop.
- Use safe-area insets for mobile bottom navigation and sheets.

## 7. Visual design system

### 7.1 Visual direction

The visual system should evoke a mosaic without literal tile overload: soft neutral surfaces, one vivid “shared energy” accent, subtle layered shapes, and real member/media content as the primary color.

Avoid dark cyber-network visuals, gradient overload, and generic corporate blue dashboards.

### 7.2 Color tokens

Use semantic tokens in code, not raw color values. The initial palette below is a starting point and must pass contrast checks.

| Token            | Light value | Use                                     |
| ---------------- | ----------- | --------------------------------------- |
| `surface.canvas` | `#F7F7F4`   | App background                          |
| `surface.base`   | `#FFFFFF`   | Cards, sheets, inputs                   |
| `surface.subtle` | `#EEF0EB`   | Quiet sections, active hover background |
| `text.primary`   | `#1C1E1B`   | Main text                               |
| `text.secondary` | `#62675F`   | Supporting text                         |
| `border.subtle`  | `#DCE0D8`   | Low-emphasis dividers                   |
| `brand.primary`  | `#246A5A`   | Main action, links, selected navigation |
| `brand.strong`   | `#155142`   | Hover/pressed brand state               |
| `accent.sun`     | `#F3B63A`   | Warm highlight, limited use             |
| `accent.lilac`   | `#7667B4`   | Media/memory accents, limited use       |
| `status.success` | `#217A4B`   | Confirmed/success                       |
| `status.warning` | `#9A6500`   | Queued/attention                        |
| `status.danger`  | `#B42318`   | Failed/destructive                      |
| `status.info`    | `#3167A7`   | Informational states                    |

Dark mode is desirable but not an MVP blocker. If included, every semantic token must receive a tested dark equivalent; never invert raw colors mechanically.

### 7.3 Typography

Use one accessible sans-serif family available through web font loading with a robust system fallback (for example Inter or Geist + system UI).

| Role    | Size / line height | Weight  | Use                                        |
| ------- | ------------------ | ------- | ------------------------------------------ |
| Display | 28–36 / 1.15       | 650–700 | Space title on desktop, key public headers |
| H1      | 24–28 / 1.2        | 650–700 | Primary page heading                       |
| H2      | 18–20 / 1.3        | 600–650 | Section headings/card titles               |
| Body    | 15–16 / 1.5        | 400–450 | Main reading text                          |
| Meta    | 12–14 / 1.35       | 450–550 | Timestamps, status, counts                 |
| Button  | 14–16 / 1.2        | 550–650 | Interactive labels                         |

Use tabular numerals for transfer progress and time where supported. Never make body copy smaller than 14 px.

### 7.4 Component states

Every interactive component has visible default, hover (where relevant), focus-visible, pressed, disabled, loading, and error states. Keyboard focus uses a high-contrast 2 px outline with a 2 px offset; it is never removed.

## 8. Reusable component inventory

| Component              | Requirements                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| App header             | Back/switch Space, title, compact people count, connectivity chip, account actions.        |
| Space identity block   | Cover color/image, title, dates/purpose, lifecycle status.                                 |
| Avatar + presence      | Initial/avatar image, accessible name, visible status not conveyed by color alone.         |
| Status chip            | Icon + label for Connected, Reconnecting, Offline, Queued, Completed, etc.                 |
| Primary button         | Strong brand fill, direct action verb, loading state retains label context.                |
| Secondary/ghost button | Lower emphasis actions, clear focus/hover.                                                 |
| Icon button            | Tooltip/accessible label; no icon-only destructive action without confirmation.            |
| Activity card          | Actor, action, relevant content preview, timestamp, direct path to source view.            |
| Media tile             | Thumbnail/file type, creator, transfer/processing state, selection support.                |
| Composer               | Text area with send; explicit attachment/share controls; draft persistence.                |
| Bottom sheet/dialog    | Focus trap, predictable close, safe-area padding, does not hide the primary action.        |
| Toast                  | Transient confirmation only; actionable/important errors remain in context until resolved. |
| Empty state            | One sentence of meaning, one relevant action, no decorative dead end.                      |
| Skeleton               | Match final layout; never use indefinite animated shimmer for an error/offline state.      |

## 9. Detailed screens and flows

### 9.1 Public landing / My Spaces

**Purpose:** Let an existing user resume a Space or create one; tell a new visitor what Mosaic is without overwhelming them.

**Structure:**

- Simple Mosaic mark and concise headline: “A shared place for what you’re doing together.”
- Primary actions: **Create a Space** and **Join a Space**.
- Signed-in view lists active Spaces first, then completed Spaces.
- Each Space card shows cover, title, purpose/date, member count, last meaningful activity, and status.

**Empty state:**

> No Spaces yet. Create one for a trip, event, or a group working together.

Primary action: **Create your first Space**. Secondary action: **Join with an invite**.

Do not display public popularity, follower counts, or a discovery feed.

### 9.2 Create a Space

**Form pattern:** a short, single-page form with progressive optional details; do not use a multi-step wizard for the MVP.

Required:

- Space name (examples as placeholder: “Mount Abu Trip”, “Build Night”, “Riya’s Birthday”)
- Purpose/template: `Trip`, `Event`, `Team`, `Gathering`, `Custom`

Optional:

- Date range
- Short description
- Cover color/image

Primary action: **Create Space**.

After successful creation, take the host straight to the new Space home and show the Invite sheet automatically. The user should never have to hunt for a link after making a Space.

### 9.3 Invite and QR code

**Purpose:** Get a real-world group in quickly.

```text
┌──────────────────────────────┐
│ Invite to Mount Abu Trip     │
│                              │
│          [ QR CODE ]         │
│                              │
│ Scan to join in your browser │
│                              │
│ [Copy invite link]           │
│ [Share]                      │
│                              │
│ Anyone with this link can    │
│ join until you turn it off.  │
│ [Invite settings]            │
└──────────────────────────────┘
```

Rules:

- QR code always has a human-copyable link alternative.
- Copy action produces a small “Invite link copied” confirmation.
- Hosts see expiration, use limit, and active/revoked state in Invite settings.
- Rotating/revoking an invite uses a confirmation dialog explaining that old links stop working.
- Never embed secret tokens in visible UI beyond the shareable link/QR itself.

### 9.4 Join invitation

**Purpose:** Convert a scan into confident membership.

Screen order:

1. Space preview: cover, title, host display name, purpose/date, people count range, privacy reassurance.
2. Identity: display-name field; optional avatar. If signed in, prefill and allow edit.
3. Clear primary action: **Join Space**.
4. On success, show a lightweight arrival moment: “You’re in Mount Abu Trip” with two immediate choices: **See what’s happening** and **Share something**.

Invalid/revoked/expired invite states must be specific:

- “This invite has expired.”
- “This invite is no longer active.”
- “This Space has reached its invite limit.”

Each gives a non-technical next step: “Ask the host for a new link.”

### 9.5 Space Home — Activity

**Purpose:** Be the group’s shared present-tense view.

Top area:

- Space title and compact purpose/dates.
- Status chip: `Connected`, `Reconnecting`, or `Offline`.
- Member summary: avatar stack + “8 people”.
- Prominent contextual composer/trigger: **Share something with the group**.

Timeline card hierarchy:

1. High-value active content: a fresh poll, direct transfer request, or pending item needing attention.
2. Human actions: “Riya added 3 photos”, “Dev created a checklist”.
3. Messages may appear as compact summary cards on Home but full conversation belongs in Chat.
4. System notices are quiet and only shown when helpful (e.g., “An invite link was rotated” for the host).

Timeline behavior:

- New content appears live without jarring scroll jumps. If the user is reading older activity, show “3 new updates” pill to jump down.
- Filters: `All`, `Photos & files`, `Decisions`, `People` (desktop/in a sheet on phone). Do not expose filters until there is enough content to justify them.
- Each card leads to its source context: Gallery, Chat, Poll, or Checklist.

**First-use empty state:**

> Your Space is ready. Invite people, then share the first thing that matters here.

Actions: **Invite people** (primary) and **Share something** (secondary).

### 9.6 Share action sheet

Share is a key product moment. It opens from the Home trigger, gallery, and floating action button.

```text
Share with Mount Abu Trip

  [ Photo or video ]   [ File ]
  [ Message ]          [ Poll ]
  [ Checklist ]

  ───────────────
  Send directly to someone
  Fast transfer between available people
```

Rules:

- The first five actions are always visible and simple.
- `Send directly to someone` is visually secondary but distinctive, using a small connection icon and one-sentence explanation.
- No technical jargon in the first level of the sheet.
- If offline, keep actions that can be queued enabled and label them “Will send when you’re back online.” Disable direct transfer with a reason.
- If a Space is completed, replace the action sheet with a short read-only explanation and link to export/gallery.

### 9.7 Chat

**Purpose:** A focused group conversation, not the entire product.

Layout:

- Chronological message list grouped by sender/time.
- Day dividers and “new messages” divider.
- Composer anchored above phone navigation / desktop bottom edge.
- Attachment control opens the relevant Share flow; never silently uploads a chosen file.

Message state language:

| State   | Visual treatment                     | Text/interaction                                   |
| ------- | ------------------------------------ | -------------------------------------------------- |
| Sending | Subtle progress/dots by own message  | “Sending…”                                         |
| Queued  | Warning icon + no alarm color alone  | “Will send when you’re online” + retry/cancel menu |
| Sent    | No redundant label for every message | Timestamp only                                     |
| Failed  | Inline error with action             | “Couldn’t send. Retry”                             |
| Removed | Quiet placeholder                    | “Message removed” if audit policy requires it      |

MVP supports text only in chat messages. Rich reactions, threads, read receipts, and typing indicators are deferred. Presence belongs in People, not a constantly animated chat list.

### 9.8 Gallery and file browser

**Purpose:** Make shared content easy to browse, identify, and retrieve.

Desktop: responsive grid with media thumbnails and file cards. Phone: two-column media grid; files appear in a clearly labeled section/filter.

Filters:

- `All`
- `Photos`
- `Videos`
- `Files`
- `From me`

Each tile includes:

- preview or file-type icon;
- optional caption/file name (truncate safely);
- contributor name;
- date/time;
- ready/uploading/failed state where relevant.

Selecting a tile opens a full-screen/lightbox detail with:

- larger preview;
- contributor and timestamp;
- download action if authorized;
- share-to-Space context or direct-send action where relevant;
- close/back affordance reachable with keyboard and touch.

**Upload states:**

- Before selection: regular Share action.
- Uploading: per-file progress, cancel, safely continue other app use.
- Processing: “Preparing preview…”; original remains clearly not yet available if that is true.
- Ready: normal gallery display.
- Failed: inline retry or remove; no ambiguous invisible loss.

### 9.9 Polls

Polls should make group decisions feel lightweight.

Create poll sheet:

- Question (required)
- 2–10 options (minimum two visible initially)
- Optional close time
- Toggle: allow one choice only (MVP default and only supported behavior; hide toggle if no multiple-choice implementation)
- **Create poll**

Poll card:

```text
When should we leave?
● 7:00 AM       3 votes   [=====     ]
○ 8:00 AM       5 votes   [========  ]
○ After breakfast 1 vote  [=         ]

You voted: 8:00 AM       9 people voted
```

Rules:

- Vote rows are full-width touch targets.
- Results update live with a subtle number/bar transition; do not make the page jump.
- The user’s selected vote is explicit.
- Closed polls show “Final result” and no interactive controls.
- If an offline vote is queued, show it as “Your vote will be sent when you reconnect,” not as counted.

### 9.10 Checklists

**Purpose:** Let a group coordinate small shared responsibilities without becoming a complex task-management system.

Checklist view:

- Title and progress (for example `4 of 7 done`).
- Item rows with large checkbox, item text, optional assignee avatar/name, and overflow menu.
- Inline add-item input at the bottom; pressing Enter/Add creates an item.
- Recent editor/change information in a quiet subtitle when useful.

Rules:

- A checkbox toggle is optimistic but visibly returns to prior state with explanation if rejected.
- Concurrent changes must not silently erase typed item text. Use conflict sheet: “This item changed while you were editing. Keep yours as a new item or use the latest version.”
- Do not add due dates, complex projects, or nested subtasks in the MVP.

### 9.11 People and presence

**Purpose:** Make the Space feel inhabited and make basic group management clear.

Header: `People (8)` with a compact count of `here now` only when meaningful.

Member rows include avatar, display name, role (where appropriate), and accessible presence state.

| Presence     | Appearance                                                                | Meaning                              |
| ------------ | ------------------------------------------------------------------------- | ------------------------------------ |
| Here         | Green dot + “Here now” (label readable in detail)                         | Active/recent client connection      |
| Reconnecting | Neutral/amber animated but reduced-motion-safe indicator + “Reconnecting” | Client connection may return shortly |
| Away         | Muted dot + “Last seen …” if enabled                                      | Not currently active                 |
| Offline      | Muted dot + “Offline”                                                     | No recent presence lease             |

Host-only row menu: change role if supported, remove member. Removal requires confirmation naming the person and states that they lose future access. Invite control remains at top for hosts.

Privacy: Do not expose device details, IP addresses, or exact presence timestamps to ordinary members. A participant decides whether to reveal an avatar; a default initial-based avatar is valid.

### 9.12 Direct transfer

This flow is where Mosaic’s device cooperation becomes visible. It must be comprehensible to a non-technical participant.

#### Sender flow

1. Select **Send directly to someone** from Share.
2. Choose a file. Show name, size, and a note: “This sends from your device to theirs when a direct connection is available.”
3. Select a person from an availability-aware list.
4. Confirm: **Ask [Name] to receive**.
5. Sender sees `Waiting for [Name]` with cancel option.
6. Once accepted, show a focused progress screen that can minimize into a transfer chip.

#### Recipient request

```text
Riya wants to send you
campus-map.pdf · 12.4 MB

Directly from their device to yours.

[Decline]                 [Accept]
```

The request states the sender and file size before consent. No direct browser connection is attempted until acceptance.

#### Progress state

```text
Sending directly to Riya

campus-map.pdf
████████░░░░░░  62% · 7.8 MB of 12.4 MB

Keep this tab open until it finishes.
[Minimize]                              [Cancel]
```

Use a verb based on user role: `Sending` vs `Receiving`. Screen-reader text announces meaningful progress at restrained intervals, not every chunk.

#### Outcome states

| Outcome                | Copy                                               | Primary action                      |
| ---------------------- | -------------------------------------------------- | ----------------------------------- |
| Complete               | “Sent directly to Riya” / “Received from Riya”     | Done, optionally View file          |
| Recipient declines     | “Riya declined this transfer.”                     | Close                               |
| Connection unavailable | “A direct connection couldn’t be made.”            | **Share through the Space instead** |
| Interrupted            | “Transfer paused because the connection was lost.” | Retry                               |
| Verification failed    | “The file didn’t arrive correctly.”                | Retry                               |
| Cancelled              | “Transfer cancelled.”                              | Close                               |

The transfer chip, available in the header/Share sheet while active, displays a text label and progress. It never relies only on an animation or color.

### 9.13 Connectivity and offline states

Connectivity must be a persistent, calm part of the experience.

| State        | Header chip                                                 | Banner/action behavior                                                                                |
| ------------ | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Connected    | `Connected` may collapse to a dot after initial reassurance | No persistent banner                                                                                  |
| Reconnecting | `Reconnecting`                                              | Thin banner: “Trying to reconnect. Your drafts are safe.”                                             |
| Offline      | `Offline`                                                   | Banner: “You’re offline. Supported changes will send when you reconnect.” Include `View queued items` |
| Back online  | Brief `Back online` confirmation                            | Outbox begins; show a compact “Sending 3 saved changes…” item if needed                               |
| Sync issue   | `Needs attention`                                           | In-context list of failed/rejected actions with specific retry/resolve controls                       |

Do not use a generic toast as the only offline indication. Do not block browsing already-cached Space content merely because connection is lost.

### 9.14 Queued changes panel

Opened from the offline banner or user profile/Space menu.

Shows a plain list:

```text
Saved changes
• Message: “Meet at 7?” — waiting for connection
• Photo: IMG_4012.jpg — upload paused at 42%
• Vote: 8:00 AM — waiting for connection

[Retry all]    [Discard selected]
```

- Distinguish safe queued actions from actions that cannot be queued (such as live direct transfer).
- Discarding a draft/queued action requires confirmation if it would lose user-entered content.
- Failed actions say why and retain recoverable input where possible.

### 9.15 Space settings and completion

Settings are separated into clear groups: `Space details`, `Invites`, `People`, `Privacy & retention`, and `Danger zone`.

For MVP, only the host sees `Complete Space`.

Completion flow:

1. Host selects **Complete Space**.
2. Dialog explains: “People can still look back at what was shared, but new messages, uploads, polls, and checklists will be closed.”
3. Host confirms by entering/confirming the Space name for an irreversible status change.
4. Completed state replaces contribution controls with `View summary` and `Download your content` where available.

The app must not frame completion as deletion. Archiving/deletion and retention controls are separate, more explicit decisions.

### 9.16 Completed Space / Memory view

**Purpose:** Make an ended Space useful without prematurely building the full AI MemoryBox concept.

Content:

- Cover, title, dates, participant count.
- Simple stats: photos/files shared, polls decided, checklists completed.
- Featured/recent gallery strip.
- Chronological highlights from activity.
- Actions: **Browse gallery**, **View activity**, **Download your content**.

Avoid claiming an automatically generated “memory” in MVP. Phase 3 can add curated/AI-assisted stories after consent design is complete.

## 10. State model and feedback rules

### 10.1 Status hierarchy

Use feedback at the smallest level that is still visible:

1. **Field-level** validation for input mistakes.
2. **Component-level** status for upload, message, vote, or transfer progress.
3. **Page-level** empty/offline/permission states.
4. **App-level** banner only for connectivity, session, or a broad outage.
5. **Toast** only for successful low-risk confirmations or a shortcut to an already-visible status.

### 10.2 Error writing pattern

```text
What happened → what remains safe → useful next action
```

Examples:

- “Couldn’t upload this photo. It’s still on your device. Try again.”
- “This invite is no longer active. Ask the host for a new link.”
- “The checklist changed while you were editing. Your text is saved below.”
- “Direct connection unavailable. You can share this through the Space instead.”

Never show raw error codes, browser console details, or “Something went wrong” without a contextual recovery path.

### 10.3 Loading rules

- Use skeletons for anticipated content lists/grids.
- Buttons show a local spinner and retain their label or use a clear action form (for example “Creating Space…”).
- Long operations must surface progress or a stable background/minimize state.
- If a request exceeds a reasonable threshold, show a human explanation and cancel/retry route.

## 11. Permissions and privacy UX

Mosaic asks late, explains first, and gives a non-blocking alternative when possible.

| Capability         | When to ask                                               | Pre-permission explanation                                                 | Fallback                |
| ------------------ | --------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------- |
| Camera             | User selects Take photo                                   | “Allow camera access to add a photo to this Space.”                        | Choose from files       |
| Files              | User selects file/media share                             | “Choose what you want to share. Mosaic only uploads the files you select.” | Cancel                  |
| Notifications      | After user has joined/used a Space, never at first launch | “Get a heads-up when your group needs you.”                                | Keep notifications off  |
| Location (Phase 2) | User explicitly opens group map/shares location           | “Share your location with this Space while this page is open.”             | Use map without sharing |
| Peer connection    | Recipient accepts direct transfer                         | “This lets [name] send this selected file directly to you.”                | Decline/use Space share |

If the browser denies a permission, show instructions appropriate to the platform only when needed; do not dump universal technical steps prematurely.

## 12. Accessibility requirements

The MVP must meet WCAG 2.2 AA for core workflows where technically feasible.

### Required behaviors

- All functionality works with keyboard alone, including menus, sheets, QR-link alternatives, gallery lightbox, polls, checklists, and transfer controls.
- All controls have programmatic names; icon-only controls include accessible labels/tooltips.
- Focus moves predictably into dialogs/sheets and returns to the invoking control when closed.
- Status changes use appropriate live regions: assertive only for critical failures; polite for messages, upload completion, and connection changes.
- Color contrast meets AA: 4.5:1 for normal text and meaningful control text; non-text UI contrast at least 3:1.
- Presence, success, queued, and failure states use text/icon/shape as well as color.
- Media thumbnails have meaningful alt text where context exists; decorative cover art has empty alt text.
- Support 200% browser zoom/reflow without losing core actions or requiring two-dimensional scrolling at common viewports.
- Respect `prefers-reduced-motion`; avoid auto-playing media and gratuitous animations.
- Errors identify affected field/action and provide recovery.

## 13. Responsive behavior matrix

| Feature         | Compact phone                            | Desktop                                        |
| --------------- | ---------------------------------------- | ---------------------------------------------- |
| Navigation      | Bottom tabs + floating Share             | Persistent left sidebar + header controls      |
| People          | Dedicated destination/sheet              | Optional right rail + dedicated destination    |
| Share           | Full-height action sheet                 | Popover or modal, depending on flow complexity |
| Create/join     | Single-column full screen                | Centered narrow form/card                      |
| Timeline        | One-column, full-width cards             | Centered reading column with context rail      |
| Gallery         | Two-column grid / list toggle            | Adaptive 3–5 column grid                       |
| Direct transfer | Full-screen focused state; minimize chip | Side panel/dialog; persistent header chip      |
| Settings        | Full-screen route                        | Two-column settings layout where useful        |

No core decision, invitation, gallery action, or transfer control may be available on desktop only.

## 14. Design tokens for implementation

Implement semantic token names at the design-system level. Initial values can evolve without mass component rewrites.

```text
--mosaic-color-surface-canvas
--mosaic-color-surface-base
--mosaic-color-surface-subtle
--mosaic-color-text-primary
--mosaic-color-text-secondary
--mosaic-color-border-subtle
--mosaic-color-brand-primary
--mosaic-color-brand-strong
--mosaic-color-status-success
--mosaic-color-status-warning
--mosaic-color-status-danger
--mosaic-space-1 through --mosaic-space-8
--mosaic-radius-sm / md / lg
--mosaic-shadow-sm / md
--mosaic-z-header / sheet / dialog / toast
```

Components should accept semantic variants (`primary`, `secondary`, `danger`, `quiet`) rather than color props. Use CSS logical properties to make future localization/RTL support possible.

## 15. Analytics and UX instrumentation

Product analytics must be privacy-preserving and measure outcomes, not private content. Do not record message text, file names, invite tokens, precise locations, or raw peer signal data.

Suggested events:

```text
space_create_started / space_created
invite_opened / invite_copied / join_started / join_completed / join_failed
share_sheet_opened / artifact_share_started / artifact_share_completed / artifact_share_failed
poll_created / poll_voted
checklist_created / checklist_item_toggled
realtime_reconnecting / offline_shown / queued_action_created / queued_action_resolved
direct_transfer_requested / accepted / declined / connected / completed / failed (reason bucket only)
space_completed / export_requested
```

Instrument funnel steps with anonymous/authorized IDs only as retention policy permits. Review all analytics fields for data minimization before release.

## 16. Usability acceptance criteria

The design is ready for implementation only when prototypes or implemented flows demonstrate the following.

1. A first-time participant can join from a QR link, provide a name, and find the group’s activity without explanation.
2. A host can create a Space and put an invitation in front of a group within one minute.
3. On a 360 px-wide phone, a participant can share a photo, send a message, vote, and find People without horizontal overflow or hidden controls.
4. Test participants can correctly distinguish a Space upload from a direct transfer before confirming either.
5. A participant experiencing lost connectivity understands that their draft/action is saved or not saved, and knows what will happen next.
6. A recipient understands the sender, filename, file size, and direct-transfer consequence before accepting.
7. A keyboard-only user can create/join a Space, send a message, vote, update a checklist, open/close the gallery, and cancel a transfer.
8. A completed Space clearly communicates that it is read-only and still lets members find their media and activity.

## 17. Handoff instructions for implementation agents

- Build and test the Space shell, navigation, status components, and responsive behavior before implementing feature-specific pages.
- Reuse the component inventory; do not create one-off button/status patterns inside individual features.
- Connect every UI status to a real domain/transport state from `SYSTEM_DESIGN.md`. Do not hard-code “Connected,” “Sent,” or P2P success visuals.
- Implement pending, queued, failure, permission-denied, and empty states alongside the happy path, not as a later polish task.
- Keep technical diagnostics behind a clearly labeled optional “Connection details” expansion, never in primary participant flows.
- Preserve accessibility semantics and keyboard behavior through all component abstractions.
- If a technical constraint changes a user-visible behavior, update this specification and the product/system specifications together.

---

## Appendix: The visual promise

When people are together, Mosaic should make the shared moment feel more connected—not more managed. A person should be able to scan, join, see their friends arrive, add a photo or decision, watch it become part of a common story, and trust the interface even when the network is imperfect. That feeling is the benchmark for every screen and state.
