use std::collections::HashMap;

use relaychat_core::{
    AgentApprovalMode, AgentId, AgentPolicy, AgentRegistration, AgentVisibility, CapabilityGrant,
    ChannelId, DeviceId, Event, EventId, EventKind, ServerId, UserId,
};
use rusqlite::{params, Connection};

#[derive(Debug)]
pub enum StoreError {
    Sql(rusqlite::Error),
    Json(serde_json::Error),
}

impl From<rusqlite::Error> for StoreError {
    fn from(value: rusqlite::Error) -> Self {
        Self::Sql(value)
    }
}

impl From<serde_json::Error> for StoreError {
    fn from(value: serde_json::Error) -> Self {
        Self::Json(value)
    }
}

pub trait EventStore {
    fn append(&mut self, event: Event) -> Result<(), StoreError>;
    fn channel_events(&self, channel: &ChannelId) -> Result<Vec<Event>, StoreError>;
    fn events_since(
        &self,
        channel: &ChannelId,
        after: Option<&EventId>,
    ) -> Result<Vec<Event>, StoreError>;
    fn head(&self, channel: &ChannelId) -> Result<Option<EventId>, StoreError>;
}

pub trait SyncCursorStore {
    fn upsert_cursor(
        &mut self,
        channel: &ChannelId,
        event_id: Option<&EventId>,
        updated_at: i64,
    ) -> Result<(), StoreError>;
    fn cursor(&self, channel: &ChannelId) -> Result<Option<EventId>, StoreError>;
}

pub trait AgentRegistryStore {
    fn policy(&self) -> &AgentPolicy;
    fn set_policy(&mut self, policy: AgentPolicy) -> Result<(), StoreError>;
    fn submit(&mut self, registration: AgentRegistration) -> Result<(), StoreError>;
    fn approve(&mut self, agent_id: &AgentId, grant: CapabilityGrant) -> Result<bool, StoreError>;
    fn reject(&mut self, agent_id: &AgentId) -> Result<bool, StoreError>;
    fn pending(&self) -> Result<Vec<AgentRegistration>, StoreError>;
    fn approved(&self) -> Result<Vec<(AgentRegistration, CapabilityGrant)>, StoreError>;
}

#[derive(Default)]
pub struct MemoryEventStore {
    channels: HashMap<ChannelId, Vec<Event>>,
    cursors: HashMap<ChannelId, Option<EventId>>,
}

impl MemoryEventStore {
    pub fn new() -> Self {
        Self {
            channels: HashMap::new(),
            cursors: HashMap::new(),
        }
    }
}

pub struct MemoryAgentRegistry {
    policy: AgentPolicy,
    pending: HashMap<AgentId, AgentRegistration>,
    approved: HashMap<AgentId, (AgentRegistration, CapabilityGrant)>,
}

impl MemoryAgentRegistry {
    pub fn new(policy: AgentPolicy) -> Self {
        Self {
            policy,
            pending: HashMap::new(),
            approved: HashMap::new(),
        }
    }
}

impl AgentRegistryStore for MemoryAgentRegistry {
    fn policy(&self) -> &AgentPolicy {
        &self.policy
    }

    fn set_policy(&mut self, policy: AgentPolicy) -> Result<(), StoreError> {
        self.policy = policy;
        Ok(())
    }

    fn submit(&mut self, registration: AgentRegistration) -> Result<(), StoreError> {
        let agent_id = registration.agent_id.clone();
        self.pending.insert(agent_id, registration);
        Ok(())
    }

    fn approve(&mut self, agent_id: &AgentId, grant: CapabilityGrant) -> Result<bool, StoreError> {
        let Some(registration) = self.pending.remove(agent_id) else {
            return Ok(false);
        };
        self.approved
            .insert(agent_id.clone(), (registration, grant));
        Ok(true)
    }

    fn reject(&mut self, agent_id: &AgentId) -> Result<bool, StoreError> {
        Ok(self.pending.remove(agent_id).is_some())
    }

    fn pending(&self) -> Result<Vec<AgentRegistration>, StoreError> {
        Ok(self.pending.values().cloned().collect())
    }

