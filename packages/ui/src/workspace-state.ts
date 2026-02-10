import React from "react";

import { createBrowserWorkspacePersistence } from "./persistence";
import type { WorkspacePersistence } from "./persistence";
import {
  AgentCapability,
  AgentRecord,
  ChannelPrivacy,
  ChannelRecord,
  ImportReport,
  MessageRecord,
  NotificationMode,
  PresenceRecord,
  PresenceState,
  ServerRecord,
  WorkspaceState
} from "./workspace-types";

const STORAGE_KEY = "relaychat_workspace_v2";
const LEGACY_STORAGE_KEYS = [
  "relaychat_workspace_v1",
  "discord_replacement_workspace_v1"
];
const DEFAULT_AUTHOR = "You";
const DIRECT_SERVER_ID = "__direct__";

export const ALL_CAPABILITIES: AgentCapability[] = [
  "ReadChannel",
  "PostChannel",
  "ReactChannel",
  "ModerateChannel",
  "DmUser",
  "SummarizeChannel",
  "JoinVoice",
  "JoinVideo",
  "StartScreenShare"
];

export type SendMessageInput = {
  body: string;
  replyToId?: string;
  threadId?: string;
};

export type WorkspaceActions = {
  selectServer: (serverId: string) => void;
  selectChannel: (channelId: string) => void;
  selectDirectChannel: (channelId: string) => void;
  createServer: (name: string) => void;
  createChannel: (name: string) => void;
  createDirectMessage: (participant: string) => void;
  createGroupDirect: (name: string, participantsRaw: string) => void;
  setNotificationMode: (channelId: string, mode: NotificationMode) => void;
  setTyping: (channelId: string, actor: string, isTyping: boolean) => void;
  setPresence: (user: string, presence: PresenceState) => void;
  simulateIncomingMessage: (payload: {
    channelId?: string;
    author: string;
    body: string;
    markTyping?: boolean;
  }) => void;
  setChannelPrivacy: (channelId: string, privacy: ChannelPrivacy) => void;
  sendMessage: (input: SendMessageInput) => void;
  editMessage: (messageId: string, body: string) => void;
  deleteMessage: (messageId: string) => void;
  togglePin: (messageId: string) => void;
  createThreadFromMessage: (messageId: string, name?: string) => string | null;
  toggleReaction: (messageId: string, emoji: string) => void;
  setDisplayName: (displayName: string) => void;
  joinVoice: (channelId: string) => void;
  joinVideo: (channelId: string) => void;
  startScreenShare: (channelId: string) => void;
  leaveMediaSessions: () => void;
  importDiscordExport: (raw: string) => ImportReport | null;
  setAutoApproval: (enabled: boolean) => void;
  submitAgentRequest: (payload: {
    name: string;
    purpose: string;
    capabilities: AgentCapability[];
  }) => void;
  approveAgent: (agentId: string) => void;
  rejectAgent: (agentId: string) => void;
};

export type WorkspaceModel = {
  state: WorkspaceState;
  selectedServer: ServerRecord | null;
  visibleChannels: ChannelRecord[];
  visibleDirectChannels: ChannelRecord[];
  selectedChannel: ChannelRecord | null;
  selectedDirectChannel: ChannelRecord | null;
  channelMessages: MessageRecord[];
  pinnedMessages: MessageRecord[];
  pendingAgents: AgentRecord[];
  approvedAgents: AgentRecord[];
  unreadByChannel: Record<string, number>;
  mentionByChannel: Record<string, number>;
  typingUsers: string[];
  presenceIndex: Record<string, PresenceRecord>;
  notificationMode: NotificationMode | null;
  actions: WorkspaceActions;
};

export type WorkspaceStateOptions = {
  persistence?: WorkspacePersistence;
};

