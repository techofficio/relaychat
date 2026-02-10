use std::{collections::HashMap, net::SocketAddr, sync::Arc};

use axum::{
    extract::{Path, State},
    http::{header, HeaderValue, Method, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use relaychat_core::{
    AgentVisibility, ChannelPrivacy, Event, NetworkExposureMode, ServerId, SignedRecord,
};
use relaychat_crypto::verify_signed_record;
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;
use tower_http::{
    cors::{AllowOrigin, CorsLayer},
    set_header::SetResponseHeaderLayer,
};
use uuid::Uuid;

#[derive(Clone, Debug)]
struct RelaySecurityConfig {
    redact_client_ip: bool,
    retain_raw_ip: bool,
    enforce_relay_for_media: bool,
    direct_peer_allowed_default: bool,
    allowed_origins: Vec<String>,
}

impl Default for RelaySecurityConfig {
    fn default() -> Self {
        Self {
            redact_client_ip: true,
            retain_raw_ip: false,
            enforce_relay_for_media: true,
            direct_peer_allowed_default: false,
            allowed_origins: vec![
                "http://localhost:5173".to_string(),
                "http://localhost:5174".to_string(),
            ],
        }
    }
}

#[derive(Clone, Debug, Default)]
struct RelayState {
    security: RelaySecurityConfig,
    recovery_kits: HashMap<String, String>,
    servers: HashMap<String, ServerRecord>,
    agents_public: HashMap<String, Vec<PublicAgent>>, // keyed by server id
    media_sessions: HashMap<String, MediaSessionRecord>,
    accepted_events: HashMap<String, Vec<SignedRecord<Event>>>, // keyed by server id
    presence_index: HashMap<String, HashMap<String, PresenceRecord>>, // server -> user -> presence
    typing_index: HashMap<String, HashMap<String, HashMap<String, TypingRecord>>>, // server -> channel -> user -> typing
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct ServerRecord {
    id: String,
    name: String,
    owner_public_key: String,
    default_channel_privacy: ChannelPrivacy,
    network_exposure_mode: NetworkExposureMode,
    direct_peer_allowed: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct PublicAgent {
    id: String,
    name: String,
    purpose: String,
    capabilities: Vec<String>,
    visibility: AgentVisibility,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct MediaTransportPolicyRecord {
    exposure_mode: NetworkExposureMode,
    ice_transport_policy: String,
    allow_host_candidates: bool,
    allow_srflx_candidates: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct IceCandidateRecord {
    candidate: String,
    candidate_type: String,
    protocol: String,
    sdp_mid: Option<String>,
    sdp_mline_index: Option<u32>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct MediaSessionRecord {
    session_id: String,
    server_id: String,
    channel_id: String,
    mode: String,
    transport_policy: MediaTransportPolicyRecord,
    accepted_candidates: usize,
    rejected_candidates: usize,
}

#[derive(Clone, Debug, Deserialize)]
struct RecoveryKitRequest {
    device_id: String,
    encrypted_kit: String,
}

#[derive(Clone, Debug, Serialize)]
struct RecoveryKitResponse {
    accepted: bool,
}

#[derive(Clone, Debug, Deserialize)]
struct CreateServerRequest {
    name: String,
    owner_public_key: String,
    network_exposure_mode: Option<NetworkExposureMode>,
}

#[derive(Clone, Debug, Serialize)]
struct CreateServerResponse {
    server_id: String,
    invite_code: String,
    network_exposure_mode: NetworkExposureMode,
}

#[derive(Clone, Debug, Deserialize)]
struct CreateInviteRequest {
    role: String,
}

#[derive(Clone, Debug, Serialize)]
struct CreateInviteResponse {
    invite_code: String,
    role: String,
}

#[derive(Clone, Debug, Deserialize)]
struct ImportDiscordExportRequest {
    payload: serde_json::Value,
}

#[derive(Clone, Debug, Serialize)]
struct ImportDiscordExportResponse {
    imported_channels: usize,
    imported_messages: usize,
    warnings: Vec<String>,
}

#[derive(Clone, Debug, Deserialize)]
struct PublishEventRequest {
    event: SignedRecord<Event>,
}

#[derive(Clone, Debug, Serialize)]
struct PublishEventResponse {
    accepted: bool,
    reason: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
struct PublicAgentsResponse {
    agents: Vec<PublicAgent>,
}

#[derive(Clone, Debug, Serialize)]
struct SecurityStatusResponse {
    redact_client_ip: bool,
    retain_raw_ip: bool,
    enforce_relay_for_media: bool,
    direct_peer_allowed_default: bool,
    allowed_origins: Vec<String>,
}

#[derive(Clone, Debug, Deserialize)]
struct CreateMediaSessionRequest {
    server_id: String,
    channel_id: String,
    mode: String,
}

#[derive(Clone, Debug, Serialize)]
struct CreateMediaSessionResponse {
    session_id: String,
    transport_policy: MediaTransportPolicyRecord,
    ice_servers: Vec<IceServerRecord>,
}

#[derive(Clone, Debug, Serialize)]
struct IceServerRecord {
    urls: Vec<String>,
    username: Option<String>,
    credential: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
struct SubmitMediaCandidatesRequest {
    candidates: Vec<IceCandidateRecord>,
}

#[derive(Clone, Debug, Serialize)]
struct SubmitMediaCandidatesResponse {
    accepted: usize,
    rejected: usize,
    reasons: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
enum PresenceStateRecord {
    Online,
    Idle,
    Dnd,
    Offline,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PresenceRecord {
    user: String,
    state: PresenceStateRecord,
    channel_id: Option<String>,
    last_active: i64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpsertPresenceRequest {
    user: String,
    state: PresenceStateRecord,
    channel_id: Option<String>,
    last_active: Option<i64>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct UpsertPresenceResponse {
    accepted: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ListPresenceResponse {
    presence: Vec<PresenceRecord>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TypingRecord {
    user: String,
    typing: bool,
    updated_at: i64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpsertTypingRequest {
    channel_id: String,
    user: String,
    typing: bool,
    updated_at: Option<i64>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct UpsertTypingResponse {
    accepted: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ListTypingResponse {
    channel_id: String,
    typing: Vec<TypingRecord>,
}

fn current_timestamp() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0)
}

fn build_cors(origins: &[String]) -> CorsLayer {
    let mut parsed = Vec::new();
    for origin in origins {
        if let Ok(value) = HeaderValue::from_str(origin) {
            parsed.push(value);
        }
    }

    CorsLayer::new()
        .allow_methods([Method::GET, Method::POST])
        .allow_headers([header::CONTENT_TYPE])
        .allow_origin(AllowOrigin::list(parsed))
}

fn media_policy_for_server(
    server: &ServerRecord,
    security: &RelaySecurityConfig,
) -> MediaTransportPolicyRecord {
    let relay_only = security.enforce_relay_for_media
        || matches!(server.network_exposure_mode, NetworkExposureMode::RelayOnly)
        || !server.direct_peer_allowed;

    if relay_only {
        return MediaTransportPolicyRecord {
            exposure_mode: NetworkExposureMode::RelayOnly,
            ice_transport_policy: "relay".to_string(),
            allow_host_candidates: false,
            allow_srflx_candidates: false,
        };
    }

    MediaTransportPolicyRecord {
        exposure_mode: NetworkExposureMode::Hybrid,
        ice_transport_policy: "all".to_string(),
        allow_host_candidates: true,
        allow_srflx_candidates: true,
    }
}

fn candidate_allowed(candidate: &IceCandidateRecord, policy: &MediaTransportPolicyRecord) -> bool {
    if policy.ice_transport_policy == "relay" {
        return candidate.candidate_type == "relay";
    }

    if candidate.candidate_type == "host" && !policy.allow_host_candidates {
        return false;
    }

    if candidate.candidate_type == "srflx" && !policy.allow_srflx_candidates {
        return false;
    }

    true
}

#[tokio::main]
async fn main() {
    let initial = RelayState {
        security: RelaySecurityConfig::default(),
        ..RelayState::default()
    };

    let security = initial.security.clone();
    let shared = Arc::new(RwLock::new(initial));

    let app = Router::new()
        .route("/health", get(health))
        .route("/v1/security/status", get(get_security_status))
        .route("/v1/identity/recovery-kit", post(post_recovery_kit))
        .route("/v1/servers", post(post_servers))
        .route("/v1/servers/:server_id/invites", post(post_server_invites))
        .route(
            "/v1/servers/:server_id/import/discord-export",
            post(post_server_import),
        )
        .route(
            "/v1/servers/:server_id/events/publish",
            post(post_server_publish_event),
        )
        .route(
            "/v1/servers/:server_id/presence",
            post(post_server_presence),
        )
        .route("/v1/servers/:server_id/presence", get(get_server_presence))
        .route("/v1/servers/:server_id/typing", post(post_server_typing))
        .route(
            "/v1/servers/:server_id/typing/:channel_id",
            get(get_server_typing),
        )
        .route(
            "/v1/servers/:server_id/agents/public",
            get(get_server_public_agents),
        )
        .route("/v1/media/sessions", post(post_media_session))
        .route(
            "/v1/media/sessions/:session_id/candidates",
            post(post_media_candidates),
        )
        .with_state(shared)
        .layer(build_cors(&security.allowed_origins))
        .layer(SetResponseHeaderLayer::if_not_present(
            header::X_CONTENT_TYPE_OPTIONS,
            HeaderValue::from_static("nosniff"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            header::X_FRAME_OPTIONS,
            HeaderValue::from_static("DENY"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            header::REFERRER_POLICY,
            HeaderValue::from_static("strict-origin-when-cross-origin"),
        ));

    let addr: SocketAddr = "127.0.0.1:8787".parse().expect("valid relay socket");
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("bind relay socket");

    axum::serve(listener, app).await.expect("run relay node");
}

async fn health() -> impl IntoResponse {
    (StatusCode::OK, "ok")
}

async fn get_security_status(
    State(state): State<Arc<RwLock<RelayState>>>,
) -> Json<SecurityStatusResponse> {
    let lock = state.read().await;
    Json(SecurityStatusResponse {
        redact_client_ip: lock.security.redact_client_ip,
        retain_raw_ip: lock.security.retain_raw_ip,
        enforce_relay_for_media: lock.security.enforce_relay_for_media,
        direct_peer_allowed_default: lock.security.direct_peer_allowed_default,
        allowed_origins: lock.security.allowed_origins.clone(),
    })
}

async fn post_recovery_kit(
    State(state): State<Arc<RwLock<RelayState>>>,
    Json(request): Json<RecoveryKitRequest>,
) -> Json<RecoveryKitResponse> {
    let mut lock = state.write().await;

    // Relay keeps encrypted kits only and does not store source IP metadata.
    lock.recovery_kits
        .insert(request.device_id, request.encrypted_kit);

    Json(RecoveryKitResponse { accepted: true })
}

async fn post_servers(
    State(state): State<Arc<RwLock<RelayState>>>,
    Json(request): Json<CreateServerRequest>,
) -> Json<CreateServerResponse> {
    let id = Uuid::new_v4().simple().to_string();
    let invite_code = format!("rv-{}", Uuid::new_v4().simple());

    let mut lock = state.write().await;

    let network_exposure_mode = request
        .network_exposure_mode
        .unwrap_or(NetworkExposureMode::RelayOnly);

    let record = ServerRecord {
        id: id.clone(),
        name: request.name,
        owner_public_key: request.owner_public_key,
        default_channel_privacy: ChannelPrivacy::ServerReadable,
        network_exposure_mode: network_exposure_mode.clone(),
        direct_peer_allowed: if matches!(network_exposure_mode, NetworkExposureMode::RelayOnly) {
            false
        } else {
            lock.security.direct_peer_allowed_default
        },
    };

    lock.servers.insert(id.clone(), record);
    lock.agents_public.entry(id.clone()).or_default();
    lock.accepted_events.entry(id.clone()).or_default();
    lock.presence_index.entry(id.clone()).or_default();
    lock.typing_index.entry(id.clone()).or_default();

    Json(CreateServerResponse {
        server_id: id,
        invite_code,
        network_exposure_mode,
    })
}

async fn post_server_invites(
    Path(server_id): Path<String>,
    State(state): State<Arc<RwLock<RelayState>>>,
    Json(request): Json<CreateInviteRequest>,
) -> Result<Json<CreateInviteResponse>, StatusCode> {
    let lock = state.read().await;
    if !lock.servers.contains_key(&server_id) {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(Json(CreateInviteResponse {
        invite_code: format!("rv-{}", Uuid::new_v4().simple()),
        role: request.role,
    }))
}

async fn post_server_import(
    Path(server_id): Path<String>,
    State(state): State<Arc<RwLock<RelayState>>>,
    Json(request): Json<ImportDiscordExportRequest>,
) -> Result<Json<ImportDiscordExportResponse>, StatusCode> {
    let lock = state.read().await;
    if !lock.servers.contains_key(&server_id) {
        return Err(StatusCode::NOT_FOUND);
    }

    let imported_channels = request
        .payload
        .get("channels")
        .and_then(|value| value.as_array())
        .map(|channels| channels.len())
        .unwrap_or(0);

    let imported_messages = request
        .payload
        .get("messages")
        .and_then(|value| value.as_array())
        .map(|messages| messages.len())
        .unwrap_or(0);

    Ok(Json(ImportDiscordExportResponse {
        imported_channels,
        imported_messages,
        warnings: vec![
            "Importer is scaffolded; role mapping and full attachment import are pending."
                .to_string(),
            "Relay-only transport is enforced by default to avoid peer IP exposure.".to_string(),
        ],
    }))
}

async fn post_server_publish_event(
    Path(server_id): Path<String>,
    State(state): State<Arc<RwLock<RelayState>>>,
    Json(request): Json<PublishEventRequest>,
) -> Result<Json<PublishEventResponse>, StatusCode> {
    let mut lock = state.write().await;
    if !lock.servers.contains_key(&server_id) {
        return Err(StatusCode::NOT_FOUND);
    }

    let is_valid = verify_signed_record(&request.event).map_err(|_| StatusCode::BAD_REQUEST)?;
    if !is_valid {
        return Ok(Json(PublishEventResponse {
            accepted: false,
            reason: Some("invalid signature".to_string()),
        }));
    }

    lock.accepted_events
        .entry(server_id)
        .or_default()
        .push(request.event);

    Ok(Json(PublishEventResponse {
        accepted: true,
        reason: None,
    }))
}

async fn post_server_presence(
    Path(server_id): Path<String>,
    State(state): State<Arc<RwLock<RelayState>>>,
    Json(request): Json<UpsertPresenceRequest>,
) -> Result<Json<UpsertPresenceResponse>, StatusCode> {
    let mut lock = state.write().await;
    if !lock.servers.contains_key(&server_id) {
        return Err(StatusCode::NOT_FOUND);
    }

    let record = PresenceRecord {
        user: request.user.clone(),
        state: request.state,
        channel_id: request.channel_id,
        last_active: request.last_active.unwrap_or_else(current_timestamp),
    };

    lock.presence_index
        .entry(server_id)
        .or_default()
        .insert(request.user, record);

    Ok(Json(UpsertPresenceResponse { accepted: true }))
}

async fn get_server_presence(
    Path(server_id): Path<String>,
    State(state): State<Arc<RwLock<RelayState>>>,
) -> Result<Json<ListPresenceResponse>, StatusCode> {
    let lock = state.read().await;
    if !lock.servers.contains_key(&server_id) {
        return Err(StatusCode::NOT_FOUND);
    }

    let presence = lock
        .presence_index
        .get(&server_id)
        .map(|index| index.values().cloned().collect())
        .unwrap_or_default();

    Ok(Json(ListPresenceResponse { presence }))
}

async fn post_server_typing(
    Path(server_id): Path<String>,
    State(state): State<Arc<RwLock<RelayState>>>,
    Json(request): Json<UpsertTypingRequest>,
) -> Result<Json<UpsertTypingResponse>, StatusCode> {
    let mut lock = state.write().await;
    if !lock.servers.contains_key(&server_id) {
        return Err(StatusCode::NOT_FOUND);
    }

    let updated_at = request.updated_at.unwrap_or_else(current_timestamp);
    let channel = lock.typing_index.entry(server_id).or_default();
    let users = channel.entry(request.channel_id).or_default();
    users.insert(
        request.user.clone(),
        TypingRecord {
            user: request.user,
            typing: request.typing,
            updated_at,
        },
    );

    Ok(Json(UpsertTypingResponse { accepted: true }))
}

async fn get_server_typing(
    Path((server_id, channel_id)): Path<(String, String)>,
    State(state): State<Arc<RwLock<RelayState>>>,
) -> Result<Json<ListTypingResponse>, StatusCode> {
    let lock = state.read().await;
    if !lock.servers.contains_key(&server_id) {
        return Err(StatusCode::NOT_FOUND);
    }

    let typing = lock
        .typing_index
        .get(&server_id)
        .and_then(|channels| channels.get(&channel_id))
        .map(|users| {
            users
                .values()
                .filter(|entry| entry.typing)
                .cloned()
                .collect()
        })
        .unwrap_or_default();

    Ok(Json(ListTypingResponse { channel_id, typing }))
}

async fn get_server_public_agents(
    Path(server_id): Path<String>,
    State(state): State<Arc<RwLock<RelayState>>>,
) -> Result<Json<PublicAgentsResponse>, StatusCode> {
    let lock = state.read().await;
    if !lock.servers.contains_key(&server_id) {
        return Err(StatusCode::NOT_FOUND);
    }

    let agents = lock
        .agents_public
        .get(&server_id)
        .cloned()
        .unwrap_or_default();
    Ok(Json(PublicAgentsResponse { agents }))
}

async fn post_media_session(
    State(state): State<Arc<RwLock<RelayState>>>,
    Json(request): Json<CreateMediaSessionRequest>,
) -> Result<Json<CreateMediaSessionResponse>, StatusCode> {
    let mut lock = state.write().await;
    let Some(server) = lock.servers.get(&request.server_id).cloned() else {
        return Err(StatusCode::NOT_FOUND);
    };

    let policy = media_policy_for_server(&server, &lock.security);
    let session_id = format!("media-{}", Uuid::new_v4().simple());

    let session = MediaSessionRecord {
        session_id: session_id.clone(),
        server_id: request.server_id,
        channel_id: request.channel_id,
        mode: request.mode,
        transport_policy: policy.clone(),
        accepted_candidates: 0,
        rejected_candidates: 0,
    };

    lock.media_sessions.insert(session_id.clone(), session);

    Ok(Json(CreateMediaSessionResponse {
        session_id,
        transport_policy: policy,
        ice_servers: vec![
            IceServerRecord {
                urls: vec!["stun:relaychat.local:3478".to_string()],
                username: None,
                credential: None,
            },
            IceServerRecord {
                urls: vec!["turn:relaychat.local:3478?transport=udp".to_string()],
                username: Some("relay-user".to_string()),
                credential: Some("ephemeral-token".to_string()),
            },
        ],
    }))
}

async fn post_media_candidates(
    Path(session_id): Path<String>,
    State(state): State<Arc<RwLock<RelayState>>>,
    Json(request): Json<SubmitMediaCandidatesRequest>,
) -> Result<Json<SubmitMediaCandidatesResponse>, StatusCode> {
    let mut lock = state.write().await;
    let Some(session) = lock.media_sessions.get_mut(&session_id) else {
        return Err(StatusCode::NOT_FOUND);
    };

    let mut accepted = 0usize;
    let mut rejected = 0usize;
    let mut reasons = Vec::new();

    for candidate in &request.candidates {
        if candidate_allowed(candidate, &session.transport_policy) {
            accepted += 1;
        } else {
            rejected += 1;
        }
    }

    if rejected > 0 {
        reasons.push("Non-relay ICE candidates were rejected by policy.".to_string());
    }

    session.accepted_candidates += accepted;
    session.rejected_candidates += rejected;

    Ok(Json(SubmitMediaCandidatesResponse {
        accepted,
        rejected,
        reasons,
    }))
}

#[allow(dead_code)]
fn parse_server_id_from_hex(_id: &str) -> Option<ServerId> {
    // The relay uses UUID strings at the HTTP layer and maps them to binary ids in core services.
    None
}
