import type { D1Database, D1PreparedStatement as RawStatement  } from '@cloudflare/workers-types'
import type { Connector, Statement } from "../types";
import { BoundableStatement } from "./_internal/statement";

export interface ConnectorOptions {
  bindingName?: string;
}

export default function cloudflareD1Connector(options: ConnectorOptions) {
  const getDB = () => {
    // TODO: Remove legacy __cf_env__ support in next major version
    const binding: D1Database = globalThis.__env__?.[options.bindingName] || globalThis.__cf_env__?.[options.bindingName];
    if (!binding) {
      throw new Error(`[db0] [d1] binding \`${options.bindingName}\` not found`);
    }
    return binding;
  }

  return <Connector<D1Database>>{
    name: "cloudflare-d1",
    dialect: "sqlite",
    getInstance: () => getDB(),
    exec: (sql) => getDB().exec(sql),
    prepare: sql => new StatementWrapper(getDB().prepare(sql))
  };
}

class StatementWrapper extends BoundableStatement<RawStatement> {
  async all(...params) {
    const res = await this._rawStmt.bind(...params).all()
    return res.results
  }

  async run(...params) {
    const res = await this._rawStmt.bind(...params).run()
    return res
  }

  async get(...params) {
    const res = await this._rawStmt.bind(...params).first()
    return res
  }
}
