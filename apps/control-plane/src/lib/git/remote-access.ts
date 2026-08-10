export type GitRemoteCredential = {
  kind: "http-basic-token";
  username: string;
  secret: string;
};

type GitRemoteAccessMaterial = {
  endpoint: string;
  credential?: GitRemoteCredential;
};

declare const gitRemoteAccessBrand: unique symbol;
export type GitRemoteAccess = { readonly [gitRemoteAccessBrand]: true };

const materials = new WeakMap<object, GitRemoteAccessMaterial>();

export function createGitRemoteAccess(input: GitRemoteAccessMaterial): GitRemoteAccess {
  const endpoint = new URL(input.endpoint);
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password) {
    throw new Error("Git remote access requires a credential-free HTTPS endpoint");
  }
  if (input.credential && (!input.credential.username || !input.credential.secret)) {
    throw new Error("Git remote credential is incomplete");
  }
  const handle = Object.freeze({});
  materials.set(handle, {
    endpoint: endpoint.toString(),
    ...(input.credential ? { credential: { ...input.credential } } : {}),
  });
  return handle as GitRemoteAccess;
}

export function readGitRemoteAccess(access: GitRemoteAccess): GitRemoteAccessMaterial {
  const material = materials.get(access);
  if (!material) throw new Error("Git remote access is invalid or expired");
  return material;
}
