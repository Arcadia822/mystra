import {
  type ProviderCapability,
  type RuntimeView,
} from "@mystra/shared";

export interface RuntimesResponse {
  runtimes: RuntimeView[];
}

export interface RuntimeRenameResponse {
  runtime: RuntimeView;
}

export function availableProviders(runtime: RuntimeView): ProviderCapability[] {
  return runtime.providers.filter((provider) => provider.available);
}
