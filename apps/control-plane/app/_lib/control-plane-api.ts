import { apiErrorMessage } from "./auth-ui-model";

export class ControlPlaneApiError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(apiErrorMessage(code));
  }
}

export async function controlPlaneRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "include",
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const code = body?.error?.code;
    throw new ControlPlaneApiError(response.status, typeof code === "string" ? code : "request-failed");
  }
  return body as T;
}
