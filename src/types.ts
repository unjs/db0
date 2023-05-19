export type Primitive = string | number | boolean | undefined | null;

export type Statement = {
  bind(...params: Primitive[]): Statement;
  all(...params: Primitive[]): Promise<unknown[]>;
  run(...params: Primitive[]): Promise<{ success: boolean }>;
  get(...params: Primitive[]): Promise<unknown>;
};

export type ExecResult = unknown;

export type Connector = {
  name: string;
  exec: (sql: string) => ExecResult | Promise<ExecResult>;
  prepare: (sql: string) => Statement;
};

type SqlTemplate<T> = (
  strings: TemplateStringsArray,
  ...values: Primitive[]
) => T;

export type Database = {
  exec: (sql: string) => Promise<ExecResult>;
  prepare: (sql: string) => Statement;

  sql: SqlTemplate<Promise<ExecResult>>;
  query: SqlTemplate<Promise<{ rows: unknown[] }>>;
};
