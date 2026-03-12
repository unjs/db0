/**
 * Represents primitive types that can be used in SQL operations.
 */
export type Primitive = string | number | boolean | undefined | null;

export type SQLDialect = "mysql" | "postgresql" | "sqlite" | "libsql";

export type Statement = {
  /**
   * Binds parameters to the statement.
   * @param {...Primitive[]} params - Parameters to bind to the SQL statement.
   * @returns {PreparedStatement} The instance of the statement with bound parameters.
   */
  bind(...params: Primitive[]): PreparedStatement;

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

export type PreparedStatement = {
  /**
   * Binds parameters to the statement.
   * @param {...Primitive[]} params - Parameters to bind to the SQL statement.
   * @returns {PreparedStatement} The instance of the statement with bound parameters.
   */
  bind(...params: Primitive[]): PreparedStatement;

  /**
   * Executes the statement and returns all resulting rows as an array.
   * @returns {Promise<unknown[]>} A promise that resolves to an array of rows.
   */
  all(): Promise<unknown[]>;

  /**
   * Executes the statement as an action (e.g. insert, update, delete).
   * @returns {Promise<{ success: boolean }>} A promise that resolves to the success state of the action.
   */
  run(): Promise<{ success: boolean }>;

  /**
   * Executes the statement and returns a single row.
   * @returns {Promise<unknown>} A promise that resolves to the first row in the result set.
   */
  get(): Promise<unknown>;
};

/**
 * Represents the result of a database execution.
 */
export type ExecResult = unknown;

/**
 * Defines a database connector for executing SQL queries and preparing statements.
 */
export type Connector<TInstance = unknown> = {
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
  getInstance: () => TInstance | Promise<TInstance>;

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

  /**
   * Closes the database connection and cleans up resources.
   * @returns {void | Promise<void>} A promise that resolves when the connection is closed.
   */
  dispose?: () => void | Promise<void>;
};

/**
 * Represents default SQL results, including any error messages, row changes and rows returned.
 */
type DefaultSQLResult = {
  lastInsertRowid?: number;
  changes?: number;
  error?: string;
  rows?: { id?: string | number; [key: string]: unknown }[];
  success?: boolean;
};

export interface Database<
  TConnector extends Connector = Connector,
> extends AsyncDisposable {
  readonly dialect: SQLDialect;

  /**
   * Indicates whether the database instance has been disposed/closed.
   * @returns {boolean} True if the database has been disposed, false otherwise.
   */
  readonly disposed: boolean;

  /**
   * The client instance used internally.
   * @returns {Promise<TInstance>} A promise that resolves with the client instance.
   */
  getInstance: () => Promise<Awaited<ReturnType<TConnector["getInstance"]>>>;

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

  /**
   * Closes the database connection and cleans up resources.
   * @returns {Promise<void>} A promise that resolves when the connection is closed.
   */
  dispose: () => Promise<void>;

  /**
   * AsyncDisposable implementation for using syntax support.
   * @returns {Promise<void>} A promise that resolves when the connection is disposed.
   */
  [Symbol.asyncDispose]: () => Promise<void>;
}
