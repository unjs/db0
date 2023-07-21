import { DBTable } from "./table";
import { SchemaBaseType } from "./schema";

export class DBRecord<T extends SchemaBaseType = SchemaBaseType> {
  private _table: DBTable<T>;
  private _id: string | undefined;
  private _value: T | undefined;

  constructor(table: DBTable<T>, id?: string, value?: T) {
    this._table = table;
    this._id = id;
    this._value = value;
  }

  get id() {
    return this._id;
  }

  get value() {
    return this._value as T;
  }

  setValue(value: T) {
    this._value = value;
  }

  async load() {
    await this._table._ensureTable();
    const value = await this._table.db.exec(
      `SELECT * FROM ${this._table.name} WHERE id = ${this._id}`,
    );
    this.setValue(value.rows[0] as any);
    return this;
  }

  async save() {
    await this._table._ensureTable();
    if (this._id) {
      const updatesSQL = Object.entries(this._value)
        .map(([key, value]) => `${key}=${value}`)
        .join(", ");
      await this._table.db.exec(
        `UPDATE ${this._table.name} SET ${updatesSQL} WHERE id = ${this._id}`,
      );
    } else {
      /*
      INSERT INTO Customers (CustomerName, City, Country)
      VALUES ('Cardinal', 'Stavanger', 'Norway');
      */
      const res = (await this._table.db
        .prepare(
          `INSERT INTO ${this._table.name} (${Object.keys(this._value).join(
            ",",
          )}) VALUES (${Object.values(this._value)
            .map(() => "?")
            .join(",")})`,
        )
        .run(...Object.values(this._value))) as unknown as {
        lastInsertRowid: number;
      };
      this._id = String(res.lastInsertRowid);
    }

    return this;
  }

  async delete() {
    await this._table._ensureTable();
    await this._table.db.exec(
      `DELETE FROM ${this._table.name} WHERE id = ${this._id}`,
    );
    return this;
  }

  toJSON(): T & { $id: string } {
    return {
      $id: this._id as string,
      ...(this._value as any),
    };
  }
}
