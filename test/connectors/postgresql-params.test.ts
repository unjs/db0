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

  it("only treats backslashes as escapes in E'...' strings", () => {
    // standard_conforming_strings: the backslash is literal, so the literal
    // ends at the next quote and the trailing `?` is a placeholder.
    expect(normalizeParams(String.raw`SELECT 'a\', ?`)).toBe(
      String.raw`SELECT 'a\', $1`,
    );
    // E'...' does use backslash escapes, so `\'` stays inside the literal.
    expect(normalizeParams(String.raw`SELECT E'it\'s ?', ?`)).toBe(
      String.raw`SELECT E'it\'s ?', $1`,
    );
    // a trailing `e`/`E` of an identifier does not turn the literal into E'...'
    expect(normalizeParams(String.raw`SELECT type'a\', ?`)).toBe(
      String.raw`SELECT type'a\', $1`,
    );
  });

  it("does not mistake identifiers containing `$` for dollar quotes", () => {
    // `foo$tag$` is a single identifier, so `?` after it is still a placeholder.
    expect(normalizeParams("SELECT foo$tag$, ?")).toBe("SELECT foo$tag$, $1");
    expect(normalizeParams("SELECT foo$$, ?")).toBe("SELECT foo$$, $1");
    // whitespace separates the identifier from a real dollar-quoted string
    expect(normalizeParams("SELECT foo $tag$ a ? b $tag$, ?")).toBe(
      "SELECT foo $tag$ a ? b $tag$, $1",
    );
  });

  it("rewrites placeholders that are directly followed by an operator", () => {
    // the template tag emits a bare `?`, so `${a}||'b'` arrives as `?||'b'`
    expect(normalizeParams("SELECT ?||'cd'")).toBe("SELECT $1||'cd'");
    expect(normalizeParams("SELECT ?||?")).toBe("SELECT $1||$2");
    expect(normalizeParams("SELECT ?::int&1")).toBe("SELECT $1::int&1");
    expect(normalizeParams("SELECT ?&?")).toBe("SELECT $1&$2");
  });

  it("rejects mixing `?` placeholders with numbered `$n` parameters", () => {
    // both styles number from $1, so the generated placeholder would collide
    // with the hand-written one and silently bind the wrong value
    expect(() => normalizeParams("SELECT $1, ?")).toThrow(
      "cannot mix `?` placeholders with numbered `$n` parameters",
    );
    // a `$n` that is data, not a parameter, is not a mix
    expect(normalizeParams("SELECT 'costs $100? yes', ?")).toBe(
      "SELECT 'costs $100? yes', $1",
    );
    expect(normalizeParams("SELECT ? -- see $1\n")).toBe(
      "SELECT $1 -- see $1\n",
    );
    expect(normalizeParams("SELECT foo$1, ?")).toBe("SELECT foo$1, $1");
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
