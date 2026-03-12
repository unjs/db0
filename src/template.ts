import type { Primitive } from "./types.ts";

export function sqlTemplate(
  strings: TemplateStringsArray,
  ...values: Primitive[]
): [string, Primitive[]] {
  if (!isTemplateStringsArray(strings) || !Array.isArray(values)) {
    throw new Error("[db0] invalid template invocation");
  }

  const staticIndexes: number[] = [];

  let result = strings[0] || "";
  for (let i = 1; i < strings.length; i++) {
    if (result.endsWith("{") && strings[i].startsWith("}")) {
      result = result.slice(0, -1) + values[i - 1] + strings[i].slice(1);
      staticIndexes.push(i - 1);
      continue;
    }
    result += `?${strings[i] ?? ""}`;
  }

  const dynamicValues = values.filter((_, i) => !staticIndexes.includes(i));

  return [result.trim(), dynamicValues];
}

function isTemplateStringsArray(
  strings: unknown,
): strings is TemplateStringsArray {
  return (
    Array.isArray(strings) && "raw" in strings && Array.isArray(strings.raw)
  );
}
