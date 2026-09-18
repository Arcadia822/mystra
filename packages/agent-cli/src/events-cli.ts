import {
  EventsClient,
  EventsClientFailure,
  type EventsClientDiagnostic,
  type SubscriptionRequest,
} from "./events-client.js";
import {
  defaultOperatorSessionPath,
  OperatorSessionError,
  readOperatorSession,
  resolveSubscriptionOrigin,
} from "./operator-session.js";

export class EventsCliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EventsCliUsageError";
  }
}

export const EVENTS_EXIT_OK = 0;
export const EVENTS_EXIT_USAGE = 2;
export const EVENTS_EXIT_TRANSPORT = 3;
export const EVENTS_EXIT_AUTH = 4;

interface Io {
  write(value: string): void;
}

interface EventsCommandInput {
  readonly argv: readonly string[];
  readonly env: Record<string, string | undefined>;
  readonly fetchImpl?: typeof fetch;
  readonly stdout: Io;
  readonly stderr: Io;
  readonly stdin?: NodeJS.ReadableStream;
  readonly installSignalHandlers?: boolean;
  readonly clientFactory?: (options: ConstructorParameters<typeof EventsClient>[0]) => EventsClient;
}

const LIST_FLAGS = new Set(["--team", "--session-file", "--server"]);
const SUBSCRIBE_FLAGS = new Set([
  "--team",
  "--project",
  "--integration",
  "--event-type",
  "--subscription-id",
  "--session-file",
  "--server",
  "--filter",
]);

function parseFlags(argv: readonly string[], options: { allowed: Set<string>; repeatableFilters?: boolean }): {
  values: Map<string, string>;
  filters: Record<string, string>;
  control: boolean;
} {
  const values = new Map<string, string>();
  const filters: Record<string, string> = {};
  let control = false;

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]!;
    if (flag === "--control-stdin" && options.repeatableFilters) {
      if (control) throw new EventsCliUsageError("Duplicate flag --control-stdin");
      control = true;
      continue;
    }
    if (!options.allowed.has(flag)) {
      throw new EventsCliUsageError(`Unknown flag ${flag}`);
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new EventsCliUsageError(`Flag ${flag} requires a value`);
    }
    if (options.repeatableFilters && flag === "--filter") {
      const separator = value.indexOf("=");
      if (separator <= 0) {
        throw new EventsCliUsageError("--filter must be key=value");
      }
      const key = value.slice(0, separator);
      if (key in filters) throw new EventsCliUsageError(`Duplicate filter ${key}`);
      filters[key] = value.slice(separator + 1);
      index += 1;
      continue;
    }
    if (values.has(flag)) throw new EventsCliUsageError(`Duplicate flag ${flag}`);
    values.set(flag, value);
    index += 1;
  }

  return { values, filters, control };
}

