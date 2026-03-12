import type {
  D1Database,
  D1PreparedStatement as RawStatement,
} from "@cloudflare/workers-types";
import type { Connector, Primitive } from "db0";
import { BoundableStatement } from "./_internal/statement.ts";

export interface ConnectorOptions {
  bindingName?: string;
}

export default function cloudflareD1Connector(
  options: ConnectorOptions,
): Connector<D1Database> {
  const getDB = () => {
    // TODO: Remove legacy __cf_env__ support in next major version
    const binding: D1Database =
      ((globalThis as any).__env__ as any)?.[options.bindingName!] ||
      ((globalThis as any).__cf_env__ as any)?.[options.bindingName!];
    if (!binding) {
      throw new Error(
        `[db0] [d1] binding \`${options.bindingName}\` not found`,
      );
    }
    return binding;
  };

  return {
    name: "cloudflare-d1",
    dialect: "sqlite",
    getInstance: () => getDB(),
    exec: (sql) => getDB().exec(sql),
    prepare: (sql) => new StatementWrapper(getDB().prepare(sql)),
  };
}

class StatementWrapper extends BoundableStatement<RawStatement> {
  async all(...params: Primitive[]) {
    const res = await this._statement.bind(...params).all();
    return res.results;
  }

  async run(...params: Primitive[]) {
    const res = await this._statement.bind(...params).run();
    return res;
  }

  async get(...params: Primitive[]) {
    const res = await this._statement.bind(...params).first();
    return res;
  }
}
