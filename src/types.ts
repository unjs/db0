export type Statement = {
  bind(...params: unknown[]): Statement;
  all(...params: unknown[]): Promise<unknown[]>;
  run(...params: unknown[]): Promise<{ success: boolean }>;
  get(...params: unknown[]): Promise<unknown>;
};

export type ExecResult = unknown;

export type Connector = {
  name: string;
  exec: (sql: string) => ExecResult | Promise<ExecResult>;
  prepare: (sql: string) => Statement;
};

export type Database = {
  exec: (sql: string) => Promise<ExecResult>;
  prepare: (sql: string) => Statement;
};
