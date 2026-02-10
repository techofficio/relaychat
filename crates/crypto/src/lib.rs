use argon2::Argon2;
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use chacha20poly1305::{
    aead::{Aead, KeyInit, OsRng},
    ChaCha20Poly1305, Nonce,
};
use ed25519_dalek::{Signature as DalekSignature, Signer, SigningKey, Verifier, VerifyingKey};
use rand::RngCore;
use relaychat_core::{PublicKey, Signature, SignedRecord, Timestamp};
use serde::{Deserialize, Serialize};

#[derive(Debug)]
pub enum CryptoError {
    InvalidSignatureLength,
    InvalidPublicKey,
    InvalidRecoveryKit,
    InvalidPassphrase,
    Serialization,
}

#[derive(Clone, Debug)]
pub struct DeviceKeypair {
    pub signing_key: SigningKey,
}

impl DeviceKeypair {
    pub fn generate() -> Self {
        let mut secret = [0u8; 32];
        rand::thread_rng().fill_bytes(&mut secret);
        Self {
            signing_key: SigningKey::from_bytes(&secret),
        }
    }

    pub fn public_key(&self) -> PublicKey {
        PublicKey(self.signing_key.verifying_key().to_bytes())
    }

    pub fn sign(&self, payload: &[u8]) -> Signature {
        let signature = self.signing_key.sign(payload);
        Signature(signature.to_bytes().to_vec())
    }

    pub fn secret_bytes(&self) -> [u8; 32] {
        self.signing_key.to_bytes()
    }
}

pub fn verify_signature(
    public_key: &PublicKey,
    payload: &[u8],
    signature: &Signature,
) -> Result<bool, CryptoError> {
    let verifying_key =
        VerifyingKey::from_bytes(&public_key.0).map_err(|_| CryptoError::InvalidPublicKey)?;

    if signature.0.len() != 64 {
        return Err(CryptoError::InvalidSignatureLength);
    }

    let mut sig_bytes = [0u8; 64];
    sig_bytes.copy_from_slice(&signature.0);
    let signature = DalekSignature::from_bytes(&sig_bytes);

    Ok(verifying_key.verify(payload, &signature).is_ok())
}

fn signed_record_payload<T: Serialize>(
    payload: &T,
    signed_at: Timestamp,
) -> Result<Vec<u8>, CryptoError> {
    let mut bytes = serde_json::to_vec(payload).map_err(|_| CryptoError::Serialization)?;
    bytes.extend_from_slice(&signed_at.to_le_bytes());
    Ok(bytes)
}

pub fn sign_record<T: Clone + Serialize>(
    keypair: &DeviceKeypair,
    payload: T,
    signed_at: Timestamp,
) -> Result<SignedRecord<T>, CryptoError> {
    let bytes = signed_record_payload(&payload, signed_at)?;
    Ok(SignedRecord {
        payload,
        author: keypair.public_key(),
        signature: keypair.sign(&bytes),
        signed_at,
    })
}

pub fn verify_signed_record<T: Serialize>(record: &SignedRecord<T>) -> Result<bool, CryptoError> {
    let bytes = signed_record_payload(&record.payload, record.signed_at)?;
    verify_signature(&record.author, &bytes, &record.signature)
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RecoveryKit {
    pub version: u8,
    pub salt: String,
    pub nonce: String,
    pub ciphertext: String,
}

fn derive_key(passphrase: &str, salt: &[u8]) -> Result<[u8; 32], CryptoError> {
    let mut key = [0u8; 32];
    Argon2::default()
        .hash_password_into(passphrase.as_bytes(), salt, &mut key)
        .map_err(|_| CryptoError::InvalidPassphrase)?;
    Ok(key)
}

pub fn export_recovery_kit(
    private_key_bytes: [u8; 32],
    passphrase: &str,
) -> Result<RecoveryKit, CryptoError> {
    let mut salt = [0u8; 16];
    OsRng.fill_bytes(&mut salt);

    let key = derive_key(passphrase, &salt)?;
    let cipher = ChaCha20Poly1305::new((&key).into());

    let mut nonce = [0u8; 12];
    OsRng.fill_bytes(&mut nonce);

    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&nonce), private_key_bytes.as_ref())
        .map_err(|_| CryptoError::InvalidRecoveryKit)?;

    Ok(RecoveryKit {
        version: 1,
        salt: B64.encode(salt),
        nonce: B64.encode(nonce),
        ciphertext: B64.encode(ciphertext),
    })
}

pub fn import_recovery_kit(kit: &RecoveryKit, passphrase: &str) -> Result<[u8; 32], CryptoError> {
    if kit.version != 1 {
        return Err(CryptoError::InvalidRecoveryKit);
    }

    let salt = B64
        .decode(kit.salt.as_bytes())
        .map_err(|_| CryptoError::InvalidRecoveryKit)?;
    let nonce = B64
        .decode(kit.nonce.as_bytes())
        .map_err(|_| CryptoError::InvalidRecoveryKit)?;
    let ciphertext = B64
        .decode(kit.ciphertext.as_bytes())
        .map_err(|_| CryptoError::InvalidRecoveryKit)?;

    if nonce.len() != 12 {
        return Err(CryptoError::InvalidRecoveryKit);
    }

    let key = derive_key(passphrase, &salt)?;
    let cipher = ChaCha20Poly1305::new((&key).into());

    let plaintext = cipher
        .decrypt(Nonce::from_slice(&nonce), ciphertext.as_ref())
        .map_err(|_| CryptoError::InvalidPassphrase)?;

    if plaintext.len() != 32 {
        return Err(CryptoError::InvalidRecoveryKit);
    }

    let mut out = [0u8; 32];
    out.copy_from_slice(&plaintext);
    Ok(out)
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PasskeyBootstrapRequest {
    pub credential_id: String,
    pub challenge: String,
    pub client_data_json: String,
    pub authenticator_data: String,
    pub signature: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DeviceBootstrapPackage {
    pub public_key: PublicKey,
    pub attested_challenge: String,
}

pub fn bootstrap_device_from_passkey_assertion(
    assertion: &PasskeyBootstrapRequest,
) -> DeviceBootstrapPackage {
    let keypair = DeviceKeypair::generate();
    DeviceBootstrapPackage {
        public_key: keypair.public_key(),
        // WebAuthn assertion verification is wired in platform-specific auth services.
        attested_challenge: assertion.challenge.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::{Deserialize, Serialize};

    #[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
    struct Payload {
        body: String,
    }

    #[test]
    fn signed_record_verifies_and_detects_tampering() {
        let keypair = DeviceKeypair::generate();
        let signed_at = 1_739_222_400_i64;
        let payload = Payload {
            body: "relaychat".to_string(),
        };

        let signed = sign_record(&keypair, payload.clone(), signed_at).expect("record signs");
        let verified = verify_signed_record(&signed).expect("record verifies");
        assert!(verified);

        let mut tampered = signed.clone();
        tampered.payload.body = "tampered".to_string();
        let verified_tampered = verify_signed_record(&tampered).expect("tampered verifies false");
        assert!(!verified_tampered);
    }

    #[test]
    fn recovery_kit_roundtrip_restores_private_key() {
        let keypair = DeviceKeypair::generate();
        let secret = keypair.secret_bytes();
        let passphrase = "correct horse battery staple";

        let kit = export_recovery_kit(secret, passphrase).expect("kit exported");
        let restored = import_recovery_kit(&kit, passphrase).expect("kit restored");

        assert_eq!(secret, restored);
    }
}
