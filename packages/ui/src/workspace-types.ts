export type ChannelPrivacy = "ServerReadable" | "EndToEndEncrypted";
export type NetworkExposureMode = "RelayOnly" | "Hybrid";
export type ChannelKind = "server" | "direct";
export type PresenceState = "online" | "idle" | "dnd" | "offline";
export type NotificationMode = "all" | "mentions" | "mute";
export type ThemeMode = "dark" | "light";

export type AgentCapability =
  | "ReadChannel"
  | "PostChannel"
  | "ReactChannel"
  | "ModerateChannel"
  | "DmUser"
  | "SummarizeChannel"
  | "JoinVoice"
  | "JoinVideo"
  | "StartScreenShare";

export type AgentStatus = "pending" | "approved" | "rejected";

export interface ServerRecord {
  id: string;
  name: string;
  createdAt: string;
  defaultChannelPrivacy: ChannelPrivacy;
  networkExposureMode: NetworkExposureMode;
  redactClientIp: boolean;
}

export interface ChannelRecord {
  id: string;
  serverId: string;
  name: string;
  createdAt: string;
  privacy: ChannelPrivacy;
  kind: ChannelKind;
  isThread: boolean;
  isGroupDirect?: boolean;
  participants?: string[];
}

export interface MessageReaction {
  emoji: string;
  users: string[];
}

export interface MessageRecord {
  id: string;
  channelId: string;
  author: string;
  body: string;
  createdAt: string;
  editedAt?: string;
  deletedAt?: string;
  pinnedAt?: string;
  replyToId?: string;
  threadId?: string;
  reactions: MessageReaction[];
}

export interface AgentRecord {
  id: string;
  name: string;
  purpose: string;
  capabilities: AgentCapability[];
  requestedAt: string;
  status: AgentStatus;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface AgentPolicyRecord {
  autoApproval: boolean;
  visibility: "public" | "private";
  maxEventsPerMinute: number;
}

export interface UserProfile {
  displayName: string;
}

export interface PresenceRecord {
  user: string;
  state: PresenceState;
  lastActiveAt: string;
}

export interface NotificationSettings {
  defaultServerMode: NotificationMode;
  defaultDirectMode: NotificationMode;
  channelOverrides: Record<string, NotificationMode>;
}

export interface SessionRecord {
  voiceChannelId: string | null;
  videoChannelId: string | null;
  screenShareChannelId: string | null;
}

export interface ImportReport {
  importedChannels: number;
  importedMessages: number;
  warnings: string[];
  importedAt: string;
}

export interface WorkspaceState {
  servers: ServerRecord[];
  channels: ChannelRecord[];
  messages: MessageRecord[];
  agents: AgentRecord[];
  agentPolicy: AgentPolicyRecord;
  profile: UserProfile;
  sessions: SessionRecord;
  importReport: ImportReport | null;
  selectedServerId: string | null;
  selectedChannelId: string | null;
  unread: {
    channels: Record<string, number>;
    mentions: Record<string, number>;
  };
  typing: Record<string, string[]>;
  presence: Record<string, PresenceRecord>;
  notificationSettings: NotificationSettings;
  themeMode: ThemeMode;
}
