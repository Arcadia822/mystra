#!/usr/bin/env node
import {
  defaults,
  exitCodeForSummary,
  fetchJobSummary,
  parseArgs,
  parsePositiveNumber,
  waitForJobSummary,
} from "./lib/job-summary.mjs";

function usage() {
  console.error(`Usage:
scripts/job-status.mjs --job-id <job-id> [--wait] [--poll-seconds <n>] [--control-plane-url <url>]`);
  process.exit(2);
}

let args;
try {
  args = parseArgs(process.argv.slice(2).filter((arg) => arg !== "--"), {
    booleanFlags: ["wait"],
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  usage();
}

if (!args["job-id"]) {
  usage();
}

let pollSeconds;
try {
  pollSeconds = parsePositiveNumber(args["poll-seconds"], "poll-seconds", defaults.pollSeconds);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  usage();
}

const controlPlaneUrl = args["control-plane-url"] ?? defaults.controlPlaneUrl;
const result = args.wait
  ? await waitForJobSummary({
      controlPlaneUrl,
      jobId: args["job-id"],
      pollSeconds,
      onUpdate(summary) {
        console.error(`${new Date().toISOString()} ${summary.runState} ${summary.phase}`);
      },
    })
  : await fetchJobSummary(controlPlaneUrl, args["job-id"]);

if (result.kind === "not_found") {
  console.log(JSON.stringify(result.payload, null, 2));
  process.exit(3);
}

if (result.kind === "timeout") {
  console.error(`Timed out waiting for ${args["job-id"]}`);
  process.exit(124);
}

console.log(JSON.stringify(result.payload, null, 2));
process.exit(args.wait ? exitCodeForSummary(result.payload.summary) : 0);
