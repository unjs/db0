import type { AnyRelations, EmptyRelations } from "drizzle-orm";
import type { DrizzleSQLiteConfig } from "drizzle-orm/sqlite-core";

// Re-export SQLite drizzle integration as the default (backwards compatible)
export { drizzle } from "./sqlite/index.ts";
export type {
  DrizzleSQLiteDatabase as DrizzleDatabase,
  DB0DrizzleSQLiteConfig,
} from "./sqlite/index.ts";

/**
 * Config accepted by the default (SQLite) `drizzle()` integration.
 *
 * Kept as an alias with a `TRelations` default: drizzle v1 replaced
 * `DrizzleConfig<TSchema, TRelations>` (both parameters defaulted) with
 * `DrizzleSQLiteConfig<TRelations>`, which has no default, so re-exporting it
 * directly would break every downstream `DrizzleBaseConfig` used without a type
 * argument.
 */
export type DrizzleBaseConfig<
  TRelations extends AnyRelations = EmptyRelations,
> = DrizzleSQLiteConfig<TRelations>;
