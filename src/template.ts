import type { Primitive } from "./types";

export function sqlTemplate(
  strings: TemplateStringsArray,
  ...values: Primitive[]
): [string, Primitive[]] {
  if (!isTemplateStringsArray(strings) || !Array.isArray(values)) {
    throw new Error("[db0] invalid template invokation");
  }

  let result = strings[0] || "";

  for (let i = 1; i < strings.length; i++) {
    if (result.endsWith("{") && strings[i].startsWith("}")) {
      result = result.slice(0, -1) + values[i - 1] + strings[i].slice(1);
      values.splice(i - 1, 1);
      continue;
    }
    result += `?${strings[i] ?? ""}`;
  }

  return [result, values];
}

function isTemplateStringsArray(
  strings: unknown,
): strings is TemplateStringsArray {
  return (
    Array.isArray(strings) && "raw" in strings && Array.isArray(strings.raw)
  );
}
