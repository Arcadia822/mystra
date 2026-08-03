import {
  sessionRuntimeOverrideSchema,
  resolvedRuntimeContractSchema,
  type ContextBundle,
  type Project,
  type ResolvedRuntimeContract,
} from "@mystra/shared";

export function resolveRuntimeContract(input: {
  project: Pick<Project, "runtime">;
  override?: unknown;
  contextBundles?: ContextBundle[];
}): ResolvedRuntimeContract {
  const projectRuntime = input.project.runtime;
  const override = input.override ? sessionRuntimeOverrideSchema.parse(input.override) : undefined;

  if (override?.runtimeProfile) {
    throw new Error(`RUNTIME_PROFILE_NOT_SUPPORTED: ${override.runtimeProfile}`);
  }

  if (override?.provider && override.provider !== projectRuntime.provider) {
    throw new Error(`RUNTIME_PROVIDER_OVERRIDE_NOT_ALLOWED: ${override.provider}`);
  }

  if (override?.image && !projectRuntime.overridePolicy.allowImageOverride) {
    throw new Error("RUNTIME_IMAGE_OVERRIDE_NOT_ALLOWED");
  }

  const overrideBundleRefs = override?.contextBundleRefs ?? [];
  if (overrideBundleRefs.length > 0 && !projectRuntime.overridePolicy.allowContextBundleAdditions) {
    throw new Error("RUNTIME_CONTEXT_BUNDLE_OVERRIDE_NOT_ALLOWED");
  }

  const allowedBundleSlugs = new Set(projectRuntime.overridePolicy.allowedContextBundleSlugs);
  for (const bundleRef of overrideBundleRefs) {
    if (allowedBundleSlugs.size > 0 && !allowedBundleSlugs.has(bundleRef.slug)) {
      throw new Error(`RUNTIME_CONTEXT_BUNDLE_NOT_ALLOWED: ${bundleRef.slug}`);
    }
  }

  const image = override?.image ?? projectRuntime.image;
  const contextBundleRefs = [...projectRuntime.contextBundleRefs, ...overrideBundleRefs];
  const bundlesBySlug = new Map((input.contextBundles ?? []).map((bundle) => [bundle.slug, bundle]));
  const resolvedContextBundles = [];
  const contextBundleMounts = [];

  for (const bundleRef of contextBundleRefs) {
    const bundle = bundlesBySlug.get(bundleRef.slug);
    if (!bundle) {
      if (bundleRef.required) {
        throw new Error(`RUNTIME_CONTEXT_BUNDLE_NOT_FOUND: ${bundleRef.slug}`);
      }
      continue;
    }
    if (bundle.archivedAt) {
      if (bundleRef.required) {
        throw new Error(`RUNTIME_CONTEXT_BUNDLE_ARCHIVED: ${bundleRef.slug}`);
      }
      continue;
    }

    const accessMode = bundleRef.accessMode ?? bundle.accessMode;
    const required = bundleRef.required;
    resolvedContextBundles.push({
      slug: bundle.slug,
      required,
      accessMode,
      ...(bundle.mountPath ? { mountPath: bundle.mountPath } : {}),
      source: bundle.source,
      failureMode: required ? "fail-session" : bundle.failureMode,
    });
    if (bundle.mountPath) {
      contextBundleMounts.push({
        kind: "contextBundle",
        owner: "project",
        target: bundle.mountPath,
        sourceRef: bundle.slug,
        readOnly: true,
      });
    }
  }

  return resolvedRuntimeContractSchema.parse({
    provider: projectRuntime.provider,
    environment: {
      image,
      metadata: projectRuntime.metadata,
    },
    contextBundles: resolvedContextBundles,
    mounts: [...projectRuntime.mounts, ...contextBundleMounts],
    exposedPorts: projectRuntime.exposedPorts,
    cache: projectRuntime.cache,
    secrets: projectRuntime.secretRefs,
  });
}
