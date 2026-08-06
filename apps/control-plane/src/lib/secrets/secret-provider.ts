export interface SecretProvider {
  put(reference: string, plaintext: string): Promise<void>;
  get(reference: string): Promise<string>;
  delete(reference: string): Promise<void>;
}
