"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { controlPlaneRequest, ControlPlaneApiError } from "../../_lib/control-plane-api";
import { safeReturnDestination } from "../../_lib/auth-ui-model";
import { UiButton } from "../ui-actions";
import { UiInput } from "../ui-fields";

type AuthMode = "login" | "register";

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const register = mode === "register";

  useEffect(() => headingRef.current?.focus(), []);

  async function submit(formData: FormData) {
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await controlPlaneRequest<{ user: { requirePasswordChange: boolean } }>(
        register ? "/api/auth/register" : "/api/auth/login",
        {
          body: JSON.stringify({
            username: formData.get("username"),
            password: formData.get("password"),
          }),
          method: "POST",
        },
      );
      router.replace(
        result.user.requirePasswordChange
          ? "/account/password"
          : safeReturnDestination(searchParams.get("return")),
      );
    } catch (caught) {
      if (caught instanceof ControlPlaneApiError && register && caught.message === "invalid-registration") {
        setError("Use a unique username with 3-30 lowercase letters, numbers, or underscores.");
      } else {
        setError(caught instanceof ControlPlaneApiError ? caught.message : "Unable to contact Mystra.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="authPage">
      <form action={submit} className="authPanel">
        <p className="authEyebrow">Mystra control plane</p>
        <h1 ref={headingRef} tabIndex={-1}>{register ? "Create your local account" : "Sign in"}</h1>
        <p className="authDescription">
          {register
            ? "Use a username and password. Your first Team is created with your account."
            : "Sign in with your local username and password."}
        </p>
        <label>
          <span>Username</span>
          <UiInput autoComplete="username" autoFocus fieldSize="default" name="username" required />
        </label>
        <label>
          <span>Password</span>
          <UiInput
            autoComplete={register ? "new-password" : "current-password"}
            fieldSize="default"
            minLength={1}
            name="password"
            required
            type="password"
          />
        </label>
        {error ? <p aria-live="assertive" className="formError" role="alert">{error}</p> : null}
        <UiButton block disabled={isSubmitting} size="default" tone="solid" type="submit">
          {isSubmitting ? "Working…" : register ? "Create account" : "Sign in"}
        </UiButton>
        <p className="authAlternate">
          {register ? "Already have a local account?" : "Need a local account?"}{" "}
          <Link href={register ? "/login" : "/register"}>{register ? "Sign in" : "Register"}</Link>
        </p>
      </form>
    </main>
  );
}
