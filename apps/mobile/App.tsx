import React from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

type AgentStatus = "pending" | "approved" | "rejected";

type Agent = {
  id: string;
  name: string;
  purpose: string;
  status: AgentStatus;
};

type Message = {
  id: string;
  channelId: string;
  author: string;
  body: string;
};

type NotificationMode = "all" | "mentions" | "mute";

type NotificationSettings = {
  defaultServerMode: NotificationMode;
  defaultDirectMode: NotificationMode;
  channelOverrides: Record<string, NotificationMode>;
};

type Channel = {
  id: string;
  serverId: string;
  name: string;
  kind: "server" | "direct";
};

type Server = {
  id: string;
  name: string;
};

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function includesMention(body: string, displayName: string): boolean {
  const self = displayName.trim().toLowerCase();
  if (!self) {
    return false;
  }
  const normalized = body.toLowerCase();
  return normalized.includes(`@${self}`) || normalized.includes(self);
}

function formatUnreadLabel(unreadCount: number, mentionCount: number): string {
  if (unreadCount <= 0 && mentionCount <= 0) {
    return "";
  }
  if (mentionCount > 0 && unreadCount > 0) {
    return ` (@${mentionCount}/${unreadCount})`;
  }
  if (mentionCount > 0) {
    return ` (@${mentionCount})`;
  }
  return ` (${unreadCount})`;
}