    fn approved(&self) -> Result<Vec<(AgentRegistration, CapabilityGrant)>, StoreError> {
        Ok(self.approved.values().cloned().collect())
    }
}

impl EventStore for MemoryEventStore {
    fn append(&mut self, event: Event) -> Result<(), StoreError> {
        let channel = event.channel.clone();
        let event_id = event.id.clone();

        let entry = self.channels.entry(channel.clone()).or_default();
        entry.push(event);
        entry.sort_by(|left, right| {
            left.created_at
                .cmp(&right.created_at)
                .then_with(|| left.id.0.cmp(&right.id.0))
        });

        self.cursors.insert(channel, Some(event_id));
        Ok(())
    }

    fn channel_events(&self, channel: &ChannelId) -> Result<Vec<Event>, StoreError> {
        Ok(self.channels.get(channel).cloned().unwrap_or_default())
    }

    fn events_since(
        &self,
        channel: &ChannelId,
        after: Option<&EventId>,
    ) -> Result<Vec<Event>, StoreError> {
        let events = match self.channels.get(channel) {
            Some(events) => events,
            None => return Ok(Vec::new()),
        };

        if let Some(after) = after {
            if let Some(index) = events.iter().position(|event| &event.id == after) {
                return Ok(events[(index + 1)..].to_vec());
            }
        }

        Ok(events.to_vec())
    }

    fn head(&self, channel: &ChannelId) -> Result<Option<EventId>, StoreError> {
        Ok(self
            .channels
            .get(channel)
            .and_then(|events| events.last())
            .map(|event| event.id.clone()))
    }
}

impl SyncCursorStore for MemoryEventStore {
    fn upsert_cursor(
        &mut self,
        channel: &ChannelId,
        event_id: Option<&EventId>,
        _updated_at: i64,
    ) -> Result<(), StoreError> {
        self.cursors.insert(channel.clone(), event_id.cloned());
        Ok(())
    }

    fn cursor(&self, channel: &ChannelId) -> Result<Option<EventId>, StoreError> {
        Ok(self.cursors.get(channel).cloned().unwrap_or(None))
    }
}

pub struct SqliteEventStore {
    conn: Connection,
    policy: AgentPolicy,
}

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct UnreadIndex {
    pub channels: HashMap<ChannelId, u32>,
    pub mentions: HashMap<ChannelId, u32>,
}

fn merge_max_counts(
    left: &HashMap<ChannelId, u32>,
    right: &HashMap<ChannelId, u32>,
) -> HashMap<ChannelId, u32> {
    let mut merged = left.clone();
    for (channel, count) in right {
        let current = merged.get(channel).copied().unwrap_or(0);
        merged.insert(channel.clone(), current.max(*count));
    }
    merged
}

pub fn reconcile_unread_for_sync(
    local: &UnreadIndex,
    remote: &UnreadIndex,
    active_channel: Option<&ChannelId>,
) -> UnreadIndex {
    let mut channels = merge_max_counts(&local.channels, &remote.channels);
    let mut mentions = merge_max_counts(&local.mentions, &remote.mentions);

    if let Some(active) = active_channel {
        channels.insert(active.clone(), 0);
        mentions.insert(active.clone(), 0);
    }

    UnreadIndex { channels, mentions }
}

fn encode_hex(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len() * 2);
    for value in bytes {
        out.push_str(&format!("{value:02x}"));
    }
    out
}

fn channel_key(channel: &ChannelId) -> String {
    encode_hex(&channel.0)
}

fn event_key(event_id: &EventId) -> String {
    encode_hex(&event_id.0)
}

fn agent_key(agent_id: &AgentId) -> String {
    encode_hex(&agent_id.0)
}

fn decode_hex_n<const N: usize>(raw: &str) -> Option<[u8; N]> {
    if raw.len() != N * 2 {
        return None;
    }

    let mut out = [0u8; N];
    for (index, slot) in out.iter_mut().enumerate() {
        let offset = index * 2;
        let byte = u8::from_str_radix(&raw[offset..offset + 2], 16).ok()?;
        *slot = byte;
    }
    Some(out)
}

fn event_id_from_hex(raw: &str) -> Option<EventId> {
    decode_hex_n::<32>(raw).map(EventId)
}

