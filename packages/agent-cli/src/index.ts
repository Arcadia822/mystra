import path from "node:path";
import { fileURLToPath } from "node:url";

export const agentCliBinDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../bin",
);

export * from "./client.js";
