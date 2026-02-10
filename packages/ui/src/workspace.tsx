import React from "react";

import { ALL_CAPABILITIES, SendMessageInput, useWorkspaceState } from "./workspace-state";
import type { WorkspacePersistence } from "./persistence";
import {
  AgentCapability,
  ChannelPrivacy,
  MessageRecord,
  NotificationMode,
  PresenceState
} from "./workspace-types";
import "./workspace.css";

const QUICK_REACTIONS = ["👍", "🔥", "✅", "👀"];

function formatTimestamp(value: string): string {
  const date = new Date(value);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  })}`;
}

function presenceClass(presence?: PresenceState): string {
  return `dr-presence dr-presence-${presence ?? "offline"}`;
}

function notificationModeLabel(mode: NotificationMode): string {
  if (mode === "all") {
    return "All";
  }
  if (mode === "mentions") {
    return "Mentions";
  }
  return "Mute";
}

function MessageComposer(props: {
  onSend: (value: SendMessageInput) => void;
  replyTo?: MessageRecord;
  onClearReply: () => void;
}) {
  const [value, setValue] = React.useState("");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!value.trim()) {
      return;
    }

    props.onSend({
      body: value,
      replyToId: props.replyTo?.id
    });

    setValue("");
    props.onClearReply();
  };

  return (
    <form className="dr-composer" onSubmit={submit}>
      {props.replyTo ? (
        <div className="dr-inline-banner">
          Replying to {props.replyTo.author}: {props.replyTo.body.slice(0, 80)}
          <button type="button" className="dr-ghost" onClick={props.onClearReply}>
            Clear
          </button>
        </div>
      ) : null}
      <div className="dr-composer-row">
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Write a message..."
        />
        <button type="submit">Send</button>
      </div>
    </form>
  );
}

function MessageCard(props: {
  message: MessageRecord;
  replyTarget?: MessageRecord;
  allowThread: boolean;
  authorPresence?: PresenceState;
  onEdit: (id: string, body: string) => void;
  onDelete: (id: string) => void;
  onReact: (id: string, emoji: string) => void;
  onReply: (message: MessageRecord) => void;
  onTogglePin: (id: string) => void;
  onCreateThread: (message: MessageRecord) => void;
}) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(props.message.body);

  React.useEffect(() => {
    setDraft(props.message.body);
  }, [props.message.body]);

  const save = () => {
    if (!draft.trim()) {
      return;
    }
    props.onEdit(props.message.id, draft);
    setIsEditing(false);
  };

  return (
    <article className="dr-message-card">
      <header>
        <span className="dr-message-author">
          <span className={presenceClass(props.authorPresence)} />
          <strong>{props.message.author}</strong>
        </span>
        <span>{formatTimestamp(props.message.createdAt)}</span>
      </header>

      {props.replyTarget ? (
        <p className="dr-muted">↪ Reply to {props.replyTarget.author}: {props.replyTarget.body}</p>
      ) : null}

      {props.message.deletedAt ? (
        <p className="dr-muted">Message deleted</p>
      ) : isEditing ? (
        <div className="dr-edit">
          <textarea value={draft} onChange={(event) => setDraft(event.target.value)} />
          <div className="dr-actions">
            <button type="button" onClick={save}>
              Save
            </button>
            <button type="button" className="dr-ghost" onClick={() => setIsEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p>{props.message.body}</p>
      )}

      {props.message.pinnedAt ? <span className="dr-chip">Pinned</span> : null}
      {props.message.threadId ? <span className="dr-chip">Thread: {props.message.threadId}</span> : null}

      {!props.message.deletedAt ? (
        <>
          <div className="dr-reactions">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={`${props.message.id}-${emoji}`}
                type="button"
                className="dr-ghost"
                onClick={() => props.onReact(props.message.id, emoji)}
              >
                {emoji}
              </button>
            ))}
            {props.message.reactions.map((reaction) => (
              <span key={`${props.message.id}-summary-${reaction.emoji}`} className="dr-chip">
                {reaction.emoji} {reaction.users.length}
              </span>
            ))}
          </div>
          <div className="dr-actions">
            <button type="button" className="dr-ghost" onClick={() => props.onReply(props.message)}>
              Reply
            </button>
            <button type="button" className="dr-ghost" onClick={() => props.onTogglePin(props.message.id)}>
              {props.message.pinnedAt ? "Unpin" : "Pin"}
            </button>
            {props.allowThread ? (
              <button type="button" className="dr-ghost" onClick={() => props.onCreateThread(props.message)}>
                Thread
              </button>
            ) : null}
            <button type="button" className="dr-ghost" onClick={() => setIsEditing(true)}>
              Edit
            </button>
            <button
              type="button"
              className="dr-ghost"
              onClick={() => props.onDelete(props.message.id)}
            >
              Delete
            </button>
          </div>
        </>
      ) : null}

      {props.message.editedAt && !props.message.deletedAt ? (
        <p className="dr-muted">Edited {formatTimestamp(props.message.editedAt)}</p>
      ) : null}
    </article>
  );
}

function toggleCapability(
  values: AgentCapability[],
  capability: AgentCapability
): AgentCapability[] {
  if (values.includes(capability)) {
    return values.filter((entry) => entry !== capability);
  }
  return [...values, capability];
}

function channelPrivacyLabel(privacy: ChannelPrivacy): string {
  return privacy === "ServerReadable" ? "Server-Readable" : "E2EE";
}

export function WorkspaceApp(props: { platform: "web" | "desktop"; persistence?: WorkspacePersistence }) {
  const {
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
  } = useWorkspaceState({ persistence: props.persistence });

  const [replyTarget, setReplyTarget] = React.useState<MessageRecord | undefined>(undefined);
  const [serverName, setServerName] = React.useState("");
  const [channelName, setChannelName] = React.useState("");
  const [directName, setDirectName] = React.useState("");
  const [groupName, setGroupName] = React.useState("");
  const [groupParticipants, setGroupParticipants] = React.useState("");
  const [presenceName, setPresenceName] = React.useState("Alex");
  const [incomingAuthor, setIncomingAuthor] = React.useState("Alex");
  const [incomingBody, setIncomingBody] = React.useState("@You migration draft is ready.");
  const [displayName, setDisplayName] = React.useState(state.profile.displayName);
  const [agentName, setAgentName] = React.useState("");
  const [agentPurpose, setAgentPurpose] = React.useState("");
  const [agentCapabilities, setAgentCapabilities] = React.useState<AgentCapability[]>([
    "ReadChannel",
    "PostChannel"
  ]);
  const [importPayload, setImportPayload] = React.useState(
    '{"channels":[{"name":"imported-general"}],"messages":[{"channel":"imported-general","body":"Imported hello"}]}'
  );
  const isDirectChannel = selectedChannel?.kind === "direct";
  const activeTitle = selectedChannel
    ? isDirectChannel
      ? `@${selectedChannel.name}`
      : `#${selectedChannel.name}`
    : "Select a channel";

  React.useEffect(() => {
    setDisplayName(state.profile.displayName);
  }, [state.profile.displayName]);

  React.useEffect(() => {
    if (!replyTarget) {
      return;
    }
    const stillExists = channelMessages.some((message) => message.id === replyTarget.id);
    if (!stillExists) {
      setReplyTarget(undefined);
    }
  }, [channelMessages, replyTarget]);

  const submitServer = (event: React.FormEvent) => {
    event.preventDefault();
    if (!serverName.trim()) {
      return;
    }
    actions.createServer(serverName);
    setServerName("");
  };

  const submitChannel = (event: React.FormEvent) => {
    event.preventDefault();
    if (!channelName.trim()) {
      return;
    }
    actions.createChannel(channelName);
    setChannelName("");
  };

  const submitDirect = (event: React.FormEvent) => {
    event.preventDefault();
    if (!directName.trim()) {
      return;
    }
    actions.createDirectMessage(directName);
    setDirectName("");
  };

  const submitGroupDirect = (event: React.FormEvent) => {
    event.preventDefault();
    if (!groupName.trim() || !groupParticipants.trim()) {
      return;
    }
    actions.createGroupDirect(groupName, groupParticipants);
    setGroupName("");
    setGroupParticipants("");
  };

  const submitIncoming = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedChannel || !incomingAuthor.trim() || !incomingBody.trim()) {
      return;
    }
    actions.simulateIncomingMessage({
      channelId: selectedChannel.id,
      author: incomingAuthor,
      body: incomingBody
    });
  };

  const submitProfile = (event: React.FormEvent) => {
    event.preventDefault();
    actions.setDisplayName(displayName);
  };

  const submitAgent = (event: React.FormEvent) => {
    event.preventDefault();
    actions.submitAgentRequest({
      name: agentName,
      purpose: agentPurpose,
      capabilities: agentCapabilities
    });
    setAgentName("");
    setAgentPurpose("");
    setAgentCapabilities(["ReadChannel", "PostChannel"]);
  };

  const onCreateThread = (message: MessageRecord) => {
    if (selectedChannel?.kind !== "server") {
      return;
    }
    const threadId = actions.createThreadFromMessage(message.id);
    if (threadId) {
      actions.selectChannel(threadId);
    }
  };

  return (
    <div className="dr-root">
      <header className="dr-topbar">
        <div>
          <h1>RelayChat</h1>
          <p>
            {props.platform.toUpperCase()} | local-first + relay hybrid | policy-aware Relay Agents
          </p>
        </div>
        <form className="dr-inline-form" onSubmit={submitProfile}>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Display name"
          />
          <button type="submit">Set Name</button>
        </form>
      </header>

      <section className="dr-layout">
        <aside className="dr-panel dr-panel-servers">
          <h2>Servers</h2>
          {selectedServer ? (
            <p className="dr-muted">
              Network: {selectedServer.networkExposureMode} | IP redaction:{" "}
              {selectedServer.redactClientIp ? "on" : "off"}
            </p>
          ) : null}
          <div className="dr-list">
            {state.servers.map((server) => (
              <button
                key={server.id}
                type="button"
                className={
                  server.id === state.selectedServerId ? "dr-item dr-item-active" : "dr-item"
                }
                onClick={() => actions.selectServer(server.id)}
              >
                {server.name}
              </button>
            ))}
          </div>
          <form className="dr-form" onSubmit={submitServer}>
            <label htmlFor="new-server">New Server</label>
            <input
              id="new-server"
              value={serverName}
              onChange={(event) => setServerName(event.target.value)}
              placeholder="Engineering"
            />
            <button type="submit">Create</button>
          </form>
        </aside>

        <aside className="dr-panel dr-panel-channels">
          <h2>Channels + DMs</h2>
          <p className="dr-muted">{selectedServer?.name ?? "No server selected"}</p>

          <h3>Direct Messages</h3>
          <div className="dr-list">
            {visibleDirectChannels.length === 0 ? (
              <p className="dr-muted">No direct messages</p>
            ) : (
              visibleDirectChannels.map((channel) => {
                const unread = unreadByChannel[channel.id] ?? 0;
                const mentions = mentionByChannel[channel.id] ?? 0;
                return (
                  <button
                    key={channel.id}
                    type="button"
                    className={
                      channel.id === state.selectedChannelId ? "dr-item dr-item-active" : "dr-item"
                    }
                    onClick={() => actions.selectDirectChannel(channel.id)}
                  >
                    <span className="dr-item-row">
                      <span>{channel.isGroupDirect ? "@" : "DM"} {channel.name}</span>
                      {unread > 0 ? (
                        <span className="dr-unread">
                          {mentions > 0 ? `@${mentions} / ${unread}` : unread}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          <form className="dr-form" onSubmit={submitDirect}>
            <label htmlFor="new-direct">New Direct Message</label>
            <input
              id="new-direct"
              value={directName}
              onChange={(event) => setDirectName(event.target.value)}
              placeholder="alex"
            />
            <button type="submit">Create DM</button>
          </form>
          <form className="dr-form" onSubmit={submitGroupDirect}>
            <label htmlFor="new-group-name">New Group DM</label>
            <input
              id="new-group-name"
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              placeholder="ops-sync"
            />
            <input
              id="new-group-participants"
              value={groupParticipants}
              onChange={(event) => setGroupParticipants(event.target.value)}
              placeholder="alex, jules, morgan"
            />
            <button type="submit">Create Group DM</button>
          </form>

          <h3>Server Channels</h3>
          <div className="dr-list">
            {visibleChannels.map((channel) => {
              const unread = unreadByChannel[channel.id] ?? 0;
              const mentions = mentionByChannel[channel.id] ?? 0;
              return (
                <button
                  key={channel.id}
                  type="button"
                  className={
                    channel.id === state.selectedChannelId ? "dr-item dr-item-active" : "dr-item"
                  }
                  onClick={() => actions.selectChannel(channel.id)}
                >
                  <span className="dr-item-row">
                    <span>
                      {channel.isThread ? "[thread]" : "#"}
                      {channel.name}
                      <span className="dr-muted"> {channelPrivacyLabel(channel.privacy)}</span>
                    </span>
                    {unread > 0 ? (
                      <span className="dr-unread">
                        {mentions > 0 ? `@${mentions} / ${unread}` : unread}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
          <form className="dr-form" onSubmit={submitChannel}>
            <label htmlFor="new-channel">New Channel</label>
            <input
              id="new-channel"
              value={channelName}
              onChange={(event) => setChannelName(event.target.value)}
              placeholder="release-plans"
            />
            <button type="submit">Create</button>
          </form>
        </aside>

        <main className="dr-panel dr-panel-chat">
          <header className="dr-chat-header">
            <h2>{activeTitle}</h2>
            <p className="dr-muted">{channelMessages.length} events in this conversation</p>
            {selectedDirectChannel?.participants?.length ? (
              <p className="dr-muted">
                Participants: {selectedDirectChannel.participants.join(", ")}
              </p>
            ) : null}
            {selectedChannel ? (
              <>
                {selectedChannel.kind === "server" ? (
                  <div className="dr-actions">
                    <button
                      type="button"
                      className={selectedChannel.privacy === "ServerReadable" ? "dr-chip dr-chip-active" : "dr-chip"}
                      onClick={() => actions.setChannelPrivacy(selectedChannel.id, "ServerReadable")}
                    >
                      Server-Readable
                    </button>
                    <button
                      type="button"
                      className={selectedChannel.privacy === "EndToEndEncrypted" ? "dr-chip dr-chip-active" : "dr-chip"}
                      onClick={() => actions.setChannelPrivacy(selectedChannel.id, "EndToEndEncrypted")}
                    >
                      E2EE
                    </button>
                  </div>
                ) : (
                  <div className="dr-actions">
                    <span className="dr-chip dr-chip-active">Direct Message</span>
                    <span className="dr-chip">E2EE</span>
                  </div>
                )}
                <div className="dr-actions">
                  <span className="dr-muted">Notifications:</span>
                  {(["all", "mentions", "mute"] as NotificationMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={notificationMode === mode ? "dr-chip dr-chip-active" : "dr-chip"}
                      onClick={() => actions.setNotificationMode(selectedChannel.id, mode)}
                    >
                      {notificationModeLabel(mode)}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </header>

          {typingUsers.length > 0 ? (
            <div className="dr-inline-banner">
              Typing: {typingUsers.join(", ")}
            </div>
          ) : null}

          {pinnedMessages.length > 0 ? (
            <div className="dr-inline-banner">
              Pinned: {pinnedMessages.map((message) => message.body).join(" | ")}
            </div>
          ) : null}

          <div className="dr-messages">
            {channelMessages.length === 0 ? (
              <p className="dr-muted">No messages yet.</p>
            ) : (
              channelMessages.map((message) => (
                <MessageCard
                  key={message.id}
                  message={message}
                  allowThread={selectedChannel?.kind === "server"}
                  authorPresence={presenceIndex[message.author]?.state}
                  replyTarget={
                    message.replyToId
                      ? channelMessages.find((entry) => entry.id === message.replyToId)
                      : undefined
                  }
                  onEdit={actions.editMessage}
                  onDelete={actions.deleteMessage}
                  onReact={actions.toggleReaction}
                  onReply={setReplyTarget}
                  onTogglePin={actions.togglePin}
                  onCreateThread={onCreateThread}
                />
              ))
            )}
          </div>

          <MessageComposer
            onSend={actions.sendMessage}
            replyTo={replyTarget}
            onClearReply={() => setReplyTarget(undefined)}
          />
        </main>

        <aside className="dr-panel dr-panel-agents">
          <h2>Relay Agents</h2>
          <div className="dr-policy-row">
            <span>Approval mode</span>
            <button
              type="button"
              onClick={() => actions.setAutoApproval(!state.agentPolicy.autoApproval)}
            >
              {state.agentPolicy.autoApproval ? "Auto" : "Manual"}
            </button>
          </div>
          <p className="dr-muted">
            Visibility: {state.agentPolicy.visibility} | Rate limit: {state.agentPolicy.maxEventsPerMinute}/min
          </p>

          <form className="dr-form" onSubmit={submitAgent}>
            <label htmlFor="agent-name">Agent Name</label>
            <input
              id="agent-name"
              value={agentName}
              onChange={(event) => setAgentName(event.target.value)}
              placeholder="Release Assistant"
            />

            <label htmlFor="agent-purpose">Purpose</label>
            <textarea
              id="agent-purpose"
              value={agentPurpose}
              onChange={(event) => setAgentPurpose(event.target.value)}
              placeholder="Summarize deployment status in #roadmap"
            />

            <label>Capabilities</label>
            <div className="dr-cap-grid">
              {ALL_CAPABILITIES.map((capability) => {
                const selected = agentCapabilities.includes(capability);
                return (
                  <button
                    key={capability}
                    type="button"
                    className={selected ? "dr-chip dr-chip-active" : "dr-chip"}
                    onClick={() =>
                      setAgentCapabilities((prev) => toggleCapability(prev, capability))
                    }
                  >
                    {capability}
                  </button>
                );
              })}
            </div>
            <button type="submit">Submit Agent</button>
          </form>

          <h3>Pending</h3>
          <div className="dr-list">
            {pendingAgents.length === 0 ? (
              <p className="dr-muted">No pending agents</p>
            ) : (
              pendingAgents.map((agent) => (
                <article key={agent.id} className="dr-card">
                  <strong>{agent.name}</strong>
                  <p>{agent.purpose}</p>
                  <p className="dr-muted">{agent.capabilities.join(", ")}</p>
                  <div className="dr-actions">
                    <button type="button" onClick={() => actions.approveAgent(agent.id)}>
                      Approve
                    </button>
                    <button
                      type="button"
                      className="dr-ghost"
                      onClick={() => actions.rejectAgent(agent.id)}
                    >
                      Reject
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>

          <h3>Public Agent Directory</h3>
          <div className="dr-list">
            {approvedAgents.length === 0 ? (
              <p className="dr-muted">No approved agents</p>
            ) : (
              approvedAgents.map((agent) => (
                <article key={agent.id} className="dr-card">
                  <strong>{agent.name}</strong>
                  <p>{agent.purpose}</p>
                  <p className="dr-muted">{agent.capabilities.join(", ")}</p>
                  <span className="dr-muted">
                    Approved {agent.reviewedAt ? formatTimestamp(agent.reviewedAt) : ""}
                  </span>
                </article>
              ))
            )}
          </div>

          <h3>Voice / Video</h3>
          <p className="dr-muted">
            Media transport policy:{" "}
            {selectedServer?.networkExposureMode === "RelayOnly"
              ? "relay-only ICE (no direct candidates)"
              : "hybrid ICE"}
          </p>
          <div className="dr-actions">
            <button
              type="button"
              onClick={() => state.selectedChannelId && actions.joinVoice(state.selectedChannelId)}
            >
              Join Voice
            </button>
            <button
              type="button"
              onClick={() => state.selectedChannelId && actions.joinVideo(state.selectedChannelId)}
            >
              Join Video
            </button>
            <button
              type="button"
              onClick={() =>
                state.selectedChannelId && actions.startScreenShare(state.selectedChannelId)
              }
            >
              Screen Share
            </button>
            <button type="button" className="dr-ghost" onClick={actions.leaveMediaSessions}>
              Leave
            </button>
          </div>
          <p className="dr-muted">
            Voice: {state.sessions.voiceChannelId ?? "off"} | Video: {state.sessions.videoChannelId ?? "off"}
          </p>

          <h3>Presence + Typing</h3>
          <div className="dr-form">
            <label htmlFor="presence-name">User</label>
            <input
              id="presence-name"
              value={presenceName}
              onChange={(event) => setPresenceName(event.target.value)}
              placeholder="Alex"
            />
            <div className="dr-actions">
              {(["online", "idle", "dnd", "offline"] as PresenceState[]).map((presence) => (
                <button
                  key={presence}
                  type="button"
                  className="dr-ghost"
                  onClick={() => actions.setPresence(presenceName, presence)}
                >
                  Set {presence}
                </button>
              ))}
            </div>
          </div>
          <form className="dr-form" onSubmit={submitIncoming}>
            <label htmlFor="incoming-author">Simulate Incoming</label>
            <input
              id="incoming-author"
              value={incomingAuthor}
              onChange={(event) => setIncomingAuthor(event.target.value)}
              placeholder="Alex"
            />
            <textarea
              value={incomingBody}
              onChange={(event) => setIncomingBody(event.target.value)}
              placeholder="@You migration draft is ready."
            />
            <div className="dr-actions">
              <button type="submit">Add Incoming Message</button>
              <button
                type="button"
                className="dr-ghost"
                onClick={() =>
                  selectedChannel &&
                  actions.setTyping(
                    selectedChannel.id,
                    incomingAuthor,
                    !typingUsers.includes(incomingAuthor.trim())
                  )
                }
              >
                {typingUsers.includes(incomingAuthor.trim()) ? "Stop Typing" : "Start Typing"}
              </button>
            </div>
          </form>

          <h3>Migration Import</h3>
          <textarea
            value={importPayload}
            onChange={(event) => setImportPayload(event.target.value)}
            className="dr-import-text"
          />
          <div className="dr-actions">
            <button type="button" onClick={() => actions.importDiscordExport(importPayload)}>
              Import JSON
            </button>
          </div>
          {state.importReport ? (
            <p className="dr-muted">
              Imported {state.importReport.importedChannels} channels and {state.importReport.importedMessages} messages.
            </p>
          ) : null}
          {state.importReport?.warnings.length ? (
            <p className="dr-muted">Warnings: {state.importReport.warnings.join(" | ")}</p>
          ) : null}
        </aside>
      </section>
    </div>
  );
}
