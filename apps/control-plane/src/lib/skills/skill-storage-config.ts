import { defaultProvider } from "@aws-sdk/credential-provider-node";

type Environment = Record<string, string | undefined>;

export interface SkillStorageCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

export type SkillStorageCredentialProvider = () => Promise<SkillStorageCredentials>;

export interface SkillStorageConfiguration {
  endpoint: string;
  region: string;
  bucket: string;
  forcePathStyle: boolean;
  credentialSource: "explicit" | "default-provider-chain";
  credentials: SkillStorageCredentials | SkillStorageCredentialProvider;
}

export class SkillStorageConfigurationError extends Error {
  constructor(variableName: string, reason: string) {
    super(`INVALID_SKILL_STORAGE_CONFIGURATION: ${variableName} ${reason}`);
    this.name = "SkillStorageConfigurationError";
  }
}

interface ParseSkillStorageConfigurationOptions {
  defaultCredentialProvider?: () => SkillStorageCredentialProvider;
  testMode?: boolean;
}

function required(environment: Environment, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new SkillStorageConfigurationError(name, "is required");
  return value;
}

function parseBoolean(environment: Environment, name: string, defaultValue: boolean): boolean {
  const value = environment[name];
  if (value === undefined) return defaultValue;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new SkillStorageConfigurationError(name, "must be true or false");
}

export async function parseSkillStorageConfiguration(
  environment: Environment = process.env,
  options: ParseSkillStorageConfigurationOptions = {},
): Promise<SkillStorageConfiguration> {
  const endpoint = required(environment, "MYSTRA_SKILL_STORAGE_ENDPOINT");
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" && !(options.testMode === true && url.protocol === "http:")) {
      throw new Error("unsupported protocol");
    }
  } catch {
    throw new SkillStorageConfigurationError(
      "MYSTRA_SKILL_STORAGE_ENDPOINT",
      options.testMode === true ? "must use a valid https: or test-only http: URL" : "must use a valid https: URL",
    );
  }

  const region = required(environment, "MYSTRA_SKILL_STORAGE_REGION");
  const bucket = required(environment, "MYSTRA_SKILL_STORAGE_BUCKET");
  const forcePathStyle = parseBoolean(environment, "MYSTRA_SKILL_STORAGE_FORCE_PATH_STYLE", false);
  const accessKeyId = environment.MYSTRA_SKILL_STORAGE_ACCESS_KEY_ID?.trim();
  const secretAccessKey = environment.MYSTRA_SKILL_STORAGE_SECRET_ACCESS_KEY?.trim();

  if ((accessKeyId !== undefined) !== (secretAccessKey !== undefined)) {
    throw new SkillStorageConfigurationError(
      accessKeyId === undefined
        ? "MYSTRA_SKILL_STORAGE_ACCESS_KEY_ID"
        : "MYSTRA_SKILL_STORAGE_SECRET_ACCESS_KEY",
      "is required when the other explicit credential value is set",
    );
  }

  if (accessKeyId !== undefined && secretAccessKey !== undefined) {
    if (!accessKeyId || !secretAccessKey) {
      throw new SkillStorageConfigurationError("MYSTRA_SKILL_STORAGE_ACCESS_KEY_ID", "explicit credentials must be non-empty");
    }
    return {
      endpoint,
      region,
      bucket,
      forcePathStyle,
      credentialSource: "explicit",
      credentials: { accessKeyId, secretAccessKey },
    };
  }

  const providerFactory = options.defaultCredentialProvider
    ?? (() => defaultProvider() as SkillStorageCredentialProvider);
  const credentials = providerFactory();
  try {
    await credentials();
  } catch {
    throw new SkillStorageConfigurationError(
      "MYSTRA_SKILL_STORAGE_ACCESS_KEY_ID",
      "explicit credentials are absent and the default provider chain could not resolve credentials",
    );
  }
  return {
    endpoint,
    region,
    bucket,
    forcePathStyle,
    credentialSource: "default-provider-chain",
    credentials,
  };
}
