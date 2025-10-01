import type { Hyperdrive } from "@cloudflare/workers-types";

function getCloudflareEnv() {
  return (
    (globalThis as any).__env__ ||
    import("cloudflare:workers" as any).then((mod) => mod.env)
  );
}

export async function getHyperdrive(bindingName: string): Promise<Hyperdrive> {
  const env = await getCloudflareEnv();
  const binding: Hyperdrive = env[bindingName];
  if (!binding) {
    throw new Error(`[db0] [hyperdrive] binding \`${bindingName}\` not found`);
  }
  return binding;
}
