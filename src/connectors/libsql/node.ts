import type { Config } from "@libsql/client";
import { createClient } from "@libsql/client";
import libSqlCore from "./core";

export type ConnectorOptions = Config;

export default function libSqlConnector(opts: ConnectorOptions) {
  let _client;
  const getClient = () => {
    if (!_client) {
      _client = createClient(opts);
    }
    return _client;
  };
  return libSqlCore({
    name: "libsql-node",
    getClient,
  });
}
