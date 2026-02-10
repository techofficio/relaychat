import type {
  AgentPolicy,
  Capability,
  CreateMediaSessionRequest,
  CreateMediaSessionResponse,
  CreateServerResponse,
  IceServerConfig,
  IceCandidateRecord,
  ImportDiscordExportResponse,
  ListPresenceResponse,
  ListTypingResponse,
  MediaTransportPolicy,
  NetworkExposureMode,
  PresenceRecord,
  PresenceState,
  UpsertPresenceRequest,
  UpsertTypingRequest
} from "@relaychat/protocol";

type Id = string;

type ServerRecord = {
  id: Id;
  name: string;
  ownerPublicKey: string;
  networkExposureMode: NetworkExposureMode;
};

type ChannelRecord = {
  id: Id;
  serverId: Id;
  name: string;
};

type MessageRecord = {
  id: Id;
  channelId: Id;
  body: string;
  author: Id;
  replyToId?: Id;
  reactions: Record<string, number>;
};

type AgentRecord = {
  id: Id;
  serverId: Id;
  name: string;
  purpose: string;
  capabilities: Capability[];
  status: "pending" | "approved" | "rejected";
};

type SessionState = {
  voiceChannelId?: Id;
  videoChannelId?: Id;
  screenShareChannelId?: Id;
};

type TypingRecord = {
  user: string;
  typing: boolean;
  updatedAt: number;
};

export type RelayChatClientOptions = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  networkExposureMode?: NetworkExposureMode;
  allowDirectPeerConnections?: boolean;
  mediaTransportPolicy?: Partial<MediaTransportPolicy>;
};

export type RegisterAgentInput = {
  serverId: Id;
  name: string;
  purpose: string;
  capabilities: Capability[];
};

export type DiscordExportPayload = Record<string, unknown>;

