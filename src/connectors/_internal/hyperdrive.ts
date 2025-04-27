import type { Hyperdrive } from "@cloudflare/workers-types/experimental";

async function getCloudflareEnv() {
  try {
    // @ts-ignore - cloudflare:workers is only available in CF runtime
    const cfEnv = await import("cloudflare:workers");
    return cfEnv.env;
  } catch {
    return {};
  }
}

export async function getHyperdrive(bindingName: string) {
  const env = await getCloudflareEnv();
  const binding: Hyperdrive = env[bindingName] || globalThis.__env__?.[bindingName];
  if (!binding) {
    throw new Error(`[db0] [hyperdrive] binding \`${bindingName}\` not found`);
  }
  return binding;
}
