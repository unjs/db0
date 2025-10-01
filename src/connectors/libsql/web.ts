import type { Config, Client } from "@libsql/client";
import type { Connector, Primitive } from "db0";
import { createClient } from "@libsql/client/http";
import libSqlCore from "./core.ts";

export type ConnectorOptions = Config;

export default function libSqlConnector(
  opts: ConnectorOptions,
): Connector<Client> {
  let _client: Client | undefined;
  const getClient = () => {
    if (!_client) {
      _client = createClient(opts);
    }
    return _client;
  };
  return libSqlCore({
    name: "libsql-web",
    getClient,
  });
}
