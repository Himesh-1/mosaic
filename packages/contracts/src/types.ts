export interface UserProfile {
  id: string;
  email?: string | null;
  display_name: string;
  avatar_asset_id?: string | null;
  is_guest: boolean;
  status: string;
  created_at: string;
}

export interface DeviceSessionInfo {
  id: string;
  device_label?: string | null;
  last_seen_at: string;
  expires_at: string;
}

export interface MeResponse {
  user: UserProfile;
  session: DeviceSessionInfo;
}

export interface RegisterRequest {
  email: string;
  password: string;
  display_name: string;
  device_label?: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
  device_label?: string | null;
}

export interface GuestJoinRequest {
  display_name: string;
  device_label?: string | null;
  avatar_asset_id?: string | null;
}

export interface HealthResponse {
  status: "ok" | "degraded" | "down";
  version: string;
  environment: string;
}

export interface ReadyResponse {
  status: "ok" | "degraded" | "down";
  version: string;
  checks: Record<string, boolean>;
}

export interface ErrorDetail {
  code: string;
  message: string;
  details?: unknown;
  request_id?: string | null;
}

export interface ErrorResponse {
  error: ErrorDetail;
}

// Spaces
export interface CreateSpaceRequest {
  title: string;
  template?: string;
  description?: string | null;
  cover_color?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
}

export interface UpdateSpaceRequest {
  title?: string;
  description?: string | null;
  cover_color?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
}

export interface SpaceResponse {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  template: string;
  cover_asset_id?: string | null;
  cover_color?: string | null;
  status: string;
  created_by: string;
  starts_at?: string | null;
  ends_at?: string | null;
  created_at: string;
  completed_at?: string | null;
  current_role: "host" | "curator" | "member";
  member_count: number;
}

export interface SpaceSummary {
  id: string;
  slug: string;
  title: string;
  template: string;
  cover_color?: string | null;
  status: string;
  starts_at?: string | null;
  ends_at?: string | null;
  created_at: string;
  current_role: string;
  member_count: number;
}

export interface SpaceSummaryDetailResponse {
  space_id: string;
  title: string;
  template: string;
  status: string;
  cover_color?: string | null;
  member_count: number;
  message_count: number;
  asset_count: number;
  total_asset_bytes: number;
  poll_count: number;
  checklist_count: number;
  completed_checklist_items: number;
  starts_at?: string | null;
  ends_at?: string | null;
  created_at: string;
  completed_at?: string | null;
  duration_seconds?: number | null;
}

export interface SpaceExportResponse {
  space: SpaceResponse;
  members: Array<{
    user_id: string;
    display_name: string;
    role: string;
    joined_at: string;
  }>;
  activity_events: Array<{
    sequence: number;
    event_id: string;
    type: string;
    occurred_at: string;
    actor?: { id: string; display_name: string } | null;
    payload: Record<string, any>;
  }>;
  artifacts: Array<{
    id: string;
    type: string;
    content: Record<string, any>;
    created_by: string;
    created_at: string;
  }>;
  assets: Array<{
    id: string;
    original_name: string;
    mime_type: string;
    size_bytes: number;
    created_at: string;
  }>;
  exported_at: string;
}

// Memberships
export interface MemberProfile {
  user_id: string;
  display_name: string;
  avatar_asset_id?: string | null;
  role: "host" | "curator" | "member";
  joined_at: string;
  is_guest: boolean;
  presence_status: "online" | "away" | "offline";
}

export interface MemberListResponse {
  space_id: string;
  members: MemberProfile[];
  total_count: number;
}

// Invites
export interface CreateInviteRequest {
  mode?: string;
  role_on_join?: string;
  expires_in_hours?: number | null;
  max_uses?: number | null;
}

export interface InviteResponse {
  id: string;
  space_id: string;
  token?: string | null;
  mode: string;
  role_on_join: string;
  expires_at?: string | null;
  max_uses?: number | null;
  uses_count: number;
  revoked_at?: string | null;
  created_at: string;
  is_valid: boolean;
}

