# Contract: SecretProvider

## Boundary

`SecretProvider` is the only application boundary that accepts or returns PAT
plaintext. `RdbProvider` persists only an authenticated encryption envelope and
never receives plaintext. Public APIs, shared schemas, logs, events, UI state,
and evidence expose neither plaintext nor the envelope.

```ts
interface SecretEnvelopeWrite {
  reference: string;
  version: 1;
  algorithm: "aes-256-gcm+aes-256-gcm-wrap";
  keyId: string;
  ciphertext: string;
  ciphertextIv: string;
  ciphertextAuthTag: string;
  wrappedDataKey: string;
  wrappedDataKeyIv: string;
  wrappedDataKeyAuthTag: string;
}

interface SecretProvider {
  seal(reference: string, plaintext: string): SecretEnvelopeWrite;
  put(reference: string, plaintext: string): Promise<void>;
  get(reference: string): Promise<string>;
  delete(reference: string): Promise<void>;
}
```

`seal` exists so a caller may place the envelope write and the owning
`IntegrationConnection.credentialRef` switch in one `RdbProvider` transaction.
The returned object contains ciphertext and wrapping metadata only.

## Envelope rules

- Every credential version uses an immutable reference:
  `github-pat/<connection-id>/<credential-version-id>`.
- A fresh random 32-byte DEK encrypts each PAT with AES-256-GCM and a random
  96-bit IV.
- The deployment KEK from `MYSTRA_SECRET_STORE_KEY` wraps the DEK separately
  with AES-256-GCM and a distinct random 96-bit IV.
- Authenticated additional data binds both operations to the envelope version,
  reference, and `keyId`, preventing row or field substitution.
- `MYSTRA_SECRET_STORE_KEY` is a base64-encoded 32-byte KEK and never enters the
  database. `MYSTRA_SECRET_STORE_KEY_ID` is a non-secret rotation label.
- Missing, malformed, wrong-key, tampered, or unsupported envelopes fail closed
  with stable non-secret errors.

## Persistence and lifecycle

- SQLite, PostgreSQL, and Supabase-backed PostgreSQL persist the same
  `secret_envelopes` logical model through Prisma and `RdbProvider`.
- Create/replace writes the new envelope and switches `credential_ref` in one
  serializable transaction. Replace removes the previous envelope only after
  the new reference is selected by that same transaction.
- Delete removes the connection and its referenced envelope in one transaction
  after Project-reference checks pass.
- No file-backed provider, path configuration, dual read, or file-to-RDB
  compatibility path exists in the pre-0.1 contract.

## Deployment

Self-hosted replicas share the same RDB and KEK through deployment secret
management, so the SecretProvider does not impose node-local affinity. Hosted
deployments may replace KEK wrapping with KMS/HSM while preserving the envelope
and opaque-reference contract.
