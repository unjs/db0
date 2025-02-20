import type { Primitive, Statement, PreparedStatement } from "../../types";

export abstract class BoundableStatement<T> implements Statement {
  _rawStmt: T;

  constructor(rawStmt: T) {
    this._rawStmt = rawStmt;
  }

  bind(...params: Primitive[]): PreparedStatement {
    return new BoundStatement(this, params);
  }

  abstract all(...params: Primitive[]): Promise<unknown[]>;

  abstract run(...params: Primitive[]): Promise<{ success: boolean }>;

  abstract get(...params: Primitive[]): Promise<unknown>;
}

class BoundStatement<S extends Statement> implements PreparedStatement {
  #statement: S;
  #params: Primitive[];

  constructor(statement: S, params: Primitive[]) {
    this.#statement = statement;
    this.#params = params;
  }

  bind(...params: Primitive[]): BoundStatement<S> {
    return new BoundStatement(this.#statement, params);
  }

  all(): Promise<unknown[]> {
    return this.#statement.all(...this.#params);
  }

  run(): Promise<{ success: boolean }> {
    return this.#statement.run(...this.#params);
  }

  get(): Promise<unknown> {
    return this.#statement.get(...this.#params);
  }
}
