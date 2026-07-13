// Re-export SQLite drizzle integration as the default (backwards compatible)
export { drizzle } from "./sqlite/index.ts";
export type { DrizzleSQLiteDatabase as DrizzleDatabase } from "./sqlite/index.ts";

// Re-export config type from drizzle-orm
export type { DrizzleConfig as DrizzleBaseConfig } from "drizzle-orm";