function nowIso(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function includesMention(body: string, displayName: string): boolean {
  const cleaned = displayName.trim().toLowerCase();
  if (!cleaned) {
    return false;
  }
  const normalized = body.toLowerCase();
  return normalized.includes(`@${cleaned}`) || normalized.includes(cleaned);
}

function resolveNotificationMode(
  state: Pick<WorkspaceState, "channels" | "notificationSettings">,
  channelId: string
): NotificationMode {
  const override = state.notificationSettings.channelOverrides[channelId];
  if (override) {
    return override;
  }
  const channel = state.channels.find((item) => item.id === channelId);
  if (!channel) {
    return "all";
  }
  return channel.kind === "direct"
    ? state.notificationSettings.defaultDirectMode
    : state.notificationSettings.defaultServerMode;
}

function applyIncomingUnread(
  state: WorkspaceState,
  currentUnread: WorkspaceState["unread"],
  channelId: string,
  author: string,
  body: string
): WorkspaceState["unread"] {
  if (channelId === state.selectedChannelId) {
    return currentUnread;
  }

  const self = state.profile.displayName || DEFAULT_AUTHOR;
  if (author === self) {
    return currentUnread;
  }

  const mode = resolveNotificationMode(state, channelId);
  if (mode === "mute") {
    return currentUnread;
  }

  const next = {
    channels: { ...currentUnread.channels },
    mentions: { ...currentUnread.mentions }
  };

  if (mode === "all") {
    next.channels[channelId] = (next.channels[channelId] ?? 0) + 1;
  }

  const mentioned = includesMention(body, self);
  if (mentioned && (mode === "all" || mode === "mentions")) {
    next.mentions[channelId] = (next.mentions[channelId] ?? 0) + 1;
  }

  return next;
}

function createDefaultState(): WorkspaceState {
  const createdAt = nowIso();
  const serverId = createId("server");
  const generalChannelId = createId("channel");
  const roadmapChannelId = createId("channel");
  const dmAlexId = createId("dm");
  const dmOpsId = createId("dm");

  return {
    servers: [
      {
        id: serverId,
        name: "Launchpad",
        createdAt,
        defaultChannelPrivacy: "ServerReadable",
        networkExposureMode: "RelayOnly",
        redactClientIp: true
      }
    ],
    channels: [
      {
        id: generalChannelId,
        serverId,
        name: "general",
        createdAt,
        privacy: "ServerReadable",
        kind: "server",
        isThread: false
      },
      {
        id: roadmapChannelId,
        serverId,
        name: "roadmap",
        createdAt,
        privacy: "ServerReadable",
        kind: "server",
        isThread: false
      },
      {
        id: dmAlexId,
        serverId: DIRECT_SERVER_ID,
        name: "alex",
        createdAt,
        privacy: "EndToEndEncrypted",
        kind: "direct",
        isThread: false,
        isGroupDirect: false,
        participants: [DEFAULT_AUTHOR, "Alex"]
      },
      {
        id: dmOpsId,
        serverId: DIRECT_SERVER_ID,
        name: "ops-sync",
        createdAt,
        privacy: "EndToEndEncrypted",
        kind: "direct",
        isThread: false,
        isGroupDirect: true,
        participants: [DEFAULT_AUTHOR, "Alex", "Jules", "Morgan"]
      }
    ],
    messages: [
      {
        id: createId("msg"),
        channelId: generalChannelId,
        author: "System",
        body: "Welcome to RelayChat. This workspace is local-first.",
        createdAt,
        reactions: []
      },
      {
        id: createId("msg"),
        channelId: roadmapChannelId,
        author: "System",
        body: "M1 goal: protocol + storage foundation, then sync + media.",
        createdAt,
        reactions: []
      },
      {
        id: createId("msg"),
        channelId: dmAlexId,
        author: "Alex",
        body: "Can we align on migration support this week?",
        createdAt,
        reactions: []
      }
    ],
    agents: [
      {
        id: createId("agent"),
        name: "Thread Summarizer",
        purpose: "Publish one concise daily summary to #general.",
        capabilities: ["ReadChannel", "SummarizeChannel", "PostChannel"],
        requestedAt: createdAt,
        status: "pending"
      },
      {
        id: createId("agent"),
        name: "Build Monitor",
        purpose: "Post CI failure alerts with log links.",
        capabilities: ["ReadChannel", "PostChannel"],
        requestedAt: createdAt,
        status: "approved",
        reviewedAt: createdAt,
        reviewedBy: "System"
      }
    ],
    agentPolicy: {
      autoApproval: false,
      visibility: "public",
      maxEventsPerMinute: 12
    },
    profile: {
      displayName: DEFAULT_AUTHOR
    },
    sessions: {
      voiceChannelId: null,
      videoChannelId: null,
      screenShareChannelId: null
    },
    importReport: null,
    selectedServerId: serverId,
    selectedChannelId: generalChannelId,
    unread: {
      channels: {
        [roadmapChannelId]: 1,
        [dmOpsId]: 2
      },
      mentions: {
        [dmOpsId]: 1
      }
    },
    typing: {
      [dmOpsId]: ["Alex"]
    },
    presence: {
      System: {
        user: "System",
        state: "online",
        lastActiveAt: createdAt
      },
      Alex: {
        user: "Alex",
        state: "online",
        lastActiveAt: createdAt
      },
      Jules: {
        user: "Jules",
        state: "idle",
        lastActiveAt: createdAt
      }
    },
    notificationSettings: {
      defaultServerMode: "all",
      defaultDirectMode: "mentions",
      channelOverrides: {}
    }
  };
}

function normalizeState(parsed: Partial<WorkspaceState>): WorkspaceState | null {
  if (!Array.isArray(parsed.servers) || !Array.isArray(parsed.channels)) {
    return null;
  }

  const fallback = createDefaultState();

  const servers = parsed.servers.map((server) => ({
    ...server,
    defaultChannelPrivacy:
      server.defaultChannelPrivacy ?? ("ServerReadable" as ChannelPrivacy),
    networkExposureMode: server.networkExposureMode ?? ("RelayOnly" as const),
    redactClientIp: server.redactClientIp ?? true
  }));

  const channels = parsed.channels.map((channel) => ({
    ...channel,
    privacy: channel.privacy ?? ("ServerReadable" as ChannelPrivacy),
    kind: channel.kind ?? ("server" as const),
    isThread: channel.isThread ?? false
  }));

  const messages = Array.isArray(parsed.messages)
    ? parsed.messages.map((message) => ({
        ...message,
        reactions: message.reactions ?? []
      }))
    : fallback.messages;

  return {
    servers,
    channels,
    messages,
    agents: Array.isArray(parsed.agents) ? parsed.agents : fallback.agents,
    agentPolicy: parsed.agentPolicy
      ? {
          ...parsed.agentPolicy,
          maxEventsPerMinute: parsed.agentPolicy.maxEventsPerMinute ?? 12
        }
      : fallback.agentPolicy,
    profile: parsed.profile ?? fallback.profile,
    sessions: parsed.sessions ?? fallback.sessions,
    importReport: parsed.importReport ?? fallback.importReport,
    selectedServerId: parsed.selectedServerId ?? fallback.selectedServerId,
    selectedChannelId: parsed.selectedChannelId ?? fallback.selectedChannelId,
    unread: {
      channels: {
        ...fallback.unread.channels,
        ...(parsed.unread?.channels ?? {})
      },
      mentions: {
        ...fallback.unread.mentions,
        ...(parsed.unread?.mentions ?? {})
      }
    },
    typing: parsed.typing ?? fallback.typing,
    presence: parsed.presence ?? fallback.presence,
    notificationSettings: parsed.notificationSettings
      ? {
          ...parsed.notificationSettings,
          defaultServerMode:
            parsed.notificationSettings.defaultServerMode ?? "all",
          defaultDirectMode:
            parsed.notificationSettings.defaultDirectMode ?? "mentions",
          channelOverrides: parsed.notificationSettings.channelOverrides ?? {}
        }
      : fallback.notificationSettings
  };
}

function parseState(raw: string | null): WorkspaceState | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<WorkspaceState>;
    return normalizeState(parsed);
  } catch {
    return null;
  }
}

