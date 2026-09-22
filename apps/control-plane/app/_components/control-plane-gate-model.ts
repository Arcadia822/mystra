export type ControlPlaneGateState = "loading" | "authenticated" | "unauthenticated" | "unavailable";

export function initialControlPlaneGateState(isAuthPath: boolean): ControlPlaneGateState {
  return isAuthPath ? "unauthenticated" : "loading";
}