export default function App() {
  const [servers, setServers] = React.useState<Server[]>([{ id: "s-1", name: "Launchpad" }]);
  const [channels, setChannels] = React.useState<Channel[]>([
    { id: "c-1", serverId: "s-1", name: "general", kind: "server" },
    { id: "c-2", serverId: "s-1", name: "roadmap", kind: "server" },
    { id: "dm-1", serverId: "__direct__", name: "alex", kind: "direct" },
    { id: "dm-2", serverId: "__direct__", name: "ops-sync", kind: "direct" }
  ]);
  const [messages, setMessages] = React.useState<Message[]>([
    { id: "m-1", channelId: "c-1", author: "System", body: "Welcome to RelayChat mobile." }
  ]);
  const [agents, setAgents] = React.useState<Agent[]>([
    {
      id: "a-1",
      name: "Build Monitor",
      purpose: "Post CI failures to #roadmap",
      status: "approved"
    },
    {
      id: "a-2",
      name: "Thread Summarizer",
      purpose: "Summarize long threads",
      status: "pending"
    }
  ]);

  const [selectedServerId, setSelectedServerId] = React.useState("s-1");
  const [selectedChannelId, setSelectedChannelId] = React.useState("c-1");
  const [displayName, setDisplayName] = React.useState("You");
  const [notificationSettings, setNotificationSettings] = React.useState<NotificationSettings>({
    defaultServerMode: "all",
    defaultDirectMode: "mentions",
    channelOverrides: {}
  });
  const [unread, setUnread] = React.useState({
    channels: { "c-2": 2, "dm-2": 1 } as Record<string, number>,
    mentions: { "dm-2": 1 } as Record<string, number>
  });
  const [newServerName, setNewServerName] = React.useState("");
  const [newChannelName, setNewChannelName] = React.useState("");
  const [newDirectName, setNewDirectName] = React.useState("");
  const [newMessage, setNewMessage] = React.useState("");
  const [incomingAuthor, setIncomingAuthor] = React.useState("Alex");
  const [incomingBody, setIncomingBody] = React.useState("@You can you review the rollout?");
  const [simulateBackground, setSimulateBackground] = React.useState(true);
  const [newAgentName, setNewAgentName] = React.useState("");
  const [newAgentPurpose, setNewAgentPurpose] = React.useState("");

  const visibleChannels = channels.filter(
    (channel) => channel.serverId === selectedServerId && channel.kind === "server"
  );
  const directChannels = channels.filter((channel) => channel.kind === "direct");
  const visibleMessages = messages.filter((message) => message.channelId === selectedChannelId);
  const selectedChannel = channels.find((channel) => channel.id === selectedChannelId) ?? null;
  const pendingAgents = agents.filter((agent) => agent.status === "pending");
  const approvedAgents = agents.filter((agent) => agent.status === "approved");
  const selectedChannelOverride = selectedChannel
    ? notificationSettings.channelOverrides[selectedChannel.id]
    : undefined;

  const resolveNotificationMode = (channelId: string): NotificationMode => {
    const override = notificationSettings.channelOverrides[channelId];
    if (override) {
      return override;
    }
    const channel = channels.find((entry) => entry.id === channelId);
    if (!channel) {
      return "all";
    }
    return channel.kind === "direct"
      ? notificationSettings.defaultDirectMode
      : notificationSettings.defaultServerMode;
  };

  const setChannelNotificationMode = (channelId: string, mode: NotificationMode) => {
    setNotificationSettings((prev) => ({
      ...prev,
      channelOverrides: {
        ...prev.channelOverrides,
        [channelId]: mode
      }
    }));
  };

  const setDefaultNotificationMode = (kind: "server" | "direct", mode: NotificationMode) => {
    setNotificationSettings((prev) =>
      kind === "direct"
        ? { ...prev, defaultDirectMode: mode }
        : { ...prev, defaultServerMode: mode }
    );
  };

  const clearChannelNotificationMode = (channelId: string) => {
    setNotificationSettings((prev) => {
      const nextOverrides = { ...prev.channelOverrides };
      delete nextOverrides[channelId];
      return {
        ...prev,
        channelOverrides: nextOverrides
      };
    });
  };

  const selectServer = (serverId: string) => {
    setSelectedServerId(serverId);
    const firstChannel = channels.find(
      (channel) => channel.serverId === serverId && channel.kind === "server"
    );
    if (firstChannel) {
      setSelectedChannelId(firstChannel.id);
      setUnread((prev) => ({
        channels: {
          ...prev.channels,
          [firstChannel.id]: 0
        },
        mentions: {
          ...prev.mentions,
          [firstChannel.id]: 0
        }
      }));
    }
  };

  const selectChannel = (channelId: string) => {
    setSelectedChannelId(channelId);
    setUnread((prev) => ({
      channels: {
        ...prev.channels,
        [channelId]: 0
      },
      mentions: {
        ...prev.mentions,
        [channelId]: 0
      }
    }));
  };

  const createServer = () => {
    const name = newServerName.trim();
    if (!name) {
      return;
    }

    const serverId = createId("s");
    const channelId = createId("c");

    setServers((prev) => [...prev, { id: serverId, name }]);
    setChannels((prev) => [
      ...prev,
      { id: channelId, serverId, name: "general", kind: "server" }
    ]);
    setSelectedServerId(serverId);
    setSelectedChannelId(channelId);
    setNewServerName("");
  };

  const createChannel = () => {
    const name = newChannelName.trim().toLowerCase().replace(/\s+/g, "-");
    if (!name || !selectedServerId) {
      return;
    }

    const channelId = createId("c");
    setChannels((prev) => [
      ...prev,
      { id: channelId, serverId: selectedServerId, name, kind: "server" }
    ]);
    setSelectedChannelId(channelId);
    setNewChannelName("");
  };

  const createDirect = () => {
    const name = newDirectName.trim().toLowerCase();
    if (!name) {
      return;
    }

    const channelId = createId("dm");
    setChannels((prev) => [
      ...prev,
      { id: channelId, serverId: "__direct__", name, kind: "direct" }
    ]);
    setSelectedChannelId(channelId);
    setNewDirectName("");
  };

  const sendMessage = () => {
    const body = newMessage.trim();
    if (!body || !selectedChannelId) {
      return;
    }

    setMessages((prev) => [
      ...prev,
      {
        id: createId("m"),
        channelId: selectedChannelId,
        author: displayName,
        body
      }
    ]);
    setNewMessage("");
  };

  const simulateIncoming = () => {
    const author = incomingAuthor.trim();
    const body = incomingBody.trim();
    if (!selectedChannelId || !author || !body) {
      return;
    }

    const targetChannelId = simulateBackground
      ? channels.find(
          (channel) =>
            channel.id !== selectedChannelId &&
            channel.kind === selectedChannel?.kind
        )?.id ?? selectedChannelId
      : selectedChannelId;

    setMessages((prev) => [
      ...prev,
      {
        id: createId("m"),
        channelId: targetChannelId,
        author,
        body
      }
    ]);

    const mode = resolveNotificationMode(targetChannelId);
    if (targetChannelId !== selectedChannelId && author !== displayName && mode !== "mute") {
      if (mode === "all") {
        setUnread((prev) => ({
          ...prev,
          channels: {
            ...prev.channels,
            [targetChannelId]: (prev.channels[targetChannelId] ?? 0) + 1
          }
        }));
      }

      if (includesMention(body, displayName) && (mode === "all" || mode === "mentions")) {
        setUnread((prev) => ({
          ...prev,
          mentions: {
            ...prev.mentions,
            [targetChannelId]: (prev.mentions[targetChannelId] ?? 0) + 1
          }
        }));
      }
    }
  };

  const submitAgent = () => {
    const name = newAgentName.trim();
    const purpose = newAgentPurpose.trim();
    if (!name || !purpose) {
      return;
    }

    setAgents((prev) => [
      {
        id: createId("a"),
        name,
        purpose,
        status: "pending"
      },
      ...prev
    ]);

    setNewAgentName("");
    setNewAgentPurpose("");
  };

  const updateAgent = (agentId: string, status: AgentStatus) => {
    setAgents((prev) =>
      prev.map((agent) => (agent.id === agentId ? { ...agent, status } : agent))
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>RelayChat Mobile</Text>
        <Text style={styles.subtitle}>Cross-platform shell for servers, channels, messages, and Relay Agents.</Text>

        <View style={styles.card}>
          <Text style={styles.heading}>Servers</Text>
          <View style={styles.rowWrap}>
            {servers.map((server) => (
              <Pressable
                key={server.id}
                style={server.id === selectedServerId ? styles.tagActive : styles.tag}
                onPress={() => selectServer(server.id)}
              >
                <Text style={server.id === selectedServerId ? styles.tagTextActive : styles.tagText}>
                  {server.name}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={styles.input}
            placeholder="New server"
            value={newServerName}
            onChangeText={setNewServerName}
          />
          <Pressable style={styles.button} onPress={createServer}>
            <Text style={styles.buttonText}>Create Server</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>Channels</Text>
          <View style={styles.rowWrap}>
            {visibleChannels.map((channel) => (
              <Pressable
                key={channel.id}
                style={channel.id === selectedChannelId ? styles.tagActive : styles.tag}
                onPress={() => selectChannel(channel.id)}
              >
                <Text style={channel.id === selectedChannelId ? styles.tagTextActive : styles.tagText}>
                  #{channel.name}
                  {formatUnreadLabel(
                    unread.channels[channel.id] ?? 0,
                    unread.mentions[channel.id] ?? 0
                  )}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={styles.input}
            placeholder="New channel"
            value={newChannelName}
            onChangeText={setNewChannelName}
          />
          <Pressable style={styles.button} onPress={createChannel}>
            <Text style={styles.buttonText}>Create Channel</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>Direct Messages</Text>
          <View style={styles.rowWrap}>
            {directChannels.map((channel) => (
              <Pressable
                key={channel.id}
                style={channel.id === selectedChannelId ? styles.tagActive : styles.tag}
                onPress={() => selectChannel(channel.id)}
              >
                <Text style={channel.id === selectedChannelId ? styles.tagTextActive : styles.tagText}>
                  @{channel.name}
                  {formatUnreadLabel(
                    unread.channels[channel.id] ?? 0,
                    unread.mentions[channel.id] ?? 0
                  )}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={styles.input}
            placeholder="New DM (name)"
            value={newDirectName}
            onChangeText={setNewDirectName}
          />
          <Pressable style={styles.button} onPress={createDirect}>
            <Text style={styles.buttonText}>Create DM</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>
            Messages {selectedChannel ? (selectedChannel.kind === "direct" ? `@${selectedChannel.name}` : `#${selectedChannel.name}`) : ""}
          </Text>
          <Text style={styles.subheading}>Notification Defaults</Text>
          <Text style={styles.muted}>Server channels</Text>
          <View style={styles.rowWrap}>
            {(["all", "mentions", "mute"] as NotificationMode[]).map((mode) => (
              <Pressable
                key={`server-default-${mode}`}
                style={notificationSettings.defaultServerMode === mode ? styles.tagActive : styles.tag}
                onPress={() => setDefaultNotificationMode("server", mode)}
              >
                <Text
                  style={
                    notificationSettings.defaultServerMode === mode
                      ? styles.tagTextActive
                      : styles.tagText
                  }
                >
                  {mode}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.muted}>Direct messages</Text>
          <View style={styles.rowWrap}>
            {(["all", "mentions", "mute"] as NotificationMode[]).map((mode) => (
              <Pressable
                key={`direct-default-${mode}`}
                style={notificationSettings.defaultDirectMode === mode ? styles.tagActive : styles.tag}
                onPress={() => setDefaultNotificationMode("direct", mode)}
              >
                <Text
                  style={
                    notificationSettings.defaultDirectMode === mode
                      ? styles.tagTextActive
                      : styles.tagText
                  }
                >
                  {mode}
                </Text>
              </Pressable>
            ))}
          </View>
          {selectedChannel ? (
            <Text style={styles.muted}>
              Notify: {resolveNotificationMode(selectedChannel.id)}{" "}
              {selectedChannelOverride ? "(channel override)" : "(default)"}
            </Text>
          ) : null}
          {selectedChannel ? (
            <View style={styles.rowWrap}>
              {(["all", "mentions", "mute"] as NotificationMode[]).map((mode) => (
                <Pressable
                  key={mode}
                  style={
                    resolveNotificationMode(selectedChannel.id) === mode
                      ? styles.tagActive
                      : styles.tag
                  }
                  onPress={() => setChannelNotificationMode(selectedChannel.id, mode)}
                >
                  <Text
                    style={
                      resolveNotificationMode(selectedChannel.id) === mode
                        ? styles.tagTextActive
                        : styles.tagText
                    }
                  >
                    {mode}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {selectedChannel && selectedChannelOverride ? (
            <Pressable
              style={styles.buttonGhost}
              onPress={() => clearChannelNotificationMode(selectedChannel.id)}
            >
              <Text style={styles.buttonGhostText}>Use Default for Channel</Text>
            </Pressable>
          ) : null}
          {visibleMessages.length === 0 ? (
            <Text style={styles.muted}>No messages</Text>
          ) : (
            visibleMessages.map((message) => (
              <View key={message.id} style={styles.messageRow}>
                <Text style={styles.messageAuthor}>{message.author}</Text>
                <Text style={styles.messageBody}>{message.body}</Text>
              </View>
            ))
          )}
          <TextInput
            style={styles.input}
            placeholder="Write a message"
            value={newMessage}
            onChangeText={setNewMessage}
          />
          <Pressable style={styles.button} onPress={sendMessage}>
            <Text style={styles.buttonText}>Send</Text>
          </Pressable>
          <TextInput
            style={styles.input}
            placeholder="Display name"
            value={displayName}
            onChangeText={setDisplayName}
          />
          <TextInput
            style={styles.input}
            placeholder="Incoming author"
            value={incomingAuthor}
            onChangeText={setIncomingAuthor}
          />
          <TextInput
            style={styles.input}
            placeholder="Incoming message"
            value={incomingBody}
            onChangeText={setIncomingBody}
          />
          <View style={styles.rowWrap}>
            <Pressable style={styles.buttonGhost} onPress={() => setSimulateBackground((prev) => !prev)}>
              <Text style={styles.buttonGhostText}>
                {simulateBackground ? "Background Delivery" : "Active Delivery"}
              </Text>
            </Pressable>
            <Pressable style={styles.buttonGhost} onPress={simulateIncoming}>
              <Text style={styles.buttonGhostText}>Simulate Incoming</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>Relay Agents</Text>
          <TextInput
            style={styles.input}
            placeholder="Agent name"
            value={newAgentName}
            onChangeText={setNewAgentName}
          />
          <TextInput
            style={styles.input}
            placeholder="Agent purpose"
            value={newAgentPurpose}
            onChangeText={setNewAgentPurpose}
          />
          <Pressable style={styles.button} onPress={submitAgent}>
            <Text style={styles.buttonText}>Submit Agent</Text>
          </Pressable>

          <Text style={styles.subheading}>Pending</Text>
          {pendingAgents.length === 0 ? (
            <Text style={styles.muted}>No pending agents</Text>
          ) : (
            pendingAgents.map((agent) => (
              <View key={agent.id} style={styles.messageRow}>
                <Text style={styles.messageAuthor}>{agent.name}</Text>
                <Text style={styles.messageBody}>{agent.purpose}</Text>
                <View style={styles.rowWrap}>
                  <Pressable style={styles.buttonGhost} onPress={() => updateAgent(agent.id, "approved")}>
                    <Text style={styles.buttonGhostText}>Approve</Text>
                  </Pressable>
                  <Pressable style={styles.buttonGhost} onPress={() => updateAgent(agent.id, "rejected")}>
                    <Text style={styles.buttonGhostText}>Reject</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}

          <Text style={styles.subheading}>Public Agent Directory</Text>
          {approvedAgents.length === 0 ? (
            <Text style={styles.muted}>No approved agents</Text>
          ) : (
            approvedAgents.map((agent) => (
              <View key={agent.id} style={styles.messageRow}>
                <Text style={styles.messageAuthor}>{agent.name}</Text>
                <Text style={styles.messageBody}>{agent.purpose}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#edf3fb"
  },
  container: {
    padding: 16,
    gap: 14
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#10223b"
  },
  subtitle: {
    marginTop: 4,
    color: "#44607f",
    fontSize: 13
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#d8e3f3",
    gap: 8
  },
  heading: {
    fontSize: 18,
    fontWeight: "600",
    color: "#10223b"
  },
  subheading: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "600",
    color: "#28476f"
  },
  rowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  input: {
    borderWidth: 1,
    borderColor: "#c8d8ee",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#fdfefe"
  },
  button: {
    backgroundColor: "#0d4ea6",
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 14,
    alignItems: "center"
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 12
  },
  buttonGhost: {
    borderColor: "#bfd1ea",
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10
  },
  buttonGhostText: {
    color: "#345476",
    fontSize: 12,
    fontWeight: "500"
  },
  tag: {
    backgroundColor: "#eef4ff",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#c8d8ee"
  },
  tagActive: {
    backgroundColor: "#0d4ea6",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#0d4ea6"
  },
  tagText: {
    color: "#2f4f73",
    fontSize: 12
  },
  tagTextActive: {
    color: "#ffffff",
    fontSize: 12
  },
  messageRow: {
    borderWidth: 1,
    borderColor: "#d9e5f5",
    borderRadius: 10,
    padding: 10,
    gap: 4
  },
  messageAuthor: {
    fontWeight: "600",
    color: "#123056"
  },
  messageBody: {
    color: "#2f4f73",
    fontSize: 13,
    lineHeight: 18
  },
  muted: {
    color: "#5f7896",
    fontSize: 12
  }
});
