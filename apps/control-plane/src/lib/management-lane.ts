import {
  laneInspectionViewSchema,
  submittedLaneSnapshotSchema,
  type ContextBundleRef,
  type Project,
  type ResolvedRuntimeContract,
} from "@mystra/shared";

export function buildLaneInspectionView(project: Pick<Project, "repository" | "baseBranch" | "defaultAgent" | "runtime" | "prewarmConfig" | "metadata">) {
  return laneInspectionViewSchema.parse({
    repository: project.repository,
    baseBranch: project.baseBranch,
    defaultAgent: project.defaultAgent,
    runtime: project.runtime,
    contextBundleRefs: project.runtime.contextBundleRefs,
    prewarmConfig: project.prewarmConfig,
    metadata: project.metadata,
  });
}

export function buildSubmittedLaneSnapshot(input: {
  project: Pick<Project, "id" | "slug" | "repository" | "baseBranch" | "defaultAgent" | "prewarmConfig" | "metadata">;
  resolvedRuntime: ResolvedRuntimeContract;
  contextBundleRefs: ContextBundleRef[];
  submittedAt: string;
}) {
  return submittedLaneSnapshotSchema.parse({
    projectId: input.project.id,
    projectSlug: input.project.slug,
    repository: input.project.repository,
    baseBranch: input.project.baseBranch,
    defaultAgent: input.project.defaultAgent,
    runtime: input.resolvedRuntime,
    contextBundleRefs: input.contextBundleRefs,
    prewarmConfig: input.project.prewarmConfig,
    metadata: input.project.metadata,
    submittedAt: input.submittedAt,
  });
}
