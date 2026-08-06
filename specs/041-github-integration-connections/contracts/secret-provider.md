# Contract: SecretProvider

Control-plane internal interface：

```ts
interface SecretProvider {
  put(reference: string, plaintext: string): Promise<void>;
  get(reference: string): Promise<string>;
  delete(reference: string): Promise<void>;
}
```

## Invariants

- validates reference grammar before filesystem access；no absolute path、`..`、separator injection。
- never returns secret from list/status methods。
- write uses authenticated encryption and atomic rename。
- missing/wrong key、tampered ciphertext and missing file map to stable non-secret errors。
- implementation errors never include plaintext、ciphertext or master key。
- tests inspect disk bytes and assert submitted PAT substring is absent。