function loadInitialState(persistence: WorkspacePersistence): WorkspaceState {
  const current = parseState(persistence.load());
  if (current) {
    return current;
  }

  return createDefaultState();
}

function persistState(state: WorkspaceState, persistence: WorkspacePersistence): void {
  persistence.save(JSON.stringify(state));
}

function withCurrentServer(state: WorkspaceState): ServerRecord | null {
  if (!state.selectedServerId) {
    return null;
  }
  return state.servers.find((server) => server.id === state.selectedServerId) ?? null;
}

function withCurrentChannel(state: WorkspaceState): ChannelRecord | null {
  if (!state.selectedChannelId) {
    return null;
  }
  return state.channels.find((channel) => channel.id === state.selectedChannelId) ?? null;
}

function importRelayExportIntoState(prev: WorkspaceState, raw: string): {
  next: WorkspaceState;
  report: ImportReport;
} | null {
  try {
    const parsed = JSON.parse(raw) as {
      channels?: Array<{ name?: string; privacy?: ChannelPrivacy }>;
      messages?: Array<{ channel?: string; body?: string; author?: string }>;
    };

    const serverId = prev.selectedServerId;
    if (!serverId) {
      return null;
    }

    const createdAt = nowIso();
    const importedChannels: ChannelRecord[] = [];
    const channelNameToId = new Map<string, string>();

    for (const channel of parsed.channels ?? []) {
      const name = channel.name?.trim();
      if (!name) {
        continue;
      }
      const id = createId("channel");
      importedChannels.push({
        id,
        serverId,
        name,
        createdAt,
        privacy: channel.privacy ?? "ServerReadable",
        kind: "server",
        isThread: false
      });
      channelNameToId.set(name, id);
    }

    const importedMessages: MessageRecord[] = [];
    let nextUnread = { ...prev.unread };
    const fallbackChannel =
      prev.channels.find((channel) => channel.serverId === serverId)?.id ?? null;
    const allChannelsForNotifications = [...prev.channels, ...importedChannels];
    const notificationState = {
      ...prev,
      channels: allChannelsForNotifications
    };

    for (const message of parsed.messages ?? []) {
      const body = message.body?.trim();
      if (!body) {
        continue;
      }

      const importedChannelId =
        (message.channel ? channelNameToId.get(message.channel) : null) ?? fallbackChannel;
      if (!importedChannelId) {
        continue;
      }

      importedMessages.push({
        id: createId("msg"),
        channelId: importedChannelId,
        author: message.author?.trim() || "Imported User",
        body,
        createdAt,
        reactions: []
      });
      nextUnread = applyIncomingUnread(
        notificationState,
        nextUnread,
        importedChannelId,
        message.author?.trim() || "Imported User",
        body
      );
    }

    const warnings: string[] = [];
    if ((parsed.channels ?? []).length !== importedChannels.length) {
      warnings.push("Some channels were skipped due to missing names.");
    }
    if ((parsed.messages ?? []).length !== importedMessages.length) {
      warnings.push("Some messages were skipped due to missing body or channel mapping.");
    }

    const report: ImportReport = {
      importedChannels: importedChannels.length,
      importedMessages: importedMessages.length,
      warnings,
      importedAt: createdAt
    };

    return {
      next: {
        ...prev,
        channels: [...prev.channels, ...importedChannels],
        messages: [...prev.messages, ...importedMessages],
        importReport: report,
        unread: nextUnread
      },
      report
    };
  } catch {
    return null;
  }
}