impl SqliteEventStore {
    pub fn open(path: &str, policy: AgentPolicy) -> Result<Self, StoreError> {
        let conn = Connection::open(path)?;
        let mut store = Self { conn, policy };
        store.init_schema()?;
        store.load_policy()?;
        Ok(store)
    }

    pub fn open_in_memory(policy: AgentPolicy) -> Result<Self, StoreError> {
        let conn = Connection::open_in_memory()?;
        let mut store = Self { conn, policy };
        store.init_schema()?;
        store.load_policy()?;
        Ok(store)
    }

    fn init_schema(&mut self) -> Result<(), StoreError> {
        self.conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS events (
              event_id TEXT PRIMARY KEY,
              channel_id TEXT NOT NULL,
              created_at INTEGER NOT NULL,
              event_json TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_events_channel_created
              ON events(channel_id, created_at);

            CREATE TABLE IF NOT EXISTS sync_cursors (
              channel_id TEXT PRIMARY KEY,
              event_id TEXT,
              updated_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS agents (
              agent_id TEXT PRIMARY KEY,
              status TEXT NOT NULL,
              registration_json TEXT NOT NULL,
              grant_json TEXT
            );

            CREATE TABLE IF NOT EXISTS agent_policy (
              id INTEGER PRIMARY KEY CHECK (id = 1),
              policy_json TEXT NOT NULL
            );
            ",
        )?;
        Ok(())
    }

    fn load_policy(&mut self) -> Result<(), StoreError> {
        let mut stmt = self
            .conn
            .prepare("SELECT policy_json FROM agent_policy WHERE id = 1")?;

        let existing: Option<String> = stmt.query_row([], |row| row.get(0)).ok();

        if let Some(raw) = existing {
            self.policy = serde_json::from_str(&raw)?;
            return Ok(());
        }

        let raw = serde_json::to_string(&self.policy)?;
        self.conn.execute(
            "INSERT OR REPLACE INTO agent_policy (id, policy_json) VALUES (1, ?1)",
            [raw],
        )?;
        Ok(())
    }

    fn decode_event_json(raw: String) -> Result<Event, StoreError> {
        Ok(serde_json::from_str(&raw)?)
    }
}

impl EventStore for SqliteEventStore {
    fn append(&mut self, event: Event) -> Result<(), StoreError> {
        let event_id = event_key(&event.id);
        let channel_id = channel_key(&event.channel);
        let raw = serde_json::to_string(&event)?;

        self.conn.execute(
            "INSERT OR REPLACE INTO events (event_id, channel_id, created_at, event_json)
             VALUES (?1, ?2, ?3, ?4)",
            params![event_id, channel_id, event.created_at, raw],
        )?;

        self.upsert_cursor(&event.channel, Some(&event.id), event.created_at)?;
        Ok(())
    }

    fn channel_events(&self, channel: &ChannelId) -> Result<Vec<Event>, StoreError> {
        let channel_id = channel_key(channel);
        let mut stmt = self.conn.prepare(
            "SELECT event_json
             FROM events
             WHERE channel_id = ?1
             ORDER BY created_at ASC, event_id ASC",
        )?;

        let rows = stmt.query_map([channel_id], |row| row.get::<_, String>(0))?;
        let mut events = Vec::new();
        for row in rows {
            events.push(Self::decode_event_json(row?)?);
        }
        Ok(events)
    }

    fn events_since(
        &self,
        channel: &ChannelId,
        after: Option<&EventId>,
    ) -> Result<Vec<Event>, StoreError> {
        if let Some(after) = after {
            let events = self.channel_events(channel)?;
            if let Some(index) = events.iter().position(|event| event.id == *after) {
                return Ok(events[(index + 1)..].to_vec());
            }
            return Ok(events);
        }

        self.channel_events(channel)
    }

