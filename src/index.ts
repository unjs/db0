export { createDatabase } from "./database.ts";
export { dialectCapabilities, getCapabilities } from "./capabilities.ts";

export { connectors } from "./_connectors.ts";

export type {
  Connector,
  Database,
  DatabaseCapabilities,
  ExecResult,
  Primitive,
  SQLDialect,
  Statement,
  PreparedStatement,
} from "./types.ts";

export type { ConnectorName, ConnectorOptions } from "./_connectors.ts";
