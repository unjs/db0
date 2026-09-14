/// <reference types="@cloudflare/workers-types" />

async function getCloudflareEnv(): Promise<Record<string, unknown>> {
  const { env } = await import("cloudflare:workers" as any);
  return env;
}

export async function getCloudflareBinding<T>(
  type: string,
  bindingName: string,
): Promise<T> {
  const env = await getCloudflareEnv();
  const binding = env?.[bindingName] as T | undefined;
  if (!binding) {
    throw new Error(`[db0] [${type}] binding \`${bindingName}\` not found`);
  }
  return binding;
}

export function getHyperdrive(bindingName: string): Promise<Hyperdrive> {
  return getCloudflareBinding<Hyperdrive>("hyperdrive", bindingName);
}