export function useWorkspaceState(options: WorkspaceStateOptions = {}): WorkspaceModel {
  const persistence = React.useMemo(
    () =>
      options.persistence ??
      createBrowserWorkspacePersistence(STORAGE_KEY, LEGACY_STORAGE_KEYS),
    [options.persistence]
  );

  const [state, setState] = React.useState<WorkspaceState>(() => loadInitialState(persistence));

  React.useEffect(() => {
    persistState(state, persistence);
  }, [state, persistence]);

  const selectedServer = React.useMemo(() => withCurrentServer(state), [state]);

  const visibleChannels = React.useMemo(() => {
    if (!state.selectedServerId) {
      return [];
    }
    return state.channels
      .filter(
        (channel) =>
          channel.serverId === state.selectedServerId && channel.kind === "server"
      )
      .sort((left, right) => Number(left.isThread) - Number(right.isThread));
  }, [state.channels, state.selectedServerId]);

  const visibleDirectChannels = React.useMemo(
    () =>
      state.channels
        .filter((channel) => channel.kind === "direct")
        .sort((left, right) => left.name.localeCompare(right.name)),
    [state.channels]
  );

  const selectedChannel = React.useMemo(() => withCurrentChannel(state), [state]);

  const selectedDirectChannel = React.useMemo(() => {
    if (!state.selectedChannelId) {
      return null;
    }
    const current = state.channels.find((channel) => channel.id === state.selectedChannelId);
    if (!current || current.kind !== "direct") {
      return null;
    }
    return current;
  }, [state.channels, state.selectedChannelId]);

  const channelMessages = React.useMemo(() => {
    if (!state.selectedChannelId) {
      return [];
    }
    return state.messages
      .filter((message) => message.channelId === state.selectedChannelId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }, [state.messages, state.selectedChannelId]);

  const pinnedMessages = React.useMemo(
    () => channelMessages.filter((message) => Boolean(message.pinnedAt)),
    [channelMessages]
  );

  const pendingAgents = React.useMemo(
    () => state.agents.filter((agent) => agent.status === "pending"),
    [state.agents]
  );

  const approvedAgents = React.useMemo(
    () => state.agents.filter((agent) => agent.status === "approved"),
    [state.agents]
  );

  const unreadByChannel = state.unread.channels;
  const mentionByChannel = state.unread.mentions;
  const presenceIndex = state.presence;
  const typingUsers = React.useMemo(() => {
    if (!state.selectedChannelId) {
      return [];
    }
    const self = state.profile.displayName || DEFAULT_AUTHOR;
    return (state.typing[state.selectedChannelId] ?? []).filter((entry) => entry !== self);
  }, [state.typing, state.selectedChannelId, state.profile.displayName]);
  const notificationMode = React.useMemo(() => {
    if (!state.selectedChannelId) {
      return null;
    }
    return resolveNotificationMode(state, state.selectedChannelId);
  }, [state]);

  const actions = React.useMemo<WorkspaceActions>(
    () => ({
      selectServer: (serverId) => {
        setState((prev) => {
          const serverExists = prev.servers.some((server) => server.id === serverId);
          if (!serverExists) {
            return prev;
          }

          const firstChannel =
            prev.channels.find(
              (channel) => channel.serverId === serverId && channel.isThread === false
            ) ??
            prev.channels.find((channel) => channel.serverId === serverId) ??
            null;

          return {
            ...prev,
            selectedServerId: serverId,
            selectedChannelId: firstChannel?.id ?? null,
            unread: firstChannel
              ? {
                  channels: {
                    ...prev.unread.channels,
                    [firstChannel.id]: 0
                  },
                  mentions: {
                    ...prev.unread.mentions,
                    [firstChannel.id]: 0
                  }
                }
              : prev.unread
          };
        });
      },

      selectChannel: (channelId) => {
        setState((prev) => {
          const channel = prev.channels.find((entry) => entry.id === channelId);
          if (!channel) {
            return prev;
          }

          return {
            ...prev,
            selectedServerId:
              channel.kind === "server" ? channel.serverId : prev.selectedServerId,
            selectedChannelId: channelId,
            unread: {
              channels: {
                ...prev.unread.channels,
                [channelId]: 0
              },
              mentions: {
                ...prev.unread.mentions,
                [channelId]: 0
              }
            }
          };
        });
      },

      selectDirectChannel: (channelId) => {
        setState((prev) => {
          const channel = prev.channels.find((entry) => entry.id === channelId);
          if (!channel || channel.kind !== "direct") {
            return prev;
          }

          return {
            ...prev,
            selectedChannelId: channelId,
            unread: {
              channels: {
                ...prev.unread.channels,
                [channelId]: 0
              },
              mentions: {
                ...prev.unread.mentions,
                [channelId]: 0
              }
            }
          };
        });
      },

      createServer: (name) => {
        const cleaned = name.trim();
        if (!cleaned) {
          return;
        }

        setState((prev) => {
          const timestamp = nowIso();
          const serverId = createId("server");
          const channelId = createId("channel");

          return {
            ...prev,
            servers: [
              ...prev.servers,
              {
                id: serverId,
                name: cleaned,
                createdAt: timestamp,
                defaultChannelPrivacy: "ServerReadable",
                networkExposureMode: "RelayOnly",
                redactClientIp: true
              }
            ],
            channels: [
              ...prev.channels,
              {
                id: channelId,
                serverId,
                name: "general",
                createdAt: timestamp,
                privacy: "ServerReadable",
                kind: "server",
                isThread: false
              }
            ],
            selectedServerId: serverId,
            selectedChannelId: channelId
          };
        });
      },

      createChannel: (name) => {
        const cleaned = name.trim().replace(/\s+/g, "-").toLowerCase();
        if (!cleaned) {
          return;
        }

        setState((prev) => {
          if (!prev.selectedServerId) {
            return prev;
          }

          const server = prev.servers.find((item) => item.id === prev.selectedServerId);
          const timestamp = nowIso();
          const channelId = createId("channel");

          return {
            ...prev,
            channels: [
              ...prev.channels,
              {
                id: channelId,
                serverId: prev.selectedServerId,
                name: cleaned,
                createdAt: timestamp,
                privacy: server?.defaultChannelPrivacy ?? "ServerReadable",
                kind: "server",
                isThread: false
              }
            ],
            selectedChannelId: channelId
          };
        });
      },

      createDirectMessage: (participant) => {
        const cleaned = participant.trim();
        if (!cleaned) {
          return;
        }

        setState((prev) => {
          const normalized = cleaned.toLowerCase();
          const existing = prev.channels.find(
            (channel) =>
              channel.kind === "direct" &&
              channel.isGroupDirect !== true &&
              channel.name.toLowerCase() === normalized
          );
          if (existing) {
            return {
              ...prev,
              selectedChannelId: existing.id,
              unread: {
                channels: {
                  ...prev.unread.channels,
                  [existing.id]: 0
                },
                mentions: {
                  ...prev.unread.mentions,
                  [existing.id]: 0
                }
              }
            };
          }

          const directId = createId("dm");
          const timestamp = nowIso();
          return {
            ...prev,
            channels: [
              ...prev.channels,
              {
                id: directId,
                serverId: DIRECT_SERVER_ID,
                name: cleaned,
                createdAt: timestamp,
                privacy: "EndToEndEncrypted",
                kind: "direct",
                isThread: false,
                isGroupDirect: false,
                participants: [prev.profile.displayName || DEFAULT_AUTHOR, cleaned]
              }
            ],
            selectedChannelId: directId,
            unread: {
              channels: {
                ...prev.unread.channels,
                [directId]: 0
              },
              mentions: {
                ...prev.unread.mentions,
                [directId]: 0
              }
            }
          };
        });
      },

      createGroupDirect: (name, participantsRaw) => {
        const cleanedName = name.trim();
        if (!cleanedName) {
          return;
        }

        const participants = participantsRaw
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean);
        if (participants.length === 0) {
          return;
        }

        setState((prev) => {
          const groupId = createId("gdm");
          const timestamp = nowIso();
          const allParticipants = Array.from(
            new Set([prev.profile.displayName || DEFAULT_AUTHOR, ...participants])
          );

          return {
            ...prev,
            channels: [
              ...prev.channels,
              {
                id: groupId,
                serverId: DIRECT_SERVER_ID,
                name: cleanedName,
                createdAt: timestamp,
                privacy: "EndToEndEncrypted",
                kind: "direct",
                isThread: false,
                isGroupDirect: true,
                participants: allParticipants
              }
            ],
            selectedChannelId: groupId,
            unread: {
              channels: {
                ...prev.unread.channels,
                [groupId]: 0
              },
              mentions: {
                ...prev.unread.mentions,
                [groupId]: 0
              }
            }
          };
        });
      },

      setNotificationMode: (channelId, mode) => {
        setState((prev) => {
          if (!prev.channels.some((channel) => channel.id === channelId)) {
            return prev;
          }

          return {
            ...prev,
            notificationSettings: {
              ...prev.notificationSettings,
              channelOverrides: {
                ...prev.notificationSettings.channelOverrides,
                [channelId]: mode
              }
            }
          };
        });
      },

      setTyping: (channelId, actor, isTyping) => {
        const cleanedActor = actor.trim();
        if (!cleanedActor) {
          return;
        }

        setState((prev) => {
          if (!prev.channels.some((channel) => channel.id === channelId)) {
            return prev;
          }

          const existing = prev.typing[channelId] ?? [];
          const present = existing.includes(cleanedActor);
          let nextUsers = existing;
          if (isTyping && !present) {
            nextUsers = [...existing, cleanedActor];
          }
          if (!isTyping && present) {
            nextUsers = existing.filter((entry) => entry !== cleanedActor);
          }

          if (nextUsers === existing) {
            return prev;
          }

          return {
            ...prev,
            typing: {
              ...prev.typing,
              [channelId]: nextUsers
            }
          };
        });
      },

      setPresence: (user, presence) => {
        const cleaned = user.trim();
        if (!cleaned) {
          return;
        }

        setState((prev) => ({
          ...prev,
          presence: {
            ...prev.presence,
            [cleaned]: {
              user: cleaned,
              state: presence,
              lastActiveAt: nowIso()
            }
          }
        }));
      },

      simulateIncomingMessage: (payload) => {
        const cleanedAuthor = payload.author.trim();
        const cleanedBody = payload.body.trim();
        if (!cleanedAuthor || !cleanedBody) {
          return;
        }

        setState((prev) => {
          const targetChannelId = payload.channelId ?? prev.selectedChannelId;
          if (!targetChannelId) {
            return prev;
          }

          const channelExists = prev.channels.some((channel) => channel.id === targetChannelId);
          if (!channelExists) {
            return prev;
          }

          const createdAt = nowIso();
          const message: MessageRecord = {
            id: createId("msg"),
            channelId: targetChannelId,
            author: cleanedAuthor,
            body: cleanedBody,
            createdAt,
            reactions: []
          };

          const unread = applyIncomingUnread(
            prev,
            prev.unread,
            targetChannelId,
            cleanedAuthor,
            cleanedBody
          );

          const typingUsers = prev.typing[targetChannelId] ?? [];
          const nextTyping = payload.markTyping
            ? Array.from(new Set([...typingUsers, cleanedAuthor]))
            : typingUsers.filter((entry) => entry !== cleanedAuthor);

          return {
            ...prev,
            messages: [...prev.messages, message],
            unread,
            typing: {
              ...prev.typing,
              [targetChannelId]: nextTyping
            },
            presence: {
              ...prev.presence,
              [cleanedAuthor]: {
                user: cleanedAuthor,
                state: "online",
                lastActiveAt: createdAt
              }
            }
          };
        });
      },

      setChannelPrivacy: (channelId, privacy) => {
        setState((prev) => ({
          ...prev,
          channels: prev.channels.map((channel) =>
            channel.id === channelId && channel.kind === "server"
              ? {
                  ...channel,
                  privacy
                }
              : channel
          )
        }));
      },

      sendMessage: (input) => {
        const cleaned = input.body.trim();
        if (!cleaned) {
          return;
        }

        setState((prev) => {
          if (!prev.selectedChannelId) {
            return prev;
          }

          const message: MessageRecord = {
            id: createId("msg"),
            channelId: prev.selectedChannelId,
            author: prev.profile.displayName || DEFAULT_AUTHOR,
            body: cleaned,
            createdAt: nowIso(),
            replyToId: input.replyToId,
            threadId: input.threadId,
            reactions: []
          };

          const self = prev.profile.displayName || DEFAULT_AUTHOR;
          const typingUsers = (prev.typing[prev.selectedChannelId] ?? []).filter(
            (entry) => entry !== self
          );

          return {
            ...prev,
            messages: [...prev.messages, message],
            typing: {
              ...prev.typing,
              [prev.selectedChannelId]: typingUsers
            },
            presence: {
              ...prev.presence,
              [self]: {
                user: self,
                state: "online",
                lastActiveAt: nowIso()
              }
            }
          };
        });
      },

      editMessage: (messageId, body) => {
        const cleaned = body.trim();
        if (!cleaned) {
          return;
        }

        setState((prev) => ({
          ...prev,
          messages: prev.messages.map((message) =>
            message.id === messageId && !message.deletedAt
              ? {
                  ...message,
                  body: cleaned,
                  editedAt: nowIso()
                }
              : message
          )
        }));
      },

      deleteMessage: (messageId) => {
        setState((prev) => ({
          ...prev,
          messages: prev.messages.map((message) =>
            message.id === messageId
              ? {
                  ...message,
                  deletedAt: nowIso()
                }
              : message
          )
        }));
      },

      togglePin: (messageId) => {
        setState((prev) => ({
          ...prev,
          messages: prev.messages.map((message) =>
            message.id === messageId
              ? {
                  ...message,
                  pinnedAt: message.pinnedAt ? undefined : nowIso()
                }
              : message
          )
        }));
      },

      createThreadFromMessage: (messageId, name) => {
        let newThreadId: string | null = null;

        setState((prev) => {
          const rootMessage = prev.messages.find((message) => message.id === messageId);
          if (!rootMessage) {
            return prev;
          }

          const parentChannel = prev.channels.find(
            (channel) => channel.id === rootMessage.channelId
          );
          if (!parentChannel) {
            return prev;
          }

          if (parentChannel.kind !== "server") {
            return prev;
          }

          newThreadId = createId("thread");
          const timestamp = nowIso();
          const threadName =
            name?.trim() || `thread-${rootMessage.id.slice(rootMessage.id.length - 6)}`;

          return {
            ...prev,
            channels: [
              ...prev.channels,
              {
                id: newThreadId,
                serverId: parentChannel.serverId,
                name: threadName,
                createdAt: timestamp,
                privacy: parentChannel.privacy,
                kind: "server",
                isThread: true
              }
            ],
            messages: prev.messages.map((message) =>
              message.id === messageId
                ? {
                    ...message,
                    threadId: newThreadId ?? undefined
                  }
                : message
            )
          };
        });

        return newThreadId;
      },

      toggleReaction: (messageId, emoji) => {
        setState((prev) => {
          const actor = prev.profile.displayName || DEFAULT_AUTHOR;

          return {
            ...prev,
            messages: prev.messages.map((message) => {
              if (message.id !== messageId || message.deletedAt) {
                return message;
              }

              const nextReactions = [...message.reactions];
              const reactionIndex = nextReactions.findIndex(
                (reaction) => reaction.emoji === emoji
              );

              if (reactionIndex < 0) {
                nextReactions.push({ emoji, users: [actor] });
                return { ...message, reactions: nextReactions };
              }

              const reaction = nextReactions[reactionIndex];
              const hasReacted = reaction.users.includes(actor);
              const users = hasReacted
                ? reaction.users.filter((user) => user !== actor)
                : [...reaction.users, actor];

              if (users.length === 0) {
                nextReactions.splice(reactionIndex, 1);
              } else {
                nextReactions[reactionIndex] = { ...reaction, users };
              }

              return {
                ...message,
                reactions: nextReactions
              };
            })
          };
        });
      },

      setDisplayName: (displayName) => {
        const cleaned = displayName.trim();
        if (!cleaned) {
          return;
        }

        setState((prev) => ({
          ...prev,
          profile: {
            ...prev.profile,
            displayName: cleaned
          }
        }));
      },

      joinVoice: (channelId) => {
        setState((prev) => ({
          ...prev,
          sessions: {
            ...prev.sessions,
            voiceChannelId: channelId
          }
        }));
      },

      joinVideo: (channelId) => {
        setState((prev) => ({
          ...prev,
          sessions: {
            ...prev.sessions,
            videoChannelId: channelId
          }
        }));
      },

      startScreenShare: (channelId) => {
        setState((prev) => ({
          ...prev,
          sessions: {
            ...prev.sessions,
            screenShareChannelId: channelId
          }
        }));
      },

      leaveMediaSessions: () => {
        setState((prev) => ({
          ...prev,
          sessions: {
            voiceChannelId: null,
            videoChannelId: null,
            screenShareChannelId: null
          }
        }));
      },

      importDiscordExport: (raw) => {
        let report: ImportReport | null = null;
        setState((prev) => {
          const imported = importRelayExportIntoState(prev, raw);
          if (!imported) {
            report = null;
            return prev;
          }

          report = imported.report;
          return imported.next;
        });

        return report;
      },

      setAutoApproval: (enabled) => {
        setState((prev) => ({
          ...prev,
          agentPolicy: {
            ...prev.agentPolicy,
            autoApproval: enabled
          }
        }));
      },

      submitAgentRequest: (payload) => {
        const name = payload.name.trim();
        const purpose = payload.purpose.trim();
        if (!name || !purpose || payload.capabilities.length === 0) {
          return;
        }

        setState((prev) => {
          const timestamp = nowIso();
          const status = prev.agentPolicy.autoApproval ? "approved" : "pending";

          const record: AgentRecord = {
            id: createId("agent"),
            name,
            purpose,
            capabilities: payload.capabilities,
            requestedAt: timestamp,
            status,
            reviewedAt: status === "approved" ? timestamp : undefined,
            reviewedBy: status === "approved" ? prev.profile.displayName : undefined
          };

          return {
            ...prev,
            agents: [record, ...prev.agents]
          };
        });
      },

      approveAgent: (agentId) => {
        setState((prev) => ({
          ...prev,
          agents: prev.agents.map((agent) =>
            agent.id === agentId
              ? {
                  ...agent,
                  status: "approved",
                  reviewedAt: nowIso(),
                  reviewedBy: prev.profile.displayName
                }
              : agent
          )
        }));
      },

      rejectAgent: (agentId) => {
        setState((prev) => ({
          ...prev,
          agents: prev.agents.map((agent) =>
            agent.id === agentId
              ? {
                  ...agent,
                  status: "rejected",
                  reviewedAt: nowIso(),
                  reviewedBy: prev.profile.displayName
                }
              : agent
          )
        }));
      }
    }),
    []
  );

  return {
    state,
    selectedServer,
    visibleChannels,
    visibleDirectChannels,
    selectedChannel,
    selectedDirectChannel,
    channelMessages,
    pinnedMessages,
    pendingAgents,
    approvedAgents,
    unreadByChannel,
    mentionByChannel,
    typingUsers,
    presenceIndex,
    notificationMode,
    actions
  };
}
