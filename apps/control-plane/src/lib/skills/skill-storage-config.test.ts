import { describe, expect, it, vi } from "vitest";

import { SkillStorageConfigurationError, parseSkillStorageConfiguration } from "./skill-storage-config";

const location = {
  MYSTRA_SKILL_STORAGE_ENDPOINT: "https://objects.example.test",
  MYSTRA_SKILL_STORAGE_REGION: "auto",
  MYSTRA_SKILL_STORAGE_BUCKET: "mystra-skills",
};

describe("Skill storage configuration", () => {
  it("accepts a both-or-neither explicit credential pair", async () => {
    const defaultProvider = vi.fn();
    const config = await parseSkillStorageConfiguration({
      ...location,
      MYSTRA_SKILL_STORAGE_ACCESS_KEY_ID: "access-id",
      MYSTRA_SKILL_STORAGE_SECRET_ACCESS_KEY: "secret-value",
      MYSTRA_SKILL_STORAGE_FORCE_PATH_STYLE: "true",
    }, { defaultCredentialProvider: defaultProvider });

    expect(config).toMatchObject({
      endpoint: location.MYSTRA_SKILL_STORAGE_ENDPOINT,
      region: "auto",
      bucket: "mystra-skills",
      forcePathStyle: true,
      credentialSource: "explicit",
    });
    expect(defaultProvider).not.toHaveBeenCalled();
  });

  it("eagerly resolves the default provider chain while retaining the refreshable provider", async () => {
    const credentialProvider = vi.fn().mockResolvedValue({
      accessKeyId: "workload-id",
      secretAccessKey: "workload-secret",
    });
    const defaultCredentialProvider = vi.fn(() => credentialProvider);

    const config = await parseSkillStorageConfiguration(location, { defaultCredentialProvider });

    expect(defaultCredentialProvider).toHaveBeenCalledOnce();
    expect(credentialProvider).toHaveBeenCalledOnce();
    expect(config.credentialSource).toBe("default-provider-chain");
    expect(config.credentials).toBe(credentialProvider);
  });

  it.each([
    [{}, "MYSTRA_SKILL_STORAGE_ENDPOINT"],
    [{ ...location, MYSTRA_SKILL_STORAGE_ACCESS_KEY_ID: "access-only" }, "MYSTRA_SKILL_STORAGE_SECRET_ACCESS_KEY"],
    [{ ...location, MYSTRA_SKILL_STORAGE_SECRET_ACCESS_KEY: "secret-only" }, "MYSTRA_SKILL_STORAGE_ACCESS_KEY_ID"],
    [{ ...location, MYSTRA_SKILL_STORAGE_FORCE_PATH_STYLE: "yes" }, "MYSTRA_SKILL_STORAGE_FORCE_PATH_STYLE"],
    [{ ...location, MYSTRA_SKILL_STORAGE_ENDPOINT: "http://objects.example.test" }, "MYSTRA_SKILL_STORAGE_ENDPOINT"],
  ])("fails closed for invalid location or credential configuration", async (environment, variable) => {
    await expect(parseSkillStorageConfiguration(environment, {
      defaultCredentialProvider: () => vi.fn().mockRejectedValue(new Error("secret credential failure")),
    })).rejects.toThrow(variable);
  });

  it("redacts credential values and provider failures", async () => {
    const environment = {
      ...location,
      MYSTRA_SKILL_STORAGE_ACCESS_KEY_ID: "visible-access-value",
    };
    try {
      await parseSkillStorageConfiguration(environment);
      throw new Error("Expected configuration parsing to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(SkillStorageConfigurationError);
      expect(String(error)).not.toContain("visible-access-value");
    }

    await expect(parseSkillStorageConfiguration(location, {
      defaultCredentialProvider: () => vi.fn().mockRejectedValue(new Error("provider-secret")),
    })).rejects.not.toThrow("provider-secret");
  });
});
