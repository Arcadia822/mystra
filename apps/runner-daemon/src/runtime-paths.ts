import path from "node:path";

const safePathSegmentPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function safeRelativePathSegments(ref: string, label: string): string[] {
  const segments = ref.split(/[\\/]/);
  if (segments.some((segment) => !safePathSegmentPattern.test(segment))) {
    throw new Error(`Runtime ${label} must use safe relative path segments: ${ref}`);
  }
  return segments;
}

export function contextBundlePath(cacheRoot: string, ref: string): string {
  if (!safePathSegmentPattern.test(ref)) {
    throw new Error(`Runtime context bundle ref must use a single safe path segment: ${ref}`);
  }

  return path.join(path.resolve(cacheRoot), "context-bundles", ref);
}

export function contextBundleSourcePath(sourceRoot: string, ref: string): string {
  if (ref.includes("://")) {
    throw new Error(`Unsupported context bundle source ref: ${ref}`);
  }

  if (path.isAbsolute(ref)) {
    return path.resolve(ref);
  }

  return path.join(path.resolve(sourceRoot), ...safeRelativePathSegments(ref, "context bundle source ref"));
}
