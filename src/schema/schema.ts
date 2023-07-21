import type { JsonSchema7ObjectType } from "zod-to-json-schema/src/parsers/object";

export type JSONSchema = JsonSchema7ObjectType & { $schema: string };

export type SchemaBaseType = Record<string, any> & {
  [key: `$${string}`]: never;
};

export type Schema<T extends SchemaBaseType = SchemaBaseType> = {
  validate?: (value: T) => void;
  defaults?: () => Partial<T>;
  jsonSchema?: () => JSONSchema;
};

export function defineSchema<T extends SchemaBaseType = SchemaBaseType>(
  schema: Schema<T> = {}
): Schema<T> {
  return schema;
}
