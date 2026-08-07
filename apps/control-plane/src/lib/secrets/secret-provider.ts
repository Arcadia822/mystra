import type { SecretEnvelopeWrite } from "../db/rdb-provider";

export interface SecretProvider {
  seal(reference: string, plaintext: string): SecretEnvelopeWrite;
  put(reference: string, plaintext: string): Promise<void>;
  get(reference: string): Promise<string>;
  delete(reference: string): Promise<void>;
}