    fn head(&self, channel: &ChannelId) -> Result<Option<EventId>, StoreError> {
        let channel_id = channel_key(channel);
        let mut stmt = self.conn.prepare(
            "SELECT event_json
             FROM events
             WHERE channel_id = ?1
             ORDER BY created_at DESC, event_id DESC
             LIMIT 1",
        )?;

        let raw: Option<String> = stmt.query_row([channel_id], |row| row.get(0)).ok();
        match raw {
            Some(raw) => Ok(Some(Self::decode_event_json(raw)?.id)),
            None => Ok(None),
        }
    }
}

impl SyncCursorStore for SqliteEventStore {
    fn upsert_cursor(
        &mut self,
        channel: &ChannelId,
        event_id: Option<&EventId>,
        updated_at: i64,
    ) -> Result<(), StoreError> {
        let channel_id = channel_key(channel);
        let event_id = event_id.map(event_key);
        self.conn.execute(
            "INSERT INTO sync_cursors (channel_id, event_id, updated_at)
             VALUES (?1, ?2, ?3)
             ON CONFLICT(channel_id)
             DO UPDATE SET event_id = excluded.event_id, updated_at = excluded.updated_at",
            params![channel_id, event_id, updated_at],
        )?;
        Ok(())
    }

    fn cursor(&self, channel: &ChannelId) -> Result<Option<EventId>, StoreError> {
        let channel_id = channel_key(channel);
        let mut stmt = self
            .conn
            .prepare("SELECT event_id FROM sync_cursors WHERE channel_id = ?1 LIMIT 1")?;

        let raw: Option<String> = stmt
            .query_row([channel_id], |row| row.get::<_, Option<String>>(0))
            .ok()
            .flatten();
        Ok(raw.and_then(|value| event_id_from_hex(&value)))
    }
}

impl AgentRegistryStore for SqliteEventStore {
    fn policy(&self) -> &AgentPolicy {
        &self.policy
    }

    fn set_policy(&mut self, policy: AgentPolicy) -> Result<(), StoreError> {
        self.policy = policy;
        let raw = serde_json::to_string(&self.policy)?;
        self.conn.execute(
            "INSERT OR REPLACE INTO agent_policy (id, policy_json) VALUES (1, ?1)",
            [raw],
        )?;
        Ok(())
    }

    fn submit(&mut self, registration: AgentRegistration) -> Result<(), StoreError> {
        let agent_id = agent_key(&registration.agent_id);
        let raw = serde_json::to_string(&registration)?;
        self.conn.execute(
            "INSERT OR REPLACE INTO agents (agent_id, status, registration_json, grant_json)
             VALUES (?1, 'pending', ?2, NULL)",
            params![agent_id, raw],
        )?;
        Ok(())
    }

    fn approve(&mut self, agent_id: &AgentId, grant: CapabilityGrant) -> Result<bool, StoreError> {
        let raw_grant = serde_json::to_string(&grant)?;
        let changed = self.conn.execute(
            "UPDATE agents SET status = 'approved', grant_json = ?1 WHERE agent_id = ?2",
            params![raw_grant, agent_key(agent_id)],
        )?;
        Ok(changed > 0)
    }

    fn reject(&mut self, agent_id: &AgentId) -> Result<bool, StoreError> {
        let changed = self.conn.execute(
            "UPDATE agents SET status = 'rejected' WHERE agent_id = ?1",
            params![agent_key(agent_id)],
        )?;
        Ok(changed > 0)
    }

    fn pending(&self) -> Result<Vec<AgentRegistration>, StoreError> {
        let mut stmt = self
            .conn
            .prepare("SELECT registration_json FROM agents WHERE status = 'pending'")?;
        let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
        let mut out = Vec::new();
        for row in rows {
            out.push(serde_json::from_str(&row?)?);
        }
        Ok(out)
    }

