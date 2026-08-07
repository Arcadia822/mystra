export function safeReturnDestination(value: string | null): string {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export function apiErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    conflict: "That value is already in use.",
    "csrf-failed": "Your browser session could not be verified. Reload the page and try again.",
    forbidden: "You do not have permission to make this change.",
    "invalid-credentials": "The username or password is incorrect.",
    "invalid-current-password": "The current password is incorrect.",
    "last-active-team-protected": "You must remain in at least one active Team.",
    "last-owner-protected": "At least one active Owner must remain on this Team.",
    "not-found": "No matching user was found.",
    unauthenticated: "Your session has ended. Please sign in again.",
  };
  return messages[code] ?? "The request could not be completed. Please try again.";
}
