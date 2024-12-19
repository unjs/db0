import type { Connector, Statement } from "../types";

export interface ConnectorOptions {
  bindingName?: string;
}

export default function cloudflareD1Connector(options: ConnectorOptions) {
  const getDB = () => {
    // TODO: Remove legacy __cf_env__ support in next major version
    const binding = globalThis.__env__?.[options.bindingName] || globalThis.__cf_env__?.[options.bindingName];
    if (!binding) {
      throw new Error(`[db0] [d1] binding \`${options.bindingName}\` not found`);
    }
    return binding;
  }

  return <Connector>{
    name: "cloudflare-d1",
    dialect: "sqlite",
    getInstance: async () => getDB(),
    exec: (sql: string) => getDB().exec(sql),
    prepare: (sql: string) => {
      const _stmt = getDB().prepare(sql);
      const onError = (err) => {
        if (err.cause) {
          err.message = err.cause.message + ' "' + sql + '"';
        }
        throw err;
      };
      const stmt = <Statement>{
        bind(...params) {
          _stmt.bind(...params);
          return stmt;
        },
        all(...params) {
          return _stmt
            .bind(...params)
            .all()
            .catch(onError);
        },
        run(...params) {
          return _stmt
            .bind(...params)
            .run()
            .then((res) => {
              return { success: res.success };
            })
            .catch(onError);
        },
        get(...params) {
          return _stmt
            .bind(...params)
            .first()
            .catch(onError);
        },
      };
      return stmt;
    },
  };
}
