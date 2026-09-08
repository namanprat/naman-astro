/**
 * Sanity connection, read from the environment and nowhere else.
 *
 * ponytail: no fallback project id. A placeholder would let the Studio boot
 * against a project that is not ours, and it would let the loader think it
 * had somewhere to query. Missing means "use the committed YAML", which is
 * the whole reason Phase B landed first.
 */
export type SanityEnv = {
  projectId: string;
  dataset: string;
  token?: string;
};

export function readSanityEnv(
  env: NodeJS.ProcessEnv = process.env,
): SanityEnv | null {
  const projectId = env.PUBLIC_SANITY_PROJECT_ID?.trim();
  if (!projectId) return null;
  return {
    projectId,
    dataset: env.PUBLIC_SANITY_DATASET?.trim() || "production",
    token: env.SANITY_API_READ_TOKEN?.trim() || undefined,
  };
}

export const SANITY_API_VERSION = "2025-02-19";
