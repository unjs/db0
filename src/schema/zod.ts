import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { Schema } from "./schema";

export { z } from "zod";

export function defineZodSchema<T extends z.ZodRawShape>(
  shape: T,
  additional?: Partial<Exclude<Schema, "defaults" | "validate">>,
): Schema<z.TypeOf<z.ZodObject<T>>> {
  const _schema = z.object({
    ...shape,
  });
  return {
    ...(additional as any),
    defaults: () => {
      return _schema.partial().parse({});
    },
    validate: (value: any) => {
      return _schema.safeParse(value).success;
    },
    jsonSchema: () => {
      return zodToJsonSchema(_schema);
    },
  };
}
