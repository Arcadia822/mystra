import type { RdbProvider } from "../db/rdb-provider";
import { RuntimeSessionService } from "./runtime-session-service";

export function createRuntimeSessionService(db: RdbProvider): RuntimeSessionService {
  return new RuntimeSessionService({ db });
}
