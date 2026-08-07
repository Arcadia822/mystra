"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { controlPlaneRequest } from "../_lib/control-plane-api";
import { safeReturnDestination } from "../_lib/auth-ui-model";
import { AppShell } from "./app-shell";
import { UiButton } from "./ui-actions";

interface SessionResponse {
  user: { requirePasswordChange: boolean };
}

const authPaths = new Set(["/login", "/register"]);

export function ControlPlaneGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [state, setState] = useState<"loading" | "authenticated" | "unauthenticated" | "unavailable">("loading");
  const [passwordChangeRequired, setPasswordChangeRequired] = useState(false);
  const isAuthPath = authPaths.has(pathname);
  const isPasswordPath = pathname === "/account/password";

  useEffect(() => {
    let active = true;
    void controlPlaneRequest<SessionResponse>("/api/auth/session")
      .then((session) => {
        if (!active) return;
        setPasswordChangeRequired(session.user.requirePasswordChange);
        setState("authenticated");
        if (session.user.requirePasswordChange && !isPasswordPath) router.replace("/account/password");
        if (!session.user.requirePasswordChange && isAuthPath) {
          router.replace(safeReturnDestination(searchParams.get("return")));
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        const status = typeof error === "object" && error && "status" in error ? error.status : 0;
        if (status === 401) {
          setState("unauthenticated");
          if (!isAuthPath) {
            const returnTo = `${pathname}${searchParams.size ? `?${searchParams}` : ""}`;
            router.replace(`/login?return=${encodeURIComponent(returnTo)}`);
          }
        } else {
          setState("unavailable");
        }
      });
    return () => { active = false; };
  }, [isAuthPath, isPasswordPath, pathname, router, searchParams]);

  if (state === "loading") return <main aria-busy="true" className="accessGate" role="status">Checking your session…</main>;
  if (state === "unavailable") return <main className="accessGate" role="alert">Mystra could not verify your session. Try again shortly.</main>;
  if (state === "unauthenticated") return isAuthPath ? children : null;
  if (passwordChangeRequired) return isPasswordPath ? <main className="passwordGate">{children}</main> : <RequiredPasswordGate />;
  if (isAuthPath) return null;
  return <AppShell>{children}</AppShell>;
}

function RequiredPasswordGate() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <main className="passwordGate" role="main">
      <section className="authPanel">
        <h1>Password change required</h1>
        <p>Your account can only change its password or sign out until this requirement is complete.</p>
        <UiButton size="default" tone="solid" onClick={() => router.replace("/account/password")}>Change password</UiButton>
        <UiButton size="default" tone="ghost" onClick={() => void logout()}>Sign out</UiButton>
      </section>
    </main>
  );
}
