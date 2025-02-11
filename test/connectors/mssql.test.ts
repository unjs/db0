import { describe, it, expect } from "vitest";
import { TYPES } from "tedious";

import { getTediousDataType, prepareSqlParameters } from "../../src/connectors/mssql";
import connector from "../../src/connectors/mssql";
import { testConnector } from "./_tests";

describe.runIf(
  process.env.MSSQL_HOST
  && process.env.MSSQL_DB_NAME
  && process.env.MSSQL_USERNAME
  && process.env.MSSQL_PASSWORD
)(
  "connectors: mssql.test",
  () => {
    testConnector({
      dialect: "mssql",
      connector: connector({
        server: process.env.MSSQL_HOST!,
        authentication: {
          type: 'default',
          options: {
            userName: process.env.MSSQL_USERNAME!,
            password: process.env.MSSQL_PASSWORD!,
          },
        },
        options: {
          database: process.env.MSSQL_DB_NAME!,
          port: Number.parseInt(process.env.MSSQL_PORT || '1433', 10),
          trustServerCertificate: true,
          encrypt: false,
        },
      }),
    });
  },
);

describe("getTediousDataType", () => {
  it("should return NVarChar for null", () => {
    expect(getTediousDataType(null)).toBe(TYPES.NVarChar);
  });
  
  it("should return NVarChar for undefined", () => {
    expect(getTediousDataType(undefined)).toBe(TYPES.NVarChar);
  });
  
  it("should return NVarChar for strings", () => {
    expect(getTediousDataType("test")).toBe(TYPES.NVarChar);
  });
  
  it("should return Int for numbers", () => {
    expect(getTediousDataType(123)).toBe(TYPES.Int);
  });
  
  it("should return BigInt for large integer numbers", () => {
    expect(getTediousDataType(2_147_483_648)).toBe(TYPES.BigInt);
  });
  
  it("should return Float for floating point numbers", () => {
    expect(getTediousDataType(123.45)).toBe(TYPES.Float);
  });
  
  it("should return Bit for boolean values", () => {
    expect(getTediousDataType(true)).toBe(TYPES.Bit);
  });
  
  it("should return DateTime for Date objects", () => {
    expect(getTediousDataType(new Date())).toBe(TYPES.DateTime2);
  });
  
  it("should return VarBinary for Buffer objects", () => {
    expect(getTediousDataType(Buffer.from("test"))).toBe(TYPES.VarBinary);
  });
  
  it("should return NVarChar by default for other types", () => {
    expect(getTediousDataType({})).toBe(TYPES.NVarChar);
  });
});

describe("prepareSqlParameters", () => {
  it("should replace ? with @1, @2, etc.", () => {
    const sql = "SELECT * FROM users WHERE id = ? AND name = ?";
    const parameters = [1, "John"];
    const result = prepareSqlParameters(sql, parameters);
    expect(result.sql).toBe("SELECT * FROM users WHERE id = @1 AND name = @2");
    expect(result.parameters).toEqual({
      "@1": { name: "1", type: TYPES.Int, value: 1 },
      "@2": { name: "2", type: TYPES.NVarChar, value: "John" },
    });
  });
  
  it("should handle no parameters", () => {
    const sql = "SELECT * FROM users";
    const parameters: unknown[] = [];
    const result = prepareSqlParameters(sql, parameters);
    expect(result.sql).toBe("SELECT * FROM users");
    expect(result.parameters).toEqual({});
  });
  
  it("should handle multiple parameters of different types", () => {
    const sql = "SELECT * FROM users WHERE id = ? AND age = ? AND active = ?";
    const parameters = [1, 30, true];
    const result = prepareSqlParameters(sql, parameters);
    expect(result.sql).toBe("SELECT * FROM users WHERE id = @1 AND age = @2 AND active = @3");
    expect(result.parameters).toEqual({
      "@1": { name: "1", type: TYPES.Int, value: 1 },
      "@2": { name: "2", type: TYPES.Int, value: 30 },
      "@3": { name: "3", type: TYPES.Bit, value: true },
    });
  });
  
  it("should handle null and undefined parameters", () => {
    const sql = "SELECT * FROM users WHERE name = ? AND email = ?";
    const parameters = [null, undefined];
    const result = prepareSqlParameters(sql, parameters);
    expect(result.sql).toBe("SELECT * FROM users WHERE name = @1 AND email = @2");
    expect(result.parameters).toEqual({
      "@1": { name: "1", type: TYPES.NVarChar, value: null },
      "@2": { name: "2", type: TYPES.NVarChar, value: undefined },
    });
  });
});