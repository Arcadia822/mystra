"use client";

import { useCallback, useEffect, useState } from "react";

export interface ResourceState<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

function errorMessage(payload: unknown, status: number): string {
  if (
    payload
    && typeof payload === "object"
    && "error" in payload
    && payload.error
    && typeof payload.error === "object"
  ) {
    const error = payload.error as { code?: unknown; message?: unknown };
    if (typeof error.message === "string") {
      return typeof error.code === "string"
        ? `${error.code}: ${error.message}`
        : error.message;
    }
  }
  return `Request failed with status ${status}`;
}

export function useResource<T>(url: string, intervalMs = 0): ResourceState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(url, { cache: "no-store" });
      const payload = await response.json() as T;
      if (!response.ok) {
        throw new Error(errorMessage(payload, response.status));
      }
      setData(payload);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsLoading(false);
    }
  }, [url]);

  useEffect(() => {
    void refresh();
    if (intervalMs <= 0) return;
    const timer = window.setInterval(() => void refresh(), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs, refresh]);

  return { data, error, isLoading, refresh };
}
