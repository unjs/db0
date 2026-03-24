import {
  Kysely,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  MysqlAdapter,
  MysqlIntrospector,
  MysqlQueryCompiler,
} from "kysely";

import type {
  Dialect,
  Driver,
  DatabaseConnection,
  DatabaseIntrospector,
  DialectAdapter,
  QueryCompiler,
  TransactionSettings,
  KyselyConfig,
} from "kysely";

import type { Database, SQLDialect } from "db0";
import { DB0Connection } from "./_dialect.ts";

class DB0Driver implements Driver {
  private connection: DB0Connection;

  constructor(private db: Database) {
    this.connection = new DB0Connection(db);
  }

  async init(): Promise<void> {}

  async acquireConnection(): Promise<DatabaseConnection> {
    return this.connection;
  }

  async beginTransaction(): Promise<void> {
    await this.db.exec("BEGIN");
  }

  async commitTransaction(): Promise<void> {
    await this.db.exec("COMMIT");
  }

  async rollbackTransaction(): Promise<void> {
    await this.db.exec("ROLLBACK");
  }

  async releaseConnection(): Promise<void> {}

  async destroy(): Promise<void> {}
}

class DB0Dialect implements Dialect {
  private sqlDialect: SQLDialect;

  constructor(private db: Database) {
    this.sqlDialect = db.dialect;
  }

  createDriver(): Driver {
    return new DB0Driver(this.db);
  }

  createQueryCompiler(): QueryCompiler {
    switch (this.sqlDialect) {
      case "postgresql": {
        return new PostgresQueryCompiler();
      }
      case "mysql": {
        return new MysqlQueryCompiler();
      }
      default: {
        return new SqliteQueryCompiler();
      }
    }
  }

  createAdapter(): DialectAdapter {
    switch (this.sqlDialect) {
      case "postgresql": {
        return new PostgresAdapter();
      }
      case "mysql": {
        return new MysqlAdapter();
      }
      default: {
        return new SqliteAdapter();
      }
    }
  }

  createIntrospector(db: Kysely<any>): DatabaseIntrospector {
    switch (this.sqlDialect) {
      case "postgresql": {
        return new PostgresIntrospector(db);
      }
      case "mysql": {
        return new MysqlIntrospector(db);
      }
      default: {
        return new SqliteIntrospector(db);
      }
    }
  }
}

export type KyselyDatabase<T = any> = Kysely<T>;

export function kysely<T = any>(
  db: Database,
  config?: Omit<KyselyConfig, "dialect">,
): Kysely<T> {
  return new Kysely<T>({
    ...config,
    dialect: new DB0Dialect(db),
  });
}
