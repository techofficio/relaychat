use serde::{Deserialize, Serialize};

use relaychat_core::{
    AgentPolicy, AgentRegistration, CapabilityGrant, ChannelId, Event, EventId, PublicKey,
    ServerId, SignedRecord, Timestamp, UserId,
};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct PeerId(pub PublicKey);

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncCursor {
    pub server: ServerId,
    pub channel: ChannelId,
    pub last_event: Option<EventId>,
    pub updated_at: Timestamp,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerSnapshot {
    pub server: ServerId,
    pub channels: Vec<ChannelId>,
    pub cursors: Vec<SyncCursor>,
    pub generated_at: Timestamp,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncRequest {
    pub requester: UserId,
    pub server: ServerId,
    pub channel: ChannelId,
    pub cursor: Option<SyncCursor>,
    pub since: Option<Timestamp>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncResponse {
    pub server: ServerId,
    pub channel: ChannelId,
    pub snapshot: Option<ServerSnapshot>,
    pub events: Vec<Event>,
    pub head: Option<EventId>,
    pub next_cursor: SyncCursor,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishEvent {
    pub server: ServerId,
    pub event: SignedRecord<Event>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentRegistrationMessage {
    pub server: ServerId,
    pub registration: SignedRecord<AgentRegistration>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentApprovalMessage {
    pub server: ServerId,
    pub grant: SignedRecord<CapabilityGrant>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentPolicyUpdate {
    pub server: ServerId,
    pub policy: SignedRecord<AgentPolicy>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PresenceUpdate {
    pub server: ServerId,
    pub channel: Option<ChannelId>,
    pub user: UserId,
    pub state: PresenceState,
    pub last_active: Timestamp,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PresenceState {
    Online,
    Idle,
    Dnd,
    Offline,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TypingUpdate {
    pub server: ServerId,
    pub channel: ChannelId,
    pub user: UserId,
    pub typing: bool,
    pub updated_at: Timestamp,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum DataPlaneRpc {
    SyncRequest(SyncRequest),
    SyncResponse(SyncResponse),
    PublishEvent(PublishEvent),
    Presence(PresenceUpdate),
    Typing(TypingUpdate),
    AgentRegistration(AgentRegistrationMessage),
    AgentApproval(AgentApprovalMessage),
    AgentPolicy(AgentPolicyUpdate),
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Handshake {
    pub peer: PeerId,
    pub protocol_version: u16,
    pub timestamp: Timestamp,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum NetworkEnvelope {
    Handshake(Handshake),
    Rpc(DataPlaneRpc),
}

#[cfg(test)]
mod tests {
    use super::*;

    fn server(seed: u8) -> ServerId {
        ServerId([seed; 32])
    }

    fn channel(seed: u8) -> ChannelId {
        ChannelId([seed; 32])
    }

    fn user(seed: u8) -> UserId {
        UserId([seed; 32])
    }

    #[test]
    fn typing_rpc_roundtrip() {
        let rpc = DataPlaneRpc::Typing(TypingUpdate {
            server: server(7),
            channel: channel(11),
            user: user(3),
            typing: true,
            updated_at: 1_739_300_001,
        });

        let raw = serde_json::to_string(&rpc).expect("serialize typing rpc");
        let decoded: DataPlaneRpc = serde_json::from_str(&raw).expect("deserialize typing rpc");
        assert_eq!(decoded, rpc);
    }

    #[test]
    fn presence_rpc_roundtrip() {
        let rpc = DataPlaneRpc::Presence(PresenceUpdate {
            server: server(9),
            channel: None,
            user: user(5),
            state: PresenceState::Idle,
            last_active: 1_739_300_100,
        });

        let raw = serde_json::to_string(&rpc).expect("serialize presence rpc");
        let decoded: DataPlaneRpc = serde_json::from_str(&raw).expect("deserialize presence rpc");
        assert_eq!(decoded, rpc);
    }
}
