/**
 * Represents primitive types that can be used in SQL operations.
 */
export type Primitive = string | number | boolean | undefined | null;

export type SQLDialect = "mysql" | "postgresql" | "sqlite" | "libsql";

export type Statement = {
  /**
   * Binds parameters to the statement and returns itself for concatenation.
   * @param {...Primitive[]} params - Parameters to bind to the SQL statement.
   * @returns {Statement} The instance of the statement for further cascading.
   */
  bind(...params: Primitive[]): Statement;

  /**
   * Executes the statement and returns all resulting rows as an array.
   * @param {...Primitive[]} params - Parameters to bind to the SQL statement.
   * @returns {Promise<unknown[]>} A promise that resolves to an array of rows.
   */
  all(...params: Primitive[]): Promise<unknown[]>;

  /**
   * Executes the statement as an action (e.g. insert, update, delete).
   * @param {...Primitive[]} params - Parameters to bind to the SQL statement.
   * @returns {Promise<{ success: boolean }>} A promise that resolves to the success state of the action.
   */
  run(...params: Primitive[]): Promise<{ success: boolean }>;

  /**
   * Executes the statement and returns a single row.
   * @param {...Primitive[]} params - Parameters to bind to the SQL statement.
   * @returns {Promise<unknown>} A promise that resolves to the first row in the result set.
   */
  get(...params: Primitive[]): Promise<unknown>;
};

/**
 * Represents the result of a database execution.
 */
export type ExecResult = unknown;

/**
 * Defines a database connector for executing SQL queries and preparing statements.
 */
export type Connector<TInstance = any> = {
  /**
   * The name of the connector.
   */
  name: string;

  /**
   * The SQL dialect used by the connector.
   */
  dialect: SQLDialect;

  /**
   * The client instance used internally.
   */
  getInstance: () => Promise<TInstance>;

  /**
   * Executes an SQL query directly and returns the result.
   * @param {string} sql - The SQL string to execute.
   * @returns {ExecResult | Promise<ExecResult>} The result of the execution.
   */
  exec: (sql: string) => ExecResult | Promise<ExecResult>;

  /**
   * Prepares an SQL statement for execution.
   * @param {string} sql - The SQL string to prepare.
   * @returns {statement} The prepared SQL statement.
   */
  prepare: (sql: string) => Statement;
};

/**
 * Represents default SQL results, including any error messages, row changes and rows returned.
 */
type DefaultSQLResult = {
  lastInsertRowid?: number;
  changes?: number;
  error?: string;
  rows?: { id?: string | number; [key: string]: unknown }[];
};

export interface Database<TConnector extends Connector = Connector> {
  readonly dialect: SQLDialect;

  /**
   * The client instance used internally.
   * @returns {Promise<TInstance>} A promise that resolves with the client instance.
   */
  getInstance: () => Promise<TConnector["getInstance"]>;

  /**
   * Executes a raw SQL string.
   * @param {string} sql - The SQL string to execute.
   * @returns {Promise<ExecResult>} A promise that resolves with the execution result.
   */
  exec: (sql: string) => Promise<ExecResult>;

  /**
   * Prepares an SQL statement from a raw SQL string.
   * @param {string} sql - The SQL string to prepare.
   * @returns {statement} The prepared SQL statement.
   */
  prepare: (sql: string) => Statement;

  /**
   * Executes SQL queries using tagged template literals.
   * @template T The expected type of query result.
   * @param {TemplateStringsArray} strings - The segments of the SQL string.
   * @param {...Primitive[]} values - The values to interpolate into the SQL string.
   * @returns {Promise<T>} A promise that resolves with the typed result of the query.
   */
  sql: <T = DefaultSQLResult>(
    strings: TemplateStringsArray,
    ...values: Primitive[]
  ) => Promise<T>;
}
