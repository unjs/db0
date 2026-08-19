import { describe, expect, it } from "vitest";
import { normalizeParams } from "../../src/connectors/_internal/postgresql";

describe("connectors: postgresql normalizeParams", () => {
  it("numbers placeholders in order and leaves param-less SQL untouched", () => {
    expect(
      normalizeParams("SELECT * FROM users WHERE id = ? AND name = ?"),
    ).toBe("SELECT * FROM users WHERE id = $1 AND name = $2");
    expect(normalizeParams("SELECT 1")).toBe("SELECT 1");
    expect(normalizeParams("SELECT $1 FROM users")).toBe(
      "SELECT $1 FROM users",
    );
  });

  it("keeps question marks that are data, not placeholders", () => {
    // https://github.com/unjs/db0/issues/216
    expect(
      normalizeParams("INSERT INTO posts (body) VALUES ('what? ok?')"),
    ).toBe("INSERT INTO posts (body) VALUES ('what? ok?')");
    expect(
      normalizeParams(
        "INSERT INTO posts (body, slug) VALUES ('why? because.', ?)",
      ),
    ).toBe("INSERT INTO posts (body, slug) VALUES ('why? because.', $1)");
    // doubled quote escapes the quote and does not end the literal
    expect(normalizeParams("SELECT 'it''s a ? mark', ?")).toBe(
      "SELECT 'it''s a ? mark', $1",
    );
    // quoted identifiers, comments and dollar-quoted bodies are opaque too
    expect(normalizeParams('SELECT "weird?column" FROM t WHERE a = ?')).toBe(
      'SELECT "weird?column" FROM t WHERE a = $1',
    );
    expect(normalizeParams("SELECT ? -- is this ok?\n, ?")).toBe(
      "SELECT $1 -- is this ok?\n, $2",
    );
    expect(normalizeParams("SELECT ? /* huh? /* ? */ */, ?")).toBe(
      "SELECT $1 /* huh? /* ? */ */, $2",
    );
    expect(normalizeParams("SELECT $tag$ a ? b $tag$, ?")).toBe(
      "SELECT $tag$ a ? b $tag$, $1",
    );
    expect(normalizeParams("SELECT $$ a ? b $$, ?")).toBe(
      "SELECT $$ a ? b $$, $1",
    );
  });

  it("does not hang or drop input on unterminated literals", () => {
    expect(normalizeParams("SELECT 'unterminated ?")).toBe(
      "SELECT 'unterminated ?",
    );
    expect(normalizeParams("SELECT ? /* unterminated ?")).toBe(
      "SELECT $1 /* unterminated ?",
    );
    expect(normalizeParams("SELECT $tag$ unterminated ?")).toBe(
      "SELECT $tag$ unterminated ?",
    );
  });
});
