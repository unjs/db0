// PostgreSQL uses numbered placeholders ($1, $2, ...) instead of `?`.
// https://www.postgresql.org/docs/current/sql-prepare.html
//
// Only placeholders in actual SQL code must be rewritten. A `?` inside a string
// literal, a quoted identifier or a comment is data and has to be left as-is.
export function normalizeParams(sql: string): string {
  if (!sql.includes("?")) {
    return sql;
  }

  let result = "";
  let index = 0;
  let paramIndex = 0;

  while (index < sql.length) {
    const char = sql[index];

    switch (char) {
      // '...' string literal / "..." quoted identifier (doubling escapes the quote)
      case "'":
      case '"': {
        const end = skipQuoted(sql, index, char);
        result += sql.slice(index, end);
        index = end;
        continue;
      }
      // -- line comment
      case "-": {
        if (sql[index + 1] !== "-") {
          break;
        }
        const newline = sql.indexOf("\n", index);
        const end = newline === -1 ? sql.length : newline;
        result += sql.slice(index, end);
        index = end;
        continue;
      }
      // /* block comment */ (nestable in PostgreSQL)
      case "/": {
        if (sql[index + 1] !== "*") {
          break;
        }
        const end = skipBlockComment(sql, index);
        result += sql.slice(index, end);
        index = end;
        continue;
      }
      // $tag$ ... $tag$ dollar-quoted string
      case "$": {
        // A `$` directly attached to an identifier is part of that identifier
        // (`foo$tag$` is one identifier), so it cannot open a dollar-quote.
        const end = isIdentifierChar(sql[index - 1])
          ? -1
          : skipDollarQuoted(sql, index);
        if (end === -1) {
          break;
        }
        result += sql.slice(index, end);
        index = end;
        continue;
      }
      case "?": {
        result += `$${++paramIndex}`;
        index++;
        continue;
      }
    }

    result += char;
    index++;
  }

  return result;
}

/** Index right after the closing quote (or end of input for an unterminated literal). */
function skipQuoted(sql: string, start: number, quote: string): number {
  // `standard_conforming_strings` is on by default, so a backslash is literal in
  // a regular '...' string. Only E'...' strings give it its escaping meaning.
  const escapes = quote === "'" && isEscapeStringPrefix(sql, start);
  let index = start + 1;
  while (index < sql.length) {
    if (escapes && sql[index] === "\\") {
      index++;
    } else if (sql[index] === quote) {
      // A doubled quote is an escaped quote, not the end of the literal.
      if (sql[index + 1] === quote) {
        index++;
      } else {
        return index + 1;
      }
    }
    index++;
  }
  return sql.length;
}

const IDENTIFIER_CHAR_RE = /[\w$\u0080-\uFFFF]/;

function isIdentifierChar(char: string | undefined): boolean {
  return char !== undefined && IDENTIFIER_CHAR_RE.test(char);
}

/** Whether the quote at `start` opens an `E'...'` escape string literal. */
function isEscapeStringPrefix(sql: string, start: number): boolean {
  const prefix = sql[start - 1];
  return (
    (prefix === "E" || prefix === "e") && !isIdentifierChar(sql[start - 2])
  );
}

/** Index right after the closing `*​/` of a (possibly nested) block comment. */
function skipBlockComment(sql: string, start: number): number {
  let index = start + 2;
  let depth = 1;
  while (index < sql.length && depth > 0) {
    if (sql[index] === "/" && sql[index + 1] === "*") {
      depth++;
      index += 2;
    } else if (sql[index] === "*" && sql[index + 1] === "/") {
      depth--;
      index += 2;
    } else {
      index++;
    }
  }
  return index;
}

const DOLLAR_TAG_RE = /^\$[A-Z_a-z\u0080-\uFFFF][\w\u0080-\uFFFF]*\$|^\$\$/;

/** Index right after the closing dollar-quote tag, or `-1` if this is not a dollar-quoted string. */
function skipDollarQuoted(sql: string, start: number): number {
  const tag = DOLLAR_TAG_RE.exec(sql.slice(start))?.[0];
  if (!tag) {
    return -1;
  }
  const end = sql.indexOf(tag, start + tag.length);
  return end === -1 ? sql.length : end + tag.length;
}
