import type { RdbProvider } from "../db/rdb-provider";
import type { SkillContentStore } from "./skill-content-store";
import { SkillPreviewService } from "./skill-preview-service";
import { SkillPublicationService } from "./skill-publication-service";
import { SkillQueryService } from "./skill-query-service";
import { createS3SkillContentStore } from "./s3-skill-content-store";
import { parseSkillStorageConfiguration } from "./skill-storage-config";

let contentStorePromise: Promise<SkillContentStore> | undefined;

export function initializeSkillContentStore(): Promise<SkillContentStore> {
  if (!contentStorePromise) {
    contentStorePromise = parseSkillStorageConfiguration()
      .then(createS3SkillContentStore)
      .catch((error: unknown) => {
        contentStorePromise = undefined;
        throw error;
      });
  }
  return contentStorePromise;
}

export async function createSkillServices(
  db: RdbProvider,
  injectedStore?: SkillContentStore,
) {
  const store = injectedStore ?? await initializeSkillContentStore();
  return {
    publication: new SkillPublicationService({ db, store }),
    query: new SkillQueryService(db),
    preview: new SkillPreviewService({ db, store }),
  };
}

export function resetSkillContentStoreForTests(): void {
  contentStorePromise = undefined;
}