export async function runEventsCommand(input: EventsCommandInput): Promise<number> {
  const [subcommand, ...rest] = input.argv;
  const sessionFilePath = defaultOperatorSessionPath(input.env);

  try {
    if (subcommand === "list") {
      const { values } = parseFlags(rest, { allowed: LIST_FLAGS });
      const sessionFile = values.get("--session-file") ?? sessionFilePath;
      const teamId = requireUuid(values.get("--team"), "--team");
      const session = readOperatorSession(sessionFile);
      const origin = resolveSubscriptionOrigin({
        sessionOrigin: session.controlPlaneUrl,
        serverOverride: values.get("--server"),
      });
      const client = makeClient(input, {
        origin,
        sessionToken: session.sessionToken,
        teamId,
      });
      const catalog = await client.fetchCatalog();
      input.stdout.write(`${JSON.stringify(catalog)}\n`);
      return EVENTS_EXIT_OK;
    }

    if (subcommand === "subscribe") {
      const { values, filters, control } = parseFlags(rest, { allowed: SUBSCRIBE_FLAGS, repeatableFilters: true });
      const sessionFile = values.get("--session-file") ?? sessionFilePath;
      const teamId = requireUuid(values.get("--team"), "--team");
      const projectId = requireUuid(values.get("--project"), "--project");
      const integration = values.get("--integration");
      const eventType = values.get("--event-type");
      if (!integration) throw new EventsCliUsageError("--integration is required");
      if (!eventType) throw new EventsCliUsageError("--event-type is required");
      const subscriptionId = values.get("--subscription-id") ?? "default";

      const session = readOperatorSession(sessionFile);
      const origin = resolveSubscriptionOrigin({
        sessionOrigin: session.controlPlaneUrl,
        serverOverride: values.get("--server"),
      });

      const request: SubscriptionRequest = {
        subscriptionId,
        projectId,
        integration,
        eventType,
        ...(Object.keys(filters).length > 0 ? { filters } : {}),
      };

      const stopped = deferredExit();
      let clientRef: EventsClient | undefined;
      const diagnostics = (diagnostic: EventsClientDiagnostic): void => {
        input.stderr.write(`${JSON.stringify(diagnostic)}\n`);
        if (diagnostic.kind === "permanent") {
          clientRef?.stop();
          stopped.resolve(permanentExitCode(diagnostic.message));
        }
      };

      const client = makeClient(input, {
        origin,
        sessionToken: session.sessionToken,
        teamId,
        onDiagnostic: diagnostics,
        onFrame: (frame) => input.stdout.write(`${JSON.stringify(frame)}\n`),
        onHello: () => {
          input.stderr.write(`${JSON.stringify({
            kind: "status",
            message: "online-only: events are delivered only while this connection is alive; no replay",
          })}\n`);
        },
      });
      clientRef = client;

      const finish = (code: number): void => {
        stopped.resolve(code);
        client.stop();
      };

      if (input.installSignalHandlers !== false) {
        process.once("SIGINT", () => finish(130));
        process.once("SIGTERM", () => finish(143));
      }

      client.subscribeAll([request]);
      if (control && input.stdin) {
        client.attachStdin(input.stdin, () => finish(EVENTS_EXIT_OK));
      }

      await client.connect();
      return await stopped.promise;
    }

    if (subcommand === "help" || subcommand === undefined) {
      input.stdout.write(`${JSON.stringify({
        usage: [
          "mystra-agent events list --team <uuid> [--session-file <path>] [--server <origin>]",
          "mystra-agent events subscribe --team <uuid> --project <uuid> --integration <name> --event-type <type>"
            + " [--subscription-id <id>] [--filter key=value ...] [--control-stdin]",
        ],
      })}\n`);
      return EVENTS_EXIT_OK;
    }

    throw new EventsCliUsageError(`Unknown events subcommand ${subcommand}`);
  } catch (error) {
    if (error instanceof EventsCliUsageError || error instanceof OperatorSessionError) {
      input.stderr.write(`${JSON.stringify({
        error: { code: error instanceof OperatorSessionError ? `session_${error.code}` : "invalid_request", message: error.message },
      })}\n`);
      return EVENTS_EXIT_USAGE;
    }
    if (error instanceof EventsClientFailure) {
      const exit = error.status === 401 || error.status === 403 ? EVENTS_EXIT_AUTH : EVENTS_EXIT_TRANSPORT;
      input.stderr.write(`${JSON.stringify({ error: { code: error.code, message: error.message } })}\n`);
      return exit;
    }
    input.stderr.write(`${JSON.stringify({
      error: { code: "transport_error", message: error instanceof Error ? error.message : "Events command failed" },
    })}\n`);
    return EVENTS_EXIT_TRANSPORT;
  }
}

function permanentExitCode(message: string): number {
  return /HTTP 40[13]|no longer authorized|closed with code 440[13]/u.test(message)
    ? EVENTS_EXIT_AUTH
    : EVENTS_EXIT_USAGE;
}

function requireUuid(value: string | undefined, flag: string): string {
  if (!value || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(value)) {
    throw new EventsCliUsageError(`${flag} must be a UUID`);
  }
  return value;
}

function makeClient(
  input: EventsCommandInput,
  options: ConstructorParameters<typeof EventsClient>[0],
): EventsClient {
  const factory = input.clientFactory ?? ((clientOptions) => new EventsClient(clientOptions));
  return factory({
    ...options,
    ...(input.fetchImpl ? { fetchImpl: input.fetchImpl } : {}),
  });
}

function deferredExit(): { promise: Promise<number>; resolve: (code: number) => void } {
  let resolve!: (code: number) => void;
  const promise = new Promise<number>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}
