import {
  CreateInviteRequest,
  CreateSpaceRequest,
  ErrorResponse,
  HealthResponse,
  InvitePreviewResponse,
  InviteResponse,
  JoinSpaceRequest,
  LoginRequest,
  MemberListResponse,
  MeResponse,
  ReadyResponse,
  RegisterRequest,
  SpaceResponse,
  SpaceSummary,
  SpaceSummaryDetailResponse,
  SpaceExportResponse,
  UpdateSpaceRequest,
  GuestJoinRequest,
  ActivityFeedResponse,
  CreateMessageRequest,
  CreatePollRequest,
  VotePollRequest,
  CreateChecklistRequest,
  ToggleChecklistItemRequest,
  ArtifactResponse,
  ArtifactListResponse,
  SignUploadRequest,
  SignUploadResponse,
  CompleteUploadRequest,
  AssetResponse,
  AssetUrlResponse,
  AssetListResponse,
  DirectTransferIntentRequest,
  DirectTransferResponse,
  TransferResponseAction,
  TransferStatusUpdateRequest,
  IceServersResponse,
} from "@mosaic/contracts";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

export class ApiError extends Error {
  code: string;
  details?: unknown;
  requestId?: string | null;

  constructor(message: string, code: string, details?: unknown, requestId?: string | null) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && options.body && typeof options.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    let errJson: ErrorResponse | null = null;
    try {
      errJson = await response.json();
    } catch {
      // Ignore non-json errors
    }

    if (errJson && errJson.error) {
      let message = errJson.error.message;
      if (Array.isArray(errJson.error.details) && errJson.error.details.length > 0) {
        const detailMsgs = (errJson.error.details as Array<{ msg?: string; message?: string }>)
          .map((d) => d.msg || d.message)
          .filter(Boolean);
        if (detailMsgs.length > 0) {
          message = detailMsgs.join(". ");
        }
      }

      throw new ApiError(
        message,
        errJson.error.code,
        errJson.error.details,
        errJson.error.request_id
      );
    }

