import { fileURLToPath } from "node:url";
import { rmSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { createDatabase, DBTable, defineZodSchema, z } from "../src";
import sqlite3 from "../src/connectors/better-sqlite3";

describe("schema", () => {
  // Setup SQLite database
  const tmpDir = fileURLToPath(new URL(".tmp/schema", import.meta.url));
  rmSync(tmpDir, { recursive: true, force: true });
  const db = createDatabase(
    sqlite3({
      cwd: tmpDir,
    }),
  );

  it("works", async () => {
    const booksSchema = defineZodSchema({
      title: z.string().min(1),
    });

    const booksTable = new DBTable(db, "books", booksSchema);

    await booksTable.insert({
      title: "The Great Gatsby",
    });

    expect(await booksTable.findAll()).toMatchInlineSnapshot(`
      [
        {
          "$id": "1",
        },
      ]
    `);

    // expect(await booksTable.findAll()).toMatchInlineSnapshot(`
    //   {
    //     "$id": undefined,
    //     "title": "The Great Gatsby",
    //   }
    // `);
  });
});
