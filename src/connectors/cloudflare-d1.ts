/// <reference types="@cloudflare/workers-types" />
import type { Connector, Primitive } from "db0";
import { BoundableStatement } from "./_internal/statement.ts";
import { getCloudflareBinding } from "./_internal/cloudflare.ts";

type RawStatement = D1PreparedStatement;

export interface ConnectorOptions {
  bindingName?: string;
}

export default function cloudflareD1Connector(
  options: ConnectorOptions,
): Connector<D1Database> {
  const getDB = () =>
    getCloudflareBinding<D1Database>("d1", options.bindingName!);

  return {
    name: "cloudflare-d1",
    dialect: "sqlite",
    // D1 has no explicit transactions (`BEGIN`/`COMMIT` are rejected);
    // only implicit ones via `D1Database.batch()`.
    // https://developers.cloudflare.com/d1/worker-api/d1-database/#batch
    capabilityOverrides: { transactions: false },
    getInstance: () => getDB(),
    exec: async (sql) => (await getDB()).exec(sql),
    prepare: (sql) =>
      new StatementWrapper(async () => (await getDB()).prepare(sql)),
  };
}

class StatementWrapper extends BoundableStatement<() => Promise<RawStatement>> {
  async all(...params: Primitive[]) {
    const res = await (await this._statement()).bind(...params).all();
    return res.results;
  }

  async run(...params: Primitive[]) {
    const res = await (await this._statement()).bind(...params).run();
    return res;
  }

  async get(...params: Primitive[]) {
    const res = await (await this._statement()).bind(...params).first();
    return res;
  }
}