    throw new ApiError(
      `HTTP request failed with status ${response.status}`,
      `http_${response.status}`
    );
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const api = {
  // Health
  getHealth: () => request<HealthResponse>("/health"),
  getReadiness: () => request<ReadyResponse>("/ready"),

  // Auth
  getMe: () => request<MeResponse>("/me"),
  register: (payload: RegisterRequest) =>
    request<MeResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  login: (payload: LoginRequest) =>
    request<MeResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  guestLogin: (payload: GuestJoinRequest) =>
    request<MeResponse>("/auth/guest", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  logout: () =>
    request<void>("/auth/logout", {
      method: "POST",
    }),

  // Spaces
  createSpace: (payload: CreateSpaceRequest) =>
    request<SpaceResponse>("/spaces", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getMySpaces: () => request<SpaceSummary[]>("/spaces"),
  getSpace: (spaceId: string) => request<SpaceResponse>(`/spaces/${spaceId}`),
  updateSpace: (spaceId: string, payload: UpdateSpaceRequest) =>
    request<SpaceResponse>(`/spaces/${spaceId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  getMembers: (spaceId: string) => request<MemberListResponse>(`/spaces/${spaceId}/members`),
  removeMember: (spaceId: string, userId: string) =>
    request<void>(`/spaces/${spaceId}/members/${userId}`, {
      method: "DELETE",
    }),
  completeSpace: (spaceId: string) =>
    request<SpaceResponse>(`/spaces/${spaceId}/complete`, {
      method: "POST",
    }),
  reopenSpace: (spaceId: string) =>
    request<SpaceResponse>(`/spaces/${spaceId}/reopen`, {
      method: "POST",
    }),
  getSpaceSummary: (spaceId: string) =>
    request<SpaceSummaryDetailResponse>(`/spaces/${spaceId}/summary`),
  exportSpace: (spaceId: string) =>
    request<SpaceExportResponse>(`/spaces/${spaceId}/export`),

  // Invites
  createInvite: (spaceId: string, payload: CreateInviteRequest = {}) =>
    request<InviteResponse>(`/spaces/${spaceId}/invites`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  previewInvite: (token: string) =>
    request<InvitePreviewResponse>(`/invites/${token}/preview`, {
      method: "POST",
    }),
  joinSpace: (token: string, payload: JoinSpaceRequest = {}) =>
    request<SpaceResponse>(`/invites/${token}/join`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // Activity
  getActivity: (spaceId: string, afterSequence: number = 0, limit: number = 50) =>
    request<ActivityFeedResponse>(
      `/spaces/${spaceId}/activity?after_sequence=${afterSequence}&limit=${limit}`
    ),

  // Artifacts
  createMessage: (spaceId: string, payload: CreateMessageRequest) =>
    request<ArtifactResponse>(`/spaces/${spaceId}/messages`, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: payload.client_mutation_id
        ? { "X-Client-Mutation-Id": payload.client_mutation_id }
        : {},
    }),

  createPoll: (spaceId: string, payload: CreatePollRequest) =>
    request<ArtifactResponse>(`/spaces/${spaceId}/polls`, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: payload.client_mutation_id
        ? { "X-Client-Mutation-Id": payload.client_mutation_id }
        : {},
    }),

  votePoll: (spaceId: string, pollId: string, payload: VotePollRequest) =>
    request<ArtifactResponse>(`/spaces/${spaceId}/polls/${pollId}/vote`, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: payload.client_mutation_id
        ? { "X-Client-Mutation-Id": payload.client_mutation_id }
        : {},
    }),

  createChecklist: (spaceId: string, payload: CreateChecklistRequest) =>
    request<ArtifactResponse>(`/spaces/${spaceId}/checklists`, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: payload.client_mutation_id
        ? { "X-Client-Mutation-Id": payload.client_mutation_id }
        : {},
    }),

  toggleChecklistItem: (
    spaceId: string,
    checklistId: string,
    itemId: string,
    payload: ToggleChecklistItemRequest
  ) =>
    request<ArtifactResponse>(`/spaces/${spaceId}/checklists/${checklistId}/items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: payload.client_mutation_id
        ? { "X-Client-Mutation-Id": payload.client_mutation_id }
        : {},
    }),

  listArtifacts: (spaceId: string, type?: string, limit: number = 50) =>
    request<ArtifactListResponse>(
      `/spaces/${spaceId}/artifacts?limit=${limit}${type ? `&type=${type}` : ""}`
    ),

  // Uploads & Assets
  signUpload: (spaceId: string, payload: SignUploadRequest) =>
    request<SignUploadResponse>(`/spaces/${spaceId}/uploads/sign`, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: payload.client_mutation_id
        ? { "X-Client-Mutation-Id": payload.client_mutation_id }
        : {},
    }),

  completeUpload: (spaceId: string, assetId: string, payload: CompleteUploadRequest = {}) =>
    request<AssetResponse>(`/spaces/${spaceId}/uploads/${assetId}/complete`, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: payload.client_mutation_id
        ? { "X-Client-Mutation-Id": payload.client_mutation_id }
        : {},
    }),

  getAssetUrl: (spaceId: string, assetId: string) =>
    request<AssetUrlResponse>(`/spaces/${spaceId}/assets/${assetId}/url`),

  listAssets: (spaceId: string, limit: number = 50) =>
    request<AssetListResponse>(`/spaces/${spaceId}/assets?limit=${limit}`),

  // WebRTC Direct Transfers
  createDirectTransferIntent: (spaceId: string, payload: DirectTransferIntentRequest) =>
    request<DirectTransferResponse>(`/spaces/${spaceId}/transfers/direct/intent`, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: payload.client_mutation_id
        ? { "X-Client-Mutation-Id": payload.client_mutation_id }
        : {},
    }),

  respondToTransfer: (spaceId: string, transferId: string, action: "accept" | "decline") =>
    request<DirectTransferResponse>(
      `/spaces/${spaceId}/transfers/direct/${transferId}/respond`,
      {
        method: "POST",
        body: JSON.stringify({ action }),
      }
    ),

  updateTransferStatus: (
    spaceId: string,
    transferId: string,
    payload: TransferStatusUpdateRequest
  ) =>
    request<DirectTransferResponse>(
      `/spaces/${spaceId}/transfers/direct/${transferId}/status`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),

  getIceServers: (spaceId: string) =>
    request<IceServersResponse>(`/spaces/${spaceId}/webrtc/ice_servers`),
};
