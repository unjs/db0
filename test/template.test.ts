import { describe, it, expect } from "vitest";
import { sqlTemplate } from "../src/template";

describe("SQL Template", () => {
  const tests = [
    {
      sql: sqlTemplate`SELECT * FROM {${"users"}} WHERE age > ${25} AND type = ${"test"}`,
      query: "SELECT * FROM users WHERE age > ? AND type = ?",
      values: [25, "test"],
    },
    {
      sql: sqlTemplate`INSERT INTO {${"users"}} ({${"name"}}, {${"age"}}) VALUES (${25}, ${"test"})`,
      query: "INSERT INTO users (name, age) VALUES (?, ?)",
      values: [25, "test"],
    },
  ];

  for (const test of tests) {
    const testName = `${test.query} (${test.values.join(", ")}))`;
    it(testName, () => {
      expect(test.sql).toEqual([test.query, test.values]);
    });
  }
});