function makeId(prefix: string): Id {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultMediaTransportPolicy(
  networkExposureMode: NetworkExposureMode
): MediaTransportPolicy {
  if (networkExposureMode === "RelayOnly") {
    return {
      exposureMode: "RelayOnly",
      iceTransportPolicy: "relay",
      allowHostCandidates: false,
      allowSrflxCandidates: false
    };
  }

  return {
    exposureMode: "Hybrid",
    iceTransportPolicy: "all",
    allowHostCandidates: true,
    allowSrflxCandidates: true
  };
}

function parseCandidateType(candidate: string): IceCandidateRecord["type"] {
  const match = candidate.match(/\btyp\s+([a-z]+)/i);
  const raw = match?.[1]?.toLowerCase();
  if (raw === "relay" || raw === "host" || raw === "srflx" || raw === "prflx") {
    return raw;
  }
  return "host";
}

export class RelayChatClient {
  private readonly baseUrl?: string;
  private readonly fetchImpl?: typeof fetch;
  private readonly networkExposureMode: NetworkExposureMode;
  private readonly allowDirectPeerConnections: boolean;
  private readonly mediaTransportPolicy: MediaTransportPolicy;

  private servers = new Map<Id, ServerRecord>();
  private channels = new Map<Id, ChannelRecord>();
  private messages = new Map<Id, MessageRecord>();
  private agents = new Map<Id, AgentRecord>();
  private agentPolicies = new Map<Id, AgentPolicy>();
  private presenceByServer = new Map<Id, Map<string, PresenceRecord>>();
  private typingByServerChannel = new Map<Id, Map<Id, Map<string, TypingRecord>>>();
  private sessions: SessionState = {};

  constructor(options: RelayChatClientOptions = {}) {
    this.baseUrl = options.baseUrl;
    this.fetchImpl = options.fetchImpl;
    this.networkExposureMode = options.networkExposureMode ?? "RelayOnly";
    this.allowDirectPeerConnections =
      options.allowDirectPeerConnections ?? false;
    const requestedPolicy = {
      ...defaultMediaTransportPolicy(this.networkExposureMode),
      ...options.mediaTransportPolicy
    };
    this.mediaTransportPolicy =
      this.networkExposureMode === "RelayOnly"
        ? {
            exposureMode: "RelayOnly",
            iceTransportPolicy: "relay",
            allowHostCandidates: false,
            allowSrflxCandidates: false
          }
        : requestedPolicy;
  }

  async createServer(name: string, ownerPublicKey = "local-owner"): Promise<CreateServerResponse> {
    const serverId = makeId("server");
    const inviteCode = `rv-${makeId("invite")}`;

    this.servers.set(serverId, {
      id: serverId,
      name,
      ownerPublicKey,
      networkExposureMode: this.networkExposureMode
    });

    const channelId = makeId("channel");
    this.channels.set(channelId, {
      id: channelId,
      serverId,
      name: "general"
    });

    return {
      serverId,
      inviteCode,
      networkExposureMode: this.networkExposureMode
    };
  }

  getMediaTransportPolicy(): MediaTransportPolicy {
    return this.mediaTransportPolicy;
  }

  normalizeCandidate(candidate: Partial<IceCandidateRecord> & { candidate: string }): IceCandidateRecord {
    const type = candidate.type ?? parseCandidateType(candidate.candidate);
    return {
      candidate: candidate.candidate,
      type,
      protocol: candidate.protocol ?? "udp",
      sdpMid: candidate.sdpMid,
      sdpMLineIndex: candidate.sdpMLineIndex
    };
  }

  filterIceCandidates(candidates: Array<Partial<IceCandidateRecord> & { candidate: string }>): IceCandidateRecord[] {
    const normalized = candidates.map((candidate) => this.normalizeCandidate(candidate));

    if (this.mediaTransportPolicy.iceTransportPolicy === "relay") {
      return normalized.filter((candidate) => candidate.type === "relay");
    }

    return normalized.filter((candidate) => {
      if (candidate.type === "host" && !this.mediaTransportPolicy.allowHostCandidates) {
        return false;
      }
      if (candidate.type === "srflx" && !this.mediaTransportPolicy.allowSrflxCandidates) {
        return false;
      }
      return true;
    });
  }

  private ensureNoDirectPeerPath(mediaKind: "voice" | "video" | "screenshare"): void {
    if (this.networkExposureMode === "RelayOnly" && this.allowDirectPeerConnections) {
      throw new Error(`Relay-only mode cannot allow direct peer ${mediaKind} paths.`);
    }
  }

  async createChannel(serverId: Id, name: string): Promise<ChannelRecord> {
    const channel: ChannelRecord = {
      id: makeId("channel"),
      serverId,
      name
    };
    this.channels.set(channel.id, channel);
    return channel;
  }

  async sendMessage(channelId: Id, body: string, author = "local-user", replyToId?: Id): Promise<MessageRecord> {
    const message: MessageRecord = {
      id: makeId("msg"),
      channelId,
      body,
      author,
      replyToId,
      reactions: {}
    };
    this.messages.set(message.id, message);
    return message;
  }

  async editMessage(messageId: Id, body: string): Promise<MessageRecord | null> {
    const existing = this.messages.get(messageId);
    if (!existing) {
      return null;
    }

    const next = { ...existing, body };
    this.messages.set(messageId, next);
    return next;
  }

  async deleteMessage(messageId: Id): Promise<boolean> {
    return this.messages.delete(messageId);
  }

  async reactToMessage(messageId: Id, emoji: string): Promise<MessageRecord | null> {
    const existing = this.messages.get(messageId);
    if (!existing) {
      return null;
    }

    const reactions = {
      ...existing.reactions,
      [emoji]: (existing.reactions[emoji] ?? 0) + 1
    };

    const next = { ...existing, reactions };
    this.messages.set(messageId, next);
    return next;
  }

  async registerAgent(input: RegisterAgentInput): Promise<AgentRecord> {
    const agent: AgentRecord = {
      id: makeId("agent"),
      serverId: input.serverId,
      name: input.name,
      purpose: input.purpose,
      capabilities: input.capabilities,
      status: "pending"
    };
    this.agents.set(agent.id, agent);
    return agent;
  }

  async approveAgent(agentId: Id): Promise<AgentRecord | null> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return null;
    }
    const next = { ...agent, status: "approved" as const };
    this.agents.set(agentId, next);
    return next;
  }

  async rejectAgent(agentId: Id): Promise<AgentRecord | null> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return null;
    }
    const next = { ...agent, status: "rejected" as const };
    this.agents.set(agentId, next);
    return next;
  }

  async setAgentPolicy(serverId: Id, policy: AgentPolicy): Promise<AgentPolicy> {
    this.agentPolicies.set(serverId, policy);
    return policy;
  }

  async upsertPresence(serverId: Id, input: Omit<UpsertPresenceRequest, "lastActive"> & { lastActive?: number }): Promise<{ accepted: boolean }> {
    const payload: UpsertPresenceRequest = {
      ...input,
      lastActive: input.lastActive ?? Date.now()
    };

    if (this.baseUrl && this.fetchImpl) {
      const response = await this.fetchImpl(`${this.baseUrl}/v1/servers/${serverId}/presence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      return response.json();
    }

    const existing = this.presenceByServer.get(serverId) ?? new Map<string, PresenceRecord>();
    existing.set(payload.user, {
      user: payload.user,
      state: payload.state,
      channelId: payload.channelId,
      lastActive: payload.lastActive ?? Date.now()
    });
    this.presenceByServer.set(serverId, existing);
    return { accepted: true };
  }

  async listPresence(serverId: Id): Promise<ListPresenceResponse> {
    if (this.baseUrl && this.fetchImpl) {
      const response = await this.fetchImpl(`${this.baseUrl}/v1/servers/${serverId}/presence`, {
        method: "GET"
      });
      return response.json();
    }

    const index = this.presenceByServer.get(serverId);
    return {
      presence: index ? [...index.values()] : []
    };
  }

  async upsertTyping(serverId: Id, input: Omit<UpsertTypingRequest, "updatedAt"> & { updatedAt?: number }): Promise<{ accepted: boolean }> {
    const payload: UpsertTypingRequest = {
      ...input,
      updatedAt: input.updatedAt ?? Date.now()
    };

    if (this.baseUrl && this.fetchImpl) {
      const response = await this.fetchImpl(`${this.baseUrl}/v1/servers/${serverId}/typing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      return response.json();
    }

    const channels = this.typingByServerChannel.get(serverId) ?? new Map<Id, Map<string, TypingRecord>>();
    const users = channels.get(payload.channelId) ?? new Map<string, TypingRecord>();
    users.set(payload.user, {
      user: payload.user,
      typing: payload.typing,
      updatedAt: payload.updatedAt ?? Date.now()
    });
    channels.set(payload.channelId, users);
    this.typingByServerChannel.set(serverId, channels);
    return { accepted: true };
  }

  async listTyping(serverId: Id, channelId: Id): Promise<ListTypingResponse> {
    if (this.baseUrl && this.fetchImpl) {
      const response = await this.fetchImpl(
        `${this.baseUrl}/v1/servers/${serverId}/typing/${channelId}`,
        { method: "GET" }
      );
      return response.json();
    }

    const channels = this.typingByServerChannel.get(serverId);
    const users = channels?.get(channelId);
    const typing = users ? [...users.values()].filter((entry) => entry.typing) : [];
    return { channelId, typing };
  }

  async joinVoice(channelId: Id): Promise<SessionState> {
    this.ensureNoDirectPeerPath("voice");
    this.sessions = {
      ...this.sessions,
      voiceChannelId: channelId
    };
    return this.sessions;
  }

  async joinVideo(channelId: Id): Promise<SessionState> {
    this.ensureNoDirectPeerPath("video");
    this.sessions = {
      ...this.sessions,
      videoChannelId: channelId
    };
    return this.sessions;
  }

  async startScreenShare(channelId: Id): Promise<SessionState> {
    this.ensureNoDirectPeerPath("screenshare");
    this.sessions = {
      ...this.sessions,
      screenShareChannelId: channelId
    };
    return this.sessions;
  }

  async importDiscordExport(
    serverId: Id,
    payload: DiscordExportPayload
  ): Promise<ImportDiscordExportResponse> {
    if (this.baseUrl && this.fetchImpl) {
      const response = await this.fetchImpl(
        `${this.baseUrl}/v1/servers/${serverId}/import/discord-export`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload })
        }
      );
      return response.json();
    }

    const channels = Array.isArray(payload.channels) ? payload.channels.length : 0;
    const messages = Array.isArray(payload.messages) ? payload.messages.length : 0;

    return {
      importedChannels: channels,
      importedMessages: messages,
      warnings: [
        "Using local importer stub. Configure baseUrl + fetchImpl for relay-backed import."
      ]
    };
  }

  async createMediaSession(input: CreateMediaSessionRequest): Promise<CreateMediaSessionResponse> {
    this.ensureNoDirectPeerPath(input.mode);

    if (this.baseUrl && this.fetchImpl) {
      const response = await this.fetchImpl(`${this.baseUrl}/v1/media/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });
      return response.json();
    }

    return {
      sessionId: makeId("media"),
      transportPolicy: this.mediaTransportPolicy,
      iceServers: [
        { urls: ["stun:relaychat.local:3478"] },
        {
          urls: ["turn:relaychat.local:3478?transport=udp"],
          username: "relay-user",
          credential: "ephemeral-token"
        }
      ]
    };
  }

  async submitMediaCandidates(
    sessionId: string,
    candidates: Array<Partial<IceCandidateRecord> & { candidate: string }>
  ): Promise<{ accepted: number; rejected: number; reasons: string[]; candidates: IceCandidateRecord[] }> {
    const filtered = this.filterIceCandidates(candidates);
    const rejected = Math.max(candidates.length - filtered.length, 0);
    const reasons =
      rejected > 0
        ? ["Direct or non-compliant ICE candidates removed by transport policy."]
        : [];

    if (this.baseUrl && this.fetchImpl) {
      await this.fetchImpl(`${this.baseUrl}/v1/media/sessions/${sessionId}/candidates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidates: filtered })
      });
    }

    return {
      accepted: filtered.length,
      rejected,
      reasons,
      candidates: filtered
    };
  }

  sanitizeTelemetry<T extends Record<string, unknown>>(input: T): T {
    const output: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      const lowered = key.toLowerCase();
      if (lowered.includes("ip") || lowered.includes("address")) {
        continue;
      }
      output[key] = value;
    }
    return output as T;
  }

  redactCandidateForLogs(candidate: IceCandidateRecord): Omit<IceCandidateRecord, "candidate"> {
    return {
      type: candidate.type,
      protocol: candidate.protocol,
      sdpMid: candidate.sdpMid,
      sdpMLineIndex: candidate.sdpMLineIndex
    };
  }

  redactCandidatesForLogs(candidates: IceCandidateRecord[]): Array<Omit<IceCandidateRecord, "candidate">> {
    return candidates.map((candidate) => this.redactCandidateForLogs(candidate));
  }

  buildRtcConfiguration(session: CreateMediaSessionResponse): {
    iceTransportPolicy: "all" | "relay";
    iceServers: IceServerConfig[];
  } {
    return {
      iceTransportPolicy: session.transportPolicy.iceTransportPolicy,
      iceServers: session.iceServers
    };
  }

  createPeerConnectionFactory(session: CreateMediaSessionResponse): () => RTCPeerConnection {
    const rtcConfig = this.buildRtcConfiguration(session);
    return () => new RTCPeerConnection(rtcConfig);
  }
}

export type {
  AgentPolicy,
  Capability,
  IceServerConfig,
  IceCandidateRecord,
  ListPresenceResponse,
  ListTypingResponse,
  MediaTransportPolicy,
  NetworkExposureMode,
  PresenceRecord,
  PresenceState
} from "@relaychat/protocol";
