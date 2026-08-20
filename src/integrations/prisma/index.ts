import type { Database } from "../../types.ts";
import type {
  IsolationLevel,
  SqlDriverAdapter,
  SqlDriverAdapterFactory,
  SqlQuery,
  SqlResultSet,
  Transaction,
} from "@prisma/driver-adapter-utils";
import {
  getAffectedRows,
  getProviderFromDialect,
  getQueryArgs,
  toResultSet,
} from "./_utils.ts";

const adapterName = "db0";

/**
 * Structural equivalent of `DriverAdapterError` from
 * `@prisma/driver-adapter-utils`, which detects it by `name` and `cause`.
 * Inlined to keep db0 free of runtime dependencies.
 */
class DriverAdapterError extends Error {
  override name = "DriverAdapterError";
  constructor(cause: object) {
    super("Driver adapter error");
    this.cause = cause;
  }
}

/**
 * Minimal FIFO mutex, used to serialize transactions over the single
 * connection a db0 database wraps.
 */
const createMutex = (): (() => Promise<() => void>) => {
  let last: Promise<void> = Promise.resolve();
  return () => {
    let release!: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    const acquired = last.then(() => release);
    last = last.then(() => next);
    return acquired;
  };
};

/**
 * Creates a Prisma [driver adapter](https://www.prisma.io/docs/orm/overview/databases/database-drivers)
 * backed by a db0 database instance.
 *
 * @param db - The db0 database to run Prisma queries through.
 * @returns A driver adapter factory to pass as `new PrismaClient({ adapter })`.
 */
export function prisma(db: Database): SqlDriverAdapterFactory {
  const acquire = createMutex();
  const provider = getProviderFromDialect(db.dialect);

  const queryable = {
    adapterName,
    provider,

    queryRaw: async (params: SqlQuery): Promise<SqlResultSet> => {
      const rows = await db
        .prepare(params.sql)
        .all(...(getQueryArgs(params, db.dialect) as never[]));
      return toResultSet(rows);
    },

    executeRaw: async (params: SqlQuery): Promise<number> => {
      const res = await db
        .prepare(params.sql)
        .run(...(getQueryArgs(params, db.dialect) as never[]));
      return getAffectedRows(res);
    },
  } satisfies Pick<
    SqlDriverAdapter,
    "adapterName" | "provider" | "queryRaw" | "executeRaw"
  >;

  const adapter: Omit<SqlDriverAdapter, "startTransaction"> = {
    ...queryable,

    executeScript: async (script: string): Promise<void> => {
      await db.exec(script);
    },

    dispose: () => db.dispose(),
  };

  const startTransaction = async (
    isolationLevel?: IsolationLevel,
  ): Promise<Transaction> => {
    if (!db.capabilities.transactions) {
      throw new Error(
        `The \`${db.connector}\` connector does not support transactions.`,
      );
    }

    if (
      provider === "sqlite" &&
      isolationLevel &&
      isolationLevel !== "SERIALIZABLE"
    ) {
      throw new DriverAdapterError({
        kind: "InvalidIsolationLevel",
        level: isolationLevel,
      });
    }

    const release = await acquire();

    try {
      await db.exec("BEGIN");
    } catch (error) {
      release();
      throw error;
    }

    let settled = false;
    // `usePhantomQuery: false` means Prisma issues COMMIT/ROLLBACK itself, so
    // the adapter only has to release the connection once it has.
    const end = () => {
      if (!settled) {
        settled = true;
        release();
      }
      return Promise.resolve();
    };

    return {
      ...queryable,
      options: { usePhantomQuery: false },
      commit: end,
      rollback: end,
    };
  };

  return {
    adapterName,
    provider,
    connect: () => Promise.resolve({ ...adapter, startTransaction }),
  };
}
