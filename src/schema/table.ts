import { Database } from "../types";
import { DBRecord } from "./record";
import { JSONSchema, Schema, SchemaBaseType } from "./schema";

export class DBTable<T extends SchemaBaseType = SchemaBaseType> {
  db: Database;
  name: string;
  schema: Schema<T>;

  _records: Record<string, DBRecord<T>> = {};
  _dbInitialized = false;

  constructor(db: Database, name: string, schema: Schema<T>) {
    this.db = db;
    this.name = name;
    this.schema = schema || {};
  }

  jsonSchema(): JSONSchema {
    if (this.schema?.jsonSchema) {
      return this.schema.jsonSchema();
    }
    return <JSONSchema>{
      $schema: "http://json-schema.org/draft-07/schema#",
      additionalProperties: true,
      type: "object",
    };
  }

  _get(id: string | number): DBRecord<T> {
    if (!this._records[id]) {
      this._records[id] = new DBRecord<T>(this, id);
    }
    return this._records[id];
  }

  async _ensureTable() {
    if (this._dbInitialized) {
      return;
    }
    this._dbInitialized = true;
    await this.db.exec(
      `CREATE table if not exists ${this.name} (id integer primary key autoincrement, title TEXT)`,
    );
  }

  create(value: T & { id?: string | number }): DBRecord<T> {
    const record = this._get(value.$id);
    // @ts-ignore
    record._value = value;
    return record;
  }

  insert(value: T & { id?: string | number }): Promise<DBRecord<T>> {
    const record = this.create(value);
    return record.save();
  }

  insertMany(items: (T & { id?: string | number })[]): Promise<DBRecord<T>[]> {
    // TODO: leverage INSERT INTO with VALUES
    return Promise.all(items.map((item) => this.insert(item)));
  }

  async findById(id: string | number): Promise<DBRecord<T> | undefined> {
    const record = await this._get(id).load();
    if (!record.value) {
      return undefined;
    }
    return record;
  }

  async findAll(): Promise<DBRecord<T>[]> {
    await this._ensureTable();
    const rawRecords = await this.db.sql`SELECT * FROM {${this.name}}`;

    const records = rawRecords.rows.map((rawRecord) => {
      const record = this._get(rawRecord.id);
      // @ts-ignore
      record._value = rawRecord as any;
      return record;
    });

    await Promise.all(records.map((record) => record.load()));

    return records;
  }
}