export interface InvitePreviewResponse {
  space_id: string;
  space_title: string;
  space_template: string;
  cover_color?: string | null;
  description?: string | null;
  host_display_name: string;
  starts_at?: string | null;
  ends_at?: string | null;
  member_count: number;
  is_valid: boolean;
  status_reason?:
    "active" | "expired" | "revoked" | "max_uses_reached" | string | null;
}

export interface JoinSpaceRequest {
  display_name?: string | null;
  device_label?: string | null;
}

// Activity Events & Catch-up
export interface EventActorInfo {
  id: string;
  display_name: string;
  avatar_asset_id?: string | null;
}

export interface ActivityEventResponse {
  event_id: string;
  space_id: string;
  sequence: number;
  type: string;
  occurred_at: string;
  actor: EventActorInfo;
  data: Record<string, any>;
}

export interface ActivityFeedResponse {
  space_id: string;
  events: ActivityEventResponse[];
  latest_sequence: number;
  has_more: boolean;
}

// Artifacts (Messages, Polls, Checklists)
export interface CreateMessageRequest {
  text: string;
  client_mutation_id?: string | null;
}

export interface CreatePollRequest {
  question: string;
  options: string[];
  allow_multiple?: boolean;
  client_mutation_id?: string | null;
}

export interface VotePollRequest {
  option_ids: string[];
  client_mutation_id?: string | null;
}

export interface CreateChecklistRequest {
  title: string;
  items: string[];
  client_mutation_id?: string | null;
}

export interface ToggleChecklistItemRequest {
  completed: boolean;
  client_mutation_id?: string | null;
}

export interface PollOption {
  id: string;
  label: string;
  votes: string[];
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  completed_by?: string | null;
}

export interface ArtifactResponse {
  id: string;
  space_id: string;
  type: "message" | "poll" | "checklist" | "file" | string;
  created_by: string;
  status: string;
  content: Record<string, any>;
  created_at: string;
  updated_at: string;
  creator: EventActorInfo;
}

export interface ArtifactListResponse {
  space_id: string;
  artifacts: ArtifactResponse[];
  total_count: number;
}

// Assets & Uploads
export interface SignUploadRequest {
  original_name: string;
  mime_type: string;
  size_bytes: number;
  client_mutation_id?: string | null;
}

export interface SignUploadResponse {
  asset_id: string;
  upload_url: string;
  method: string;
  headers: Record<string, string>;
  expires_in_seconds: number;
}

export interface CompleteUploadRequest {
  sha256_hash?: string | null;
  client_mutation_id?: string | null;
}

export interface AssetResponse {
  id: string;
  space_id: string;
  uploader_id: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  sha256_hash?: string | null;
  storage_key: string;
  thumbnail_key?: string | null;
  download_url?: string | null;
  status: string;
  created_at: string;
  completed_at?: string | null;
  uploader: EventActorInfo;
}

export interface AssetUrlResponse {
  asset_id: string;
  download_url: string;
  expires_in_seconds: number;
}

export interface AssetListResponse {
  space_id: string;
  assets: AssetResponse[];
  total_count: number;
}

// Direct WebRTC Transfers
export interface DirectTransferIntentRequest {
  recipient_id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  sha256_hash?: string | null;
  client_mutation_id?: string | null;
}

export interface DirectTransferResponse {
  id: string;
  space_id: string;
  sender_id: string;
  recipient_id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  sha256_hash?: string | null;
  status:
    | "pending_approval"
    | "accepted"
    | "declined"
    | "transferring"
    | "completed"
    | "failed"
    | "cancelled"
    | string;
  created_at: string;
  completed_at?: string | null;
  sender: EventActorInfo;
  recipient: EventActorInfo;
}

export interface TransferResponseAction {
  action: "accept" | "decline";
}

export interface TransferStatusUpdateRequest {
  status: "transferring" | "completed" | "failed" | "cancelled";
  error_message?: string | null;
}

export interface IceServerConfig {
  urls: string[] | string;
  username?: string | null;
  credential?: string | null;
}

export interface IceServersResponse {
  ice_servers: IceServerConfig[];
}
