import type { Database, SQLDialect, Primitive } from "../../types.ts";
import type {
  IsolationLevel,
  SqlDriverAdapter,
  SqlQuery,
  SqlResultSet,
  Transaction,
  Provider,
  SqlDriverAdapterFactory,
} from "@prisma/driver-adapter-utils";
import { DriverAdapterError } from "@prisma/driver-adapter-utils";
import { Mutex } from "async-mutex";

const adapterName = "db0";
const getProviderFromDialect = (dialect: SQLDialect): Provider => {
  switch (dialect) {
    case "postgresql": {
      return "postgres";
    }
    case "libsql": {
      return "sqlite";
    }
    default: {
      return dialect;
    }
  }
};

export function prisma(db: Database): SqlDriverAdapterFactory {
  const mutex = new Mutex();
  const provider = getProviderFromDialect(db.dialect);

  const adapter: Omit<SqlDriverAdapter, 'startTransaction'> = {
    adapterName,
    provider,

    executeScript: async function (script: string): Promise<void> {
      await db.exec(script);
    },

    dispose: db.dispose,

    queryRaw: async function (params: SqlQuery): Promise<SqlResultSet> {
      const stmt = db.prepare(params.sql);
      const args = (params.args || []) as Primitive[];

      return stmt.all(...args).then((result) => {
        const columnNames = Object.keys((result as any)[0] || {});
        const rows = (result as any[]).map((row) =>
          columnNames.map((col) => row[col]),
        );
        const columnTypes = columnNames.map(() => 7 as const);
        return { columnNames, columnTypes, rows };
      });
    },

    executeRaw: async function (params: SqlQuery) {
      const stmt = db.prepare(params.sql);
      const args = (params.args || []) as Primitive[];

      return stmt
        .run(...args)
        .then((res) => (res as any).changes || 0);
    }
  }

  return {
    adapterName,
    provider,
    connect: function (): Promise<SqlDriverAdapter> {
      return Promise.resolve({
        ...adapter,

        startTransaction: async function (
          isolationLevel?: IsolationLevel,
        ): Promise<Transaction> {
          if (provider === 'sqlite' && isolationLevel && isolationLevel !== 'SERIALIZABLE') {
            throw new DriverAdapterError({
              kind: 'InvalidIsolationLevel',
              level: isolationLevel,
            })
          }

          const release = await mutex.acquire();
          const options = { usePhantomQuery: false };

          db.exec("BEGIN");

          return {
            ...adapter,
            options,

            commit: async function () {
              release();
              return;
            },
            rollback: async function () {
              release();
              return;
            },
          };
        },
      });
    },
  };
}
