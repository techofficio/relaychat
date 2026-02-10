export type Timestamp = number;

export type BinaryId = string;

export type ChannelPrivacy = "ServerReadable" | "EndToEndEncrypted";

export type AgentApprovalMode = "Manual" | "Auto";

export type AgentVisibility = "Public" | "Private";

export interface AgentPolicy {
  approvalMode: AgentApprovalMode;
  visibility: AgentVisibility;
}

export interface ContentPolicy {
  allowExternalMedia: boolean;
  blockedTerms: string[];
  maxMessageLength: number;
}

export interface RateLimits {
  userEventsPerMinute: number;
  agentEventsPerMinute: number;
}

export type NetworkExposureMode = "RelayOnly" | "Hybrid";

export interface NetworkPrivacyPolicy {
  exposureMode: NetworkExposureMode;
  redactClientIp: boolean;
  retainRawIp: boolean;
  requireEnterpriseSso: boolean;
  enforceRelayForMedia: boolean;
  allowDirectCandidates: boolean;
}

export interface ServerPolicy {
  defaultChannelPrivacy: ChannelPrivacy;
  agentPolicy: AgentPolicy;
  contentPolicy: ContentPolicy;
  rateLimits: RateLimits;
  networkPrivacy: NetworkPrivacyPolicy;
}

export type EventKind =
  | "Message"
  | "Edit"
  | "Reaction"
  | "Delete"
  | "Reply"
  | "Pin"
  | "Unpin"
  | "ThreadCreate"
  | "ThreadArchive"
  | "Attachment"
  | "VoiceSessionJoin"
  | "VoiceSessionLeave"
  | "VideoSessionJoin"
  | "VideoSessionLeave"
  | "ScreenShareStart"
  | "ScreenShareStop"
  | "System";

export interface AttachmentMeta {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  contentHash: string;
}

export interface MessagePayload {
  body: string;
  replyTo?: BinaryId;
  attachments: AttachmentMeta[];
  mentions: BinaryId[];
  threadId?: BinaryId;
}

export interface EventRecord {
  id: BinaryId;
  server: BinaryId;
  channel: BinaryId;
  author: BinaryId;
  device: BinaryId;
  createdAt: Timestamp;
  kind: EventKind;
  payload?: MessagePayload;
  prev?: BinaryId;
}

export type Capability =
  | "ReadChannel"
  | "PostChannel"
  | "ReactChannel"
  | "ModerateChannel"
  | "DmUser"
  | "SummarizeChannel"
  | "JoinVoice"
  | "JoinVideo"
  | "StartScreenShare";

export interface CapabilityGrant {
  agentId: BinaryId;
  issuedBy: BinaryId;
  capabilities: Capability[];
  scopes: Array<{ type: "server" | "channel"; id: BinaryId }>;
  maxEventsPerMinute?: number;
  allowedChannels: BinaryId[];
  issuedAt: Timestamp;
  expiresAt?: Timestamp;
  reason: string;
}

export interface SyncCursor {
  server: BinaryId;
  channel: BinaryId;
  lastEvent?: BinaryId;
  updatedAt: Timestamp;
}

export interface ServerSnapshot {
  server: BinaryId;
  channels: BinaryId[];
  cursors: SyncCursor[];
  generatedAt: Timestamp;
}

export interface SyncRequest {
  requester: BinaryId;
  server: BinaryId;
  channel: BinaryId;
  cursor?: SyncCursor;
  since?: Timestamp;
}

export interface SyncResponse {
  server: BinaryId;
  channel: BinaryId;
  snapshot?: ServerSnapshot;
  events: EventRecord[];
  head?: BinaryId;
  nextCursor: SyncCursor;
}

export interface PublishEvent {
  server: BinaryId;
  event: EventRecord;
  signature: string;
  authorPublicKey: string;
}

export interface PresenceUpdate {
  server: BinaryId;
  channel?: BinaryId;
  user: BinaryId;
  state: PresenceState;
  lastActive: Timestamp;
}

export type PresenceState = "online" | "idle" | "dnd" | "offline";

export interface TypingUpdate {
  server: BinaryId;
  channel: BinaryId;
  user: BinaryId;
  typing: boolean;
  updatedAt: Timestamp;
}

export type IceCandidateType = "host" | "srflx" | "prflx" | "relay";

export interface IceCandidateRecord {
  candidate: string;
  type: IceCandidateType;
  protocol: "udp" | "tcp";
  sdpMid?: string;
  sdpMLineIndex?: number;
}

export interface MediaTransportPolicy {
  exposureMode: NetworkExposureMode;
  iceTransportPolicy: "all" | "relay";
  allowHostCandidates: boolean;
  allowSrflxCandidates: boolean;
}

export interface MediaSessionOffer {
  sessionId: string;
  serverId: BinaryId;
  channelId: BinaryId;
  mode: "voice" | "video" | "screenshare";
  sdp: string;
  candidates: IceCandidateRecord[];
  transportPolicy: MediaTransportPolicy;
}

export interface MediaSessionAnswer {
  sessionId: string;
  sdp: string;
  candidates: IceCandidateRecord[];
}

export interface IceServerConfig {
  urls: string[];
  username?: string;
  credential?: string;
}

export type DataPlaneRpc =
  | { kind: "SyncRequest"; payload: SyncRequest }
  | { kind: "SyncResponse"; payload: SyncResponse }
  | { kind: "PublishEvent"; payload: PublishEvent }
  | { kind: "Presence"; payload: PresenceUpdate }
  | { kind: "Typing"; payload: TypingUpdate }
  | { kind: "AgentRegistration"; payload: unknown }
  | { kind: "AgentApproval"; payload: unknown }
  | { kind: "AgentPolicy"; payload: unknown };

export interface RecoveryKitRequest {
  deviceId: string;
  encryptedKit: string;
}

export interface CreateServerRequest {
  name: string;
  ownerPublicKey: string;
}

export interface CreateServerResponse {
  serverId: string;
  inviteCode: string;
  networkExposureMode?: NetworkExposureMode;
}

export interface CreateInviteRequest {
  role: string;
}

export interface ImportDiscordExportRequest {
  payload: Record<string, unknown>;
}

export interface ImportDiscordExportResponse {
  importedChannels: number;
  importedMessages: number;
  warnings: string[];
}

export interface CreateMediaSessionRequest {
  serverId: BinaryId;
  channelId: BinaryId;
  mode: "voice" | "video" | "screenshare";
}

export interface CreateMediaSessionResponse {
  sessionId: string;
  transportPolicy: MediaTransportPolicy;
  iceServers: IceServerConfig[];
}

export interface SubmitMediaCandidatesRequest {
  candidates: IceCandidateRecord[];
}

export interface SubmitMediaCandidatesResponse {
  accepted: number;
  rejected: number;
  reasons: string[];
}

export interface UpsertPresenceRequest {
  user: string;
  state: PresenceState;
  channelId?: BinaryId;
  lastActive?: Timestamp;
}

export interface UpsertPresenceResponse {
  accepted: boolean;
}

export interface PresenceRecord {
  user: string;
  state: PresenceState;
  channelId?: BinaryId;
  lastActive: Timestamp;
}

export interface ListPresenceResponse {
  presence: PresenceRecord[];
}

export interface UpsertTypingRequest {
  channelId: BinaryId;
  user: string;
  typing: boolean;
  updatedAt?: Timestamp;
}

export interface UpsertTypingResponse {
  accepted: boolean;
}

export interface TypingRecord {
  user: string;
  typing: boolean;
  updatedAt: Timestamp;
}

export interface ListTypingResponse {
  channelId: BinaryId;
  typing: TypingRecord[];
}