    fn approved(&self) -> Result<Vec<(AgentRegistration, CapabilityGrant)>, StoreError> {
        let mut stmt = self.conn.prepare(
            "SELECT registration_json, grant_json FROM agents WHERE status = 'approved' AND grant_json IS NOT NULL",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;

        let mut out = Vec::new();
        for row in rows {
            let (reg_raw, grant_raw) = row?;
            out.push((
                serde_json::from_str(&reg_raw)?,
                serde_json::from_str(&grant_raw)?,
            ));
        }
        Ok(out)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_policy() -> AgentPolicy {
        AgentPolicy {
            approval_mode: AgentApprovalMode::Manual,
            visibility: AgentVisibility::Public,
        }
    }

    fn event(seed: u8, channel_seed: u8, created_at: i64) -> Event {
        Event {
            id: EventId([seed; 32]),
            server: ServerId([7; 32]),
            channel: ChannelId([channel_seed; 32]),
            author: UserId([9; 32]),
            device: DeviceId([3; 16]),
            created_at,
            kind: EventKind::Message,
            payload: None,
            prev: None,
        }
    }

    fn unread_index(
        channels: Vec<(ChannelId, u32)>,
        mentions: Vec<(ChannelId, u32)>,
    ) -> UnreadIndex {
        UnreadIndex {
            channels: channels.into_iter().collect(),
            mentions: mentions.into_iter().collect(),
        }
    }

    #[test]
    fn memory_events_since_unknown_cursor_returns_full_history() {
        let channel = ChannelId([2; 32]);
        let mut store = MemoryEventStore::new();
        let first = event(1, 2, 100);
        let second = event(2, 2, 101);
        store.append(first.clone()).expect("append first");
        store.append(second.clone()).expect("append second");

        let unknown = EventId([99; 32]);
        let events = store
            .events_since(&channel, Some(&unknown))
            .expect("events since unknown");
        assert_eq!(events.len(), 2);
        assert_eq!(events[0].id, first.id);
        assert_eq!(events[1].id, second.id);
    }

    #[test]
    fn sqlite_cursor_reads_sync_cursor_table() {
        let channel = ChannelId([4; 32]);
        let mut store = SqliteEventStore::open_in_memory(test_policy()).expect("open sqlite");
        let stored = EventId([17; 32]);

        store
            .upsert_cursor(&channel, Some(&stored), 222)
            .expect("upsert cursor");
        let found = store.cursor(&channel).expect("read cursor");

        assert_eq!(found, Some(stored));
    }

    #[test]
    fn sqlite_channel_order_is_deterministic_for_equal_timestamps() {
        let channel = ChannelId([5; 32]);
        let mut store = SqliteEventStore::open_in_memory(test_policy()).expect("open sqlite");

        let high_id = event(9, 5, 500);
        let low_id = event(1, 5, 500);
        store.append(high_id.clone()).expect("append high id");
        store.append(low_id.clone()).expect("append low id");

        let ordered = store.channel_events(&channel).expect("channel events");
        assert_eq!(ordered.len(), 2);
        assert_eq!(ordered[0].id, low_id.id);
        assert_eq!(ordered[1].id, high_id.id);
    }

    #[test]
    fn unread_reconciliation_is_commutative_for_offline_reconnect() {
        let channel_a = ChannelId([41; 32]);
        let channel_b = ChannelId([42; 32]);
        let local = unread_index(
            vec![(channel_a.clone(), 4), (channel_b.clone(), 1)],
            vec![(channel_a.clone(), 2)],
        );
        let remote = unread_index(
            vec![(channel_a.clone(), 3), (channel_b.clone(), 5)],
            vec![(channel_b.clone(), 1)],
        );

        let merged_lr = reconcile_unread_for_sync(&local, &remote, None);
        let merged_rl = reconcile_unread_for_sync(&remote, &local, None);

        assert_eq!(merged_lr, merged_rl);
        assert_eq!(merged_lr.channels.get(&channel_a), Some(&4));
        assert_eq!(merged_lr.channels.get(&channel_b), Some(&5));
        assert_eq!(merged_lr.mentions.get(&channel_a), Some(&2));
        assert_eq!(merged_lr.mentions.get(&channel_b), Some(&1));
    }

    #[test]
    fn unread_reconciliation_clears_active_channel_after_sync() {
        let active = ChannelId([88; 32]);
        let local = unread_index(vec![(active.clone(), 5)], vec![(active.clone(), 3)]);
        let remote = unread_index(vec![(active.clone(), 2)], vec![(active.clone(), 1)]);

        let reconciled = reconcile_unread_for_sync(&local, &remote, Some(&active));

        assert_eq!(reconciled.channels.get(&active), Some(&0));
        assert_eq!(reconciled.mentions.get(&active), Some(&0));
    }
}
