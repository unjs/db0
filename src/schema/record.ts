import { DBTable } from "./table";
import { SchemaBaseType } from "./schema";

export class DBRecord<T extends SchemaBaseType = SchemaBaseType> {
  private _table: DBTable<T>;
  private _id: string | number | undefined;
  private _value: T | undefined;

  constructor(table: DBTable<T>, id?: string | number, value?: T) {
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

  async load() {
    if (!this._id) {
      return;
    }
    await this._table._ensureTable();
    const res = await this._table.db.sql`
      SELECT * FROM {${this._table.name}} WHERE id = ${this._id}
    `;
    if (res.rows?.length === 1) {
      this._value = res.rows[0] as any;
    }
    return this;
  }

  async save() {
    await this._table._ensureTable();
    if (this._id) {
      await this._table.db.sql`
        UPDATE {${this._table.name}}
        SET ${Object.entries(this._value)
          .map(([key, value]) => `${key}=${value}`)
          .join(", ")}
        WHERE id = ${this._id}
      `;
    } else {
      const res = await this._table.db.sql`
        INSERT INTO {${this._table.name}}
        ({${Object.keys(this._value).join(",")}})
        VALUES (${Object.values(this._value).join(",")})
      `;
      this._id = res.lastInsertRowid;
    }

    return this;
  }

  async delete() {
    if (!this._id) {
      return;
    }
    await this._table._ensureTable();
    await this._table.db.sql`
      DELETE FROM {${this._table.name}} WHERE id = ${this._id}
    `;
    return this;
  }

  toJSON(): T & { $id: string } {
    return {
      id: this._id as string,
      ...(this._value as any),
    };
  }
}
