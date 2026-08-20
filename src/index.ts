export { createDatabase } from "./database.ts";
export { dialectCapabilities, getCapabilities } from "./capabilities.ts";

export { connectors, connectorDependencies } from "./_connectors.ts";

export type {
  Connector,
  ConnectorDependency,
  ConnectorDependencies,
  Database,
  DatabaseCapabilities,
  ExecResult,
  LibImport,
  Primitive,
  SQLDialect,
  Statement,
  PreparedStatement,
} from "./types.ts";

export type { ConnectorName, ConnectorOptions } from "./_connectors.ts";
