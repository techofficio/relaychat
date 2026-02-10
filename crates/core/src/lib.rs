use serde::{Deserialize, Serialize};

pub type Timestamp = i64;

#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct UserId(pub [u8; 32]);

#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct DeviceId(pub [u8; 16]);

#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ChannelId(pub [u8; 32]);

#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct EventId(pub [u8; 32]);

#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ServerId(pub [u8; 32]);

#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct RoleId(pub [u8; 16]);

#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct AgentId(pub [u8; 32]);

#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct PublicKey(pub [u8; 32]);

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Signature(pub Vec<u8>);

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Identity {
    pub user_id: UserId,
    pub device_id: DeviceId,
    pub public_key: PublicKey,
    pub display_name: String,
}

pub trait Signer {
    fn public_key(&self) -> PublicKey;
    fn sign(&self, payload: &[u8]) -> Signature;
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct SignedRecord<T> {
    pub payload: T,
    pub author: PublicKey,
    pub signature: Signature,
    pub signed_at: Timestamp,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum ChannelPrivacy {
    ServerReadable,
    EndToEndEncrypted,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ContentPolicy {
    pub allow_external_media: bool,
    pub blocked_terms: Vec<String>,
    pub max_message_length: usize,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct RateLimits {
    pub user_events_per_minute: u32,
    pub agent_events_per_minute: u32,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum NetworkExposureMode {
    RelayOnly,
    Hybrid,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct NetworkPrivacyPolicy {
    pub exposure_mode: NetworkExposureMode,
    pub redact_client_ip: bool,
    pub retain_raw_ip: bool,
    pub require_enterprise_sso: bool,
    pub enforce_relay_for_media: bool,
    pub allow_direct_candidates: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum AgentApprovalMode {
    Manual,
    Auto,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum AgentVisibility {
    Public,
    Private,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct AgentPolicy {
    pub approval_mode: AgentApprovalMode,
    pub visibility: AgentVisibility,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ServerPolicy {
    pub default_channel_privacy: ChannelPrivacy,
    pub agent_policy: AgentPolicy,
    pub content_policy: ContentPolicy,
    pub rate_limits: RateLimits,
    pub network_privacy: NetworkPrivacyPolicy,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum EventKind {
    Message,
    Edit,
    Reaction,
    Delete,
    Reply,
    Pin,
    Unpin,
    ThreadCreate,
    ThreadArchive,
    Attachment,
    VoiceSessionJoin,
    VoiceSessionLeave,
    VideoSessionJoin,
    VideoSessionLeave,
    ScreenShareStart,
    ScreenShareStop,
    System,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct AttachmentMeta {
    pub id: String,
    pub filename: String,
    pub mime_type: String,
    pub size_bytes: u64,
    pub content_hash: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct MessagePayload {
    pub body: String,
    pub reply_to: Option<EventId>,
    pub attachments: Vec<AttachmentMeta>,
    pub mentions: Vec<UserId>,
    pub thread_id: Option<ChannelId>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Event {
    pub id: EventId,
    pub server: ServerId,
    pub channel: ChannelId,
    pub author: UserId,
    pub device: DeviceId,
    pub created_at: Timestamp,
    pub kind: EventKind,
    pub payload: Option<MessagePayload>,
    pub prev: Option<EventId>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ChannelMeta {
    pub id: ChannelId,
    pub server: ServerId,
    pub name: String,
    pub privacy: ChannelPrivacy,
    pub topic: Option<String>,
    pub created_at: Timestamp,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ServerMeta {
    pub id: ServerId,
    pub name: String,
    pub policy: ServerPolicy,
    pub created_at: Timestamp,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum Capability {
    ReadChannel,
    PostChannel,
    ReactChannel,
    ModerateChannel,
    DmUser,
    SummarizeChannel,
    JoinVoice,
    JoinVideo,
    StartScreenShare,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum CapabilityScope {
    Server(ServerId),
    Channel(ChannelId),
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct AgentRegistration {
    pub agent_id: AgentId,
    pub public_key: PublicKey,
    pub display_name: String,
    pub purpose: String,
    pub requested_capabilities: Vec<Capability>,
    pub requested_scopes: Vec<CapabilityScope>,
    pub created_at: Timestamp,
    pub contact: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct CapabilityGrant {
    pub agent_id: AgentId,
    pub issued_by: UserId,
    pub capabilities: Vec<Capability>,
    pub scopes: Vec<CapabilityScope>,
    pub max_events_per_minute: Option<u32>,
    pub allowed_channels: Vec<ChannelId>,
    pub issued_at: Timestamp,
    pub expires_at: Option<Timestamp>,
    pub reason: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum PermissionAction {
    ManageServer,
    ManageRoles,
    ManageChannels,
    ManageMessages,
    ManageThreads,
    ManageVoice,
    ManageVideo,
    ManageAgents,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct PermissionGrant {
    pub server: ServerId,
    pub channel: Option<ChannelId>,
    pub role: RoleId,
    pub granted_by: UserId,
    pub actions: Vec<PermissionAction>,
    pub created_at: Timestamp,
    pub expires_at: Option<Timestamp>,
}
