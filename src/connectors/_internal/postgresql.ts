// https://www.postgresql.org/docs/9.3/sql-prepare.html
export function normalizeParams(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}
