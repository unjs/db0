import type { Connector, Database, Primitive } from "./types";

export function createDatabase(connector: Connector): Database {
  return <Database>{
    exec: (sql: string) => {
      return Promise.resolve(connector.exec(sql));
    },

    prepare: (sql: string) => {
      return connector.prepare(sql);
    },

    sql: async (strings, ...values) => {
      const [sql, params] = sqlTemplate(strings, ...values);
      const res = await connector.prepare(sql).run(...params);
      return res;
    },

    query: async (strings, ...values) => {
      const [sql, params] = sqlTemplate(strings, ...values);
      const rows = await connector.prepare(sql).all(...params);
      return {
        rows,
      };
    },
  };
}

export function sqlTemplate(
  strings: TemplateStringsArray,
  ...values: Primitive[]
): [string, Primitive[]] {
  if (!isTemplateStringsArray(strings) || !Array.isArray(values)) {
    throw new Error("[db0] invalid template invokation");
  }

  let result = strings[0] || "";

  for (let i = 1; i < strings.length; i++) {
    result += `?${strings[i] ?? ""}`;
  }

  return [result, values];
}

function isTemplateStringsArray(
  strings: unknown
): strings is TemplateStringsArray {
  return (
    Array.isArray(strings) && "raw" in strings && Array.isArray(strings.raw)
  );
}
