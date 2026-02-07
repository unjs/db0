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

export type ConnectorConnection = AsyncDisposable & {
  /**
   * The SQL dialect used by the connector.
   */
  dialect: SQLDialect;

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
   * Closes the connection and cleans up resources.
   * @returns {Promise<void>} A promise that resolves when the connection is closed.
   */
  dispose: () => Promise<void>;
};

/**
 * Defines a database connector for executing SQL queries and preparing statements.
 */
export type Connector<TInstance = unknown> = ConnectorConnection & {
  /**
   * The name of the connector.
   */
  name: string;

  /**
   * The SQL dialect used by the connector.
   */
  dialect: SQLDialect;

  /**
   * Whether the connector supports connection pooling.
   */
  supportsPooling: boolean;

  /**
   * The client instance used internally.
   */
  getInstance: () => TInstance | Promise<TInstance>;

  /**
   * Acquires a separate connection from the database.
   *
   * Will block all other queries until disposed if the connector doesn't support connection pooling.
   */
  acquireConnection: () => Promise<ConnectorConnection>;
};

/**
 * Represents default SQL results, including any error messages, row changes and rows returned.
 */
export type DefaultSQLResult = {
  lastInsertRowid?: number;
  changes?: number;
  error?: string;
  rows?: { id?: string | number; [key: string]: unknown }[];
  success?: boolean;
};

/**
 * A connection to a database.
 * Pulled from connection pool if available on the connector, otherwise blocking.
 */
export type Connection = ConnectorConnection & {
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
};

export interface Database<TConnector extends Connector = Connector>
  extends Connection {
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
   * Acquires a separate connection from the database.
   *
   * Will block all other queries until disposed unless the library supports connection pooling.
   */
  acquireConnection: (
    fn: (connection: Connection) => void | Promise<void>,
  ) => Promise<void>;
}
