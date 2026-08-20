import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { TYPES } from "tedious";

import {
  getTediousDataType,
  prepareSqlParameters,
} from "../../src/connectors/mssql.js";
import connector from "../../src/connectors/mssql.js";
import { testConnector } from "./_tests.js";
import { createDatabase } from "../../src/index.js";

// Helper function to create connection configuration
function createConnectionConfig(database: string = process.env.MSSQL_DB_NAME!) {
  return {
    server: process.env.MSSQL_HOST!,
    authentication: {
      type: "default" as const,
      options: {
        userName: process.env.MSSQL_USERNAME!,
        password: process.env.MSSQL_PASSWORD!,
      },
    },
    options: {
      database,
      port: Number.parseInt(process.env.MSSQL_PORT || "1433", 10),
      trustServerCertificate: true,
      encrypt: false,
    },
  };
}

describe.runIf(
  process.env.MSSQL_HOST &&
    process.env.MSSQL_DB_NAME &&
    process.env.MSSQL_USERNAME &&
    process.env.MSSQL_PASSWORD,
)("connectors: mssql.test", () => {
  testConnector({
    dialect: "mssql",
    connector: connector(createConnectionConfig()),
  });
});

describe.runIf(
  process.env.MSSQL_HOST &&
    process.env.MSSQL_DB_NAME &&
    process.env.MSSQL_USERNAME &&
    process.env.MSSQL_PASSWORD,
)("callProcedure", () => {
  const db = createDatabase(connector(createConnectionConfig()));

  beforeAll(async () => {
    // Drop procedure if it exists
    await db.sql`
      IF OBJECT_ID('dbo.GetUserCount', 'P') IS NOT NULL
        DROP PROCEDURE dbo.GetUserCount
    `;

    // Drop procedure if it exists
    await db.sql`
      IF OBJECT_ID('dbo.AddNumbers', 'P') IS NOT NULL
        DROP PROCEDURE dbo.AddNumbers
    `;

    // Drop procedure if it exists
    await db.sql`
      IF OBJECT_ID('dbo.ProcessUserData', 'P') IS NOT NULL
        DROP PROCEDURE dbo.ProcessUserData
    `;

    // Create a simple stored procedure that returns user count
    await db.sql`
      CREATE PROCEDURE dbo.GetUserCount
        @minAge INT
      AS
      BEGIN
        SELECT COUNT(*) as userCount
        FROM (VALUES (1, 25), (2, 30), (3, 35)) AS Users(id, age)
        WHERE age >= @minAge
      END
    `;

    // Create a stored procedure that adds two numbers
    await db.sql`
      CREATE PROCEDURE dbo.AddNumbers
        @a INT,
        @b INT
      AS
      BEGIN
        SELECT (@a + @b) as result
      END
    `;

    // Create a stored procedure that accepts JSON data
    await db.sql`
      CREATE PROCEDURE dbo.ProcessUserData
        @jsonData NVARCHAR(MAX)
      AS
      BEGIN
        -- Parse JSON and return the data
        SELECT 
          JSON_VALUE(@jsonData, '$.name') as name,
          JSON_VALUE(@jsonData, '$.email') as email,
          JSON_VALUE(@jsonData, '$.age') as age,
          (SELECT * FROM OPENJSON(@jsonData, '$.hobbies') WITH (hobby NVARCHAR(100) '$') FOR JSON PATH) as hobbies
      END
    `;
  });

  afterAll(async () => {
    // Clean up procedures
    await db.sql`
      IF OBJECT_ID('dbo.GetUserCount', 'P') IS NOT NULL
        DROP PROCEDURE dbo.GetUserCount
    `;
    await db.sql`
      IF OBJECT_ID('dbo.AddNumbers', 'P') IS NOT NULL
        DROP PROCEDURE dbo.AddNumbers
    `;
    await db.sql`
      IF OBJECT_ID('dbo.ProcessUserData', 'P') IS NOT NULL
        DROP PROCEDURE dbo.ProcessUserData
    `;
    await db.dispose();
  });

  it("should call a stored procedure with parameters", async () => {
    const stmt = db.prepare("EXEC dbo.GetUserCount @minAge = ?");
    const rows = await stmt.all(30);
    expect(rows).toBeDefined();
    expect(rows.length).toBe(1);
    expect(rows[0]).toHaveProperty("userCount");
    expect((rows[0] as { userCount: number }).userCount).toBe(2);
  });

  it("should call a stored procedure with multiple parameters", async () => {
    const stmt = db.prepare("EXEC dbo.AddNumbers @a = ?, @b = ?");
    const rows = await stmt.all(10, 20);
    expect(rows).toBeDefined();
    expect(rows.length).toBe(1);
    expect(rows[0]).toHaveProperty("result");
    expect((rows[0] as { result: number }).result).toBe(30);
  });

  it("should call a stored procedure using prepare", async () => {
    const stmt = db.prepare("EXEC dbo.AddNumbers @a = ?, @b = ?");
    const rows = await stmt.all(5, 15);
    expect(rows).toBeDefined();
    expect(rows.length).toBe(1);
    expect(rows[0]).toHaveProperty("result");
    expect((rows[0] as { result: number }).result).toBe(20);
  });

  it("should return JSON data using FOR JSON PATH", async () => {
    const stmt = db.prepare(`
      SELECT 
        id, 
        firstName, 
        lastName, 
        email 
      FROM (
        VALUES 
          (1, 'John', 'Doe', 'john@example.com'),
          (2, 'Jane', 'Smith', 'jane@example.com')
      ) AS Users(id, firstName, lastName, email)
      FOR JSON PATH
    `);
    const rows = await stmt.all();
    expect(rows).toBeDefined();
    expect(rows.length).toBeGreaterThan(0);

    // SQL Server returns JSON as a single column result
    // The JSON data is in the first column (usually named "JSON_F52E2B61-18A1-11d1-B105-00805F49916B")
    const jsonColumn = Object.keys(rows[0] as object)[0]!;
    const jsonString = (rows[0] as Record<string, string>)[jsonColumn]!;

    expect(jsonString).toBeDefined();
    const jsonData = JSON.parse(jsonString);
    expect(Array.isArray(jsonData)).toBe(true);
    expect(jsonData.length).toBe(2);
    expect(jsonData[0]).toMatchObject({
      id: 1,
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
    });
    expect(jsonData[1]).toMatchObject({
      id: 2,
      firstName: "Jane",
      lastName: "Smith",
      email: "jane@example.com",
    });
  });

  it("should return JSON data with nested structure using FOR JSON PATH", async () => {
    const stmt = db.prepare(`
      SELECT 
        id, 
        firstName, 
        lastName,
        (
          SELECT email, phone
          FROM (VALUES ('john@example.com', '555-1234')) AS Contact(email, phone)
          FOR JSON PATH
        ) AS contact
      FROM (VALUES (1, 'John', 'Doe')) AS Users(id, firstName, lastName)
      FOR JSON PATH
    `);
    const rows = await stmt.all();
    expect(rows).toBeDefined();

    const jsonColumn = Object.keys(rows[0] as object)[0]!;
    const jsonString = (rows[0] as Record<string, string>)[jsonColumn]!;
    const jsonData = JSON.parse(jsonString);

    expect(Array.isArray(jsonData)).toBe(true);
    expect(jsonData[0]).toHaveProperty("id", 1);
    expect(jsonData[0]).toHaveProperty("firstName", "John");
    expect(jsonData[0]).toHaveProperty("contact");

    // The nested contact is already a JSON string that needs to be parsed
    const contactData = jsonData[0].contact;
    const contact =
      typeof contactData === "string" ? JSON.parse(contactData) : contactData;
    expect(Array.isArray(contact)).toBe(true);
    expect(contact[0]).toMatchObject({
      email: "john@example.com",
      phone: "555-1234",
    });
  });

  it("should return single JSON object using FOR JSON PATH, WITHOUT_ARRAY_WRAPPER", async () => {
    const stmt = db.prepare(`
      SELECT 
        id, 
        firstName, 
        lastName, 
        email,
        age
      FROM (
        VALUES (1, 'John', 'Doe', 'john@example.com', 30)
      ) AS Users(id, firstName, lastName, email, age)
      FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
    `);
    const rows = await stmt.all();
    expect(rows).toBeDefined();
    expect(rows.length).toBeGreaterThan(0);

    // SQL Server returns JSON as a single column result
    const jsonColumn = Object.keys(rows[0] as object)[0]!;
    const jsonString = (rows[0] as Record<string, string>)[jsonColumn]!;

    expect(jsonString).toBeDefined();
    const jsonData = JSON.parse(jsonString);

    // WITHOUT_ARRAY_WRAPPER returns a single object, not an array
    expect(Array.isArray(jsonData)).toBe(false);
    expect(jsonData).toMatchObject({
      id: 1,
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      age: 30,
    });
  });

  it("should call a stored procedure with JSON parameter", async () => {
    const userData = {
      name: "Alice Johnson",
      email: "alice@example.com",
      age: "28",
      hobbies: ["reading", "hiking", "photography"],
    };

    const jsonString = JSON.stringify(userData);
    const stmt = db.prepare("EXEC dbo.ProcessUserData @jsonData = ?");
    const rows = await stmt.all(jsonString);

    expect(rows).toBeDefined();
    expect(rows.length).toBe(1);
    expect(rows[0]).toHaveProperty("name", "Alice Johnson");
    expect(rows[0]).toHaveProperty("email", "alice@example.com");
    expect(rows[0]).toHaveProperty("age", "28");
    expect(rows[0]).toHaveProperty("hobbies");

    // Parse the hobbies JSON array
    const hobbiesData = (rows[0] as Record<string, string>).hobbies;
    if (hobbiesData) {
      const hobbies = JSON.parse(hobbiesData);
      expect(Array.isArray(hobbies)).toBe(true);
      expect(hobbies.length).toBe(3);
      expect(hobbies[0]).toHaveProperty("hobby", "reading");
      expect(hobbies[1]).toHaveProperty("hobby", "hiking");
      expect(hobbies[2]).toHaveProperty("hobby", "photography");
    }
  });

  it("should call a stored procedure with complex JSON parameter", async () => {
    const complexData = {
      name: "Bob Smith",
      email: "bob@example.com",
      age: "35",
      hobbies: ["gaming", "cooking"],
    };

    const jsonString = JSON.stringify(complexData);
    const stmt = db.prepare("EXEC dbo.ProcessUserData @jsonData = ?");
    const rows = await stmt.all(jsonString);

    expect(rows).toBeDefined();
    expect(rows.length).toBe(1);

    const result = rows[0] as Record<string, string>;
    expect(result.name).toBe("Bob Smith");
    expect(result.email).toBe("bob@example.com");
    expect(result.age).toBe("35");

    // Verify hobbies array
    if (result.hobbies) {
      const hobbies = JSON.parse(result.hobbies);
      expect(Array.isArray(hobbies)).toBe(true);
      expect(hobbies.length).toBe(2);
    }
  });
});

describe.runIf(
  process.env.MSSQL_HOST &&
    process.env.MSSQL_USERNAME &&
    process.env.MSSQL_PASSWORD,
)("createDatabase", () => {
  const testDbName = "TestDB_CreateTest";
  let db: ReturnType<typeof createDatabase>;

  beforeAll(() => {
    // Connect to master database to create/drop test database
    db = createDatabase(connector(createConnectionConfig("master")));
  });

  afterAll(async () => {
    // Clean up: drop the test database if it exists
    // try {
    //   await db.exec(`
    //     IF EXISTS (SELECT * FROM sys.databases WHERE name = '${testDbName}')
    //     BEGIN
    //       ALTER DATABASE [${testDbName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    //       DROP DATABASE [${testDbName}];
    //     END
    //   `);
    // } catch (error) {
    //   // Ignore errors if database doesn't exist
    // }
    await db.dispose();
  });

  it("should create a new database", async () => {
    // Drop database if it exists from previous failed test
    try {
      await db.exec(`
        IF EXISTS (SELECT * FROM sys.databases WHERE name = '${testDbName}')
        BEGIN
          ALTER DATABASE [${testDbName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
          DROP DATABASE [${testDbName}];
        END
      `);
    } catch {
      // Ignore errors if database doesn't exist
    }

    // Create the database
    await db.exec(`CREATE DATABASE [${testDbName}]`);

    // Verify the database exists
    const stmt = db.prepare("SELECT name FROM sys.databases WHERE name = ?");
    const rows = await stmt.all(testDbName);
    expect(rows).toBeDefined();
    expect(rows.length).toBe(1);
    expect((rows[0] as { name: string }).name).toBe(testDbName);
  });

  it("should check if database exists", async () => {
    const stmt = db.prepare(`
      SELECT CASE 
        WHEN EXISTS (SELECT * FROM sys.databases WHERE name = ?)
        THEN 1
        ELSE 0
      END as dbExists
    `);
    const rows = await stmt.all(testDbName);
    expect(rows).toBeDefined();
    expect(rows.length).toBe(1);
    expect((rows[0] as { dbExists: number }).dbExists).toBe(1);
  });

  it.skip("should drop an existing database", async () => {
    // Drop the database
    await db.exec(`
      ALTER DATABASE [${testDbName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
      DROP DATABASE [${testDbName}];
    `);

    // Verify the database no longer exists
    const stmt = db.prepare("SELECT name FROM sys.databases WHERE name = ?");
    const rows = await stmt.all(testDbName);
    expect(rows).toBeDefined();
    expect(rows.length).toBe(0);
  });
});

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
    expect(result.sql).toBe(
      "SELECT * FROM users WHERE id = @1 AND age = @2 AND active = @3",
    );
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
    expect(result.sql).toBe(
      "SELECT * FROM users WHERE name = @1 AND email = @2",
    );
    expect(result.parameters).toEqual({
      "@1": { name: "1", type: TYPES.NVarChar, value: null },
      "@2": { name: "2", type: TYPES.NVarChar, value: undefined },
    });
  });
});

// Error Handling Tests
describe.runIf(
  process.env.MSSQL_HOST &&
    process.env.MSSQL_DB_NAME &&
    process.env.MSSQL_USERNAME &&
    process.env.MSSQL_PASSWORD,
)("error handling", () => {
  const db = createDatabase(connector(createConnectionConfig()));

  afterAll(async () => {
    await db.dispose();
  });

  it("should handle invalid SQL syntax", async () => {
    await expect(async () => {
      await db.exec("SELECT * FORM invalid_table");
    }).rejects.toThrow();
  });

  it("should handle non-existent table", async () => {
    await expect(async () => {
      await db.sql`SELECT * FROM non_existent_table_12345`;
    }).rejects.toThrow();
  });

  it("should handle parameter count mismatch", async () => {
    const stmt = db.prepare(
      "INSERT INTO sys.tables (name, object_id) VALUES (?, ?)",
    );
    // Providing only one parameter when two are expected - should fail
    await expect(async () => {
      await stmt.all("test");
    }).rejects.toThrow();
  });

  it("should handle empty SQL query", async () => {
    await expect(async () => {
      await db.exec("");
    }).rejects.toThrow("SQL query must be provided");
  });

  it("should provide error context with SQL and parameters", async () => {
    try {
      const stmt = db.prepare("SELECT * FROM invalid_table WHERE id = ?");
      await stmt.all(123);
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error.sql).toBeDefined();
      expect(error.parameters).toBeDefined();
    }
  });

  it("should handle type conversion errors gracefully", async () => {
    // Test that tedious converts string numbers to integers automatically
    const stmt = db.prepare("SELECT CAST(? AS INT) as result");
    const rows = await stmt.all("42");
    expect(rows.length).toBe(1);
    expect((rows[0] as any).result).toBe(42);
  });
});

// Transaction Tests
describe.runIf(
  process.env.MSSQL_HOST &&
    process.env.MSSQL_DB_NAME &&
    process.env.MSSQL_USERNAME &&
    process.env.MSSQL_PASSWORD,
)("transactions", () => {
  const db = createDatabase(connector(createConnectionConfig()));

  beforeAll(async () => {
    await db.exec(`
      IF OBJECT_ID('dbo.test_transactions', 'U') IS NOT NULL
        DROP TABLE dbo.test_transactions;
      CREATE TABLE dbo.test_transactions (
        id INT PRIMARY KEY,
        value NVARCHAR(100)
      );
    `);
  });

  afterAll(async () => {
    await db.exec("DROP TABLE IF EXISTS dbo.test_transactions");
    await db.dispose();
  });

  it("should commit a transaction successfully", async () => {
    // Use single connection for transaction operations
    await db.exec(`
      BEGIN TRANSACTION;
      INSERT INTO dbo.test_transactions (id, value) VALUES (1, 'test1');
      COMMIT TRANSACTION;
    `);

    const stmt = db.prepare("SELECT * FROM dbo.test_transactions WHERE id = ?");
    const rows = await stmt.all(1);
    expect(rows.length).toBe(1);
    expect((rows[0] as any).value).toBe("test1");
  });

  it("should rollback a transaction", async () => {
    // Use single connection for transaction operations
    await db.exec(`
      BEGIN TRANSACTION;
      INSERT INTO dbo.test_transactions (id, value) VALUES (2, 'test2');
      ROLLBACK TRANSACTION;
    `);

    const stmt = db.prepare("SELECT * FROM dbo.test_transactions WHERE id = ?");
    const rows = await stmt.all(2);
    expect(rows.length).toBe(0);
  });

  it("should handle nested transactions with savepoints", async () => {
    await db.exec(`
      BEGIN TRANSACTION;
      INSERT INTO dbo.test_transactions (id, value) VALUES (3, 'outer');
      SAVE TRANSACTION savepoint1;
      INSERT INTO dbo.test_transactions (id, value) VALUES (4, 'inner');
      ROLLBACK TRANSACTION savepoint1;
      COMMIT TRANSACTION;
    `);

    const stmt = db.prepare(
      "SELECT * FROM dbo.test_transactions WHERE id IN (?, ?)",
    );
    const rows = await stmt.all(3, 4);

    expect(rows.length).toBe(1);
    expect((rows[0] as any).id).toBe(3);
  });

  it("should handle transaction isolation levels", async () => {
    await db.exec(`
      SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
      BEGIN TRANSACTION;
      INSERT INTO dbo.test_transactions (id, value) VALUES (5, 'isolation_test');
      COMMIT TRANSACTION;
    `);

    const stmt = db.prepare("SELECT * FROM dbo.test_transactions WHERE id = ?");
    const rows = await stmt.all(5);
    expect(rows.length).toBe(1);
  });
});

// Batch Operations and Advanced Tests
describe.runIf(
  process.env.MSSQL_HOST &&
    process.env.MSSQL_DB_NAME &&
    process.env.MSSQL_USERNAME &&
    process.env.MSSQL_PASSWORD,
)("batch operations", () => {
  const db = createDatabase(connector(createConnectionConfig()));

  beforeAll(async () => {
    await db.exec(`
      IF OBJECT_ID('dbo.test_batch', 'U') IS NOT NULL
        DROP TABLE dbo.test_batch;
      CREATE TABLE dbo.test_batch (
        id INT PRIMARY KEY,
        name NVARCHAR(100),
        data VARBINARY(MAX)
      );

      IF OBJECT_ID('dbo.GetUserWithOutput', 'P') IS NOT NULL
        DROP PROCEDURE dbo.GetUserWithOutput;
    `);

    await db.exec(`
      CREATE PROCEDURE dbo.GetUserWithOutput
        @userId INT,
        @userName NVARCHAR(100) OUTPUT
      AS
      BEGIN
        SET @userName = 'User_' + CAST(@userId AS NVARCHAR);
        SELECT @userId as id, @userName as name;
      END
    `);
  });

  afterAll(async () => {
    await db.exec("DROP TABLE IF EXISTS dbo.test_batch");
    await db.exec("DROP PROCEDURE IF EXISTS dbo.GetUserWithOutput");
    await db.dispose();
  });

  it("should handle multiple inserts in batch", async () => {
    const stmt = db.prepare(
      "INSERT INTO dbo.test_batch (id, name) VALUES (?, ?)",
    );

    await stmt.run(1, "Alice");
    await stmt.run(2, "Bob");
    await stmt.run(3, "Charlie");

    const selectStmt = db.prepare(
      "SELECT COUNT(*) as count FROM dbo.test_batch",
    );
    const rows = await selectStmt.all();
    expect((rows[0] as any).count).toBe(3);
  });

  it("should handle binary data (BLOB)", async () => {
    const binaryData = Buffer.from("Hello, World!", "utf8");
    const stmt = db.prepare(
      "INSERT INTO dbo.test_batch (id, name, data) VALUES (?, ?, ?);",
    );
    await stmt.run(10, "binary_test", binaryData as any);

    const selectStmt = db.prepare("SELECT * FROM dbo.test_batch WHERE id = ?");
    const rows = await selectStmt.all(10);
    expect(rows.length).toBe(1);
    expect(Buffer.isBuffer((rows[0] as any).data)).toBe(true);
    expect((rows[0] as any).data.toString("utf8")).toBe("Hello, World!");
  });

  it("should handle special characters in parameters", async () => {
    const specialText =
      "Test with 'quotes', \"double quotes\", and\nnewlines\ttabs";
    const stmt = db.prepare(
      "INSERT INTO dbo.test_batch (id, name) VALUES (?, ?)",
    );
    await stmt.run(20, specialText);

    const selectStmt = db.prepare("SELECT * FROM dbo.test_batch WHERE id = ?");
    const rows = await selectStmt.all(20);
    expect((rows[0] as any).name).toBe(specialText);
  });

  it("should handle unicode characters", async () => {
    const unicodeText = "Hello 世界 🌍 مرحبا";
    const stmt = db.prepare(
      "INSERT INTO dbo.test_batch (id, name) VALUES (?, ?)",
    );
    await stmt.run(30, unicodeText);

    const selectStmt = db.prepare("SELECT * FROM dbo.test_batch WHERE id = ?");
    const rows = await selectStmt.all(30);
    expect((rows[0] as any).name).toBe(unicodeText);
  });

  it("should handle stored procedure with output parameters", async () => {
    // Note: Current implementation doesn't support OUTPUT parameters directly
    // This test calls the procedure and gets result set instead (returns 2 rows)
    const stmt = db.prepare(
      "DECLARE @name NVARCHAR(100); EXEC dbo.GetUserWithOutput @userId = ?, @userName = @name OUTPUT; SELECT @name as userName",
    );
    const rows = await stmt.all(42);
    // Procedure returns result set + our SELECT statement = 2 rows
    expect(rows.length).toBeGreaterThanOrEqual(1);
    // Check the last row for our output
    const lastRow = rows.at(-1);
    expect((lastRow as any).userName).toBe("User_42");
  });

  it("should handle empty result sets", async () => {
    const stmt = db.prepare("SELECT * FROM dbo.test_batch WHERE id = ?");
    const rows = await stmt.all(99_999);
    expect(rows.length).toBe(0);
  });

  it("should handle NULL values correctly", async () => {
    const stmt = db.prepare(
      "INSERT INTO dbo.test_batch (id, name) VALUES (?, ?)",
    );

    await stmt.run(40, null);

    const selectStmt = db.prepare("SELECT * FROM dbo.test_batch WHERE id = ?");
    const rows = await selectStmt.all(40);
    expect(rows.length).toBe(1);
    expect((rows[0] as any).name).toBeNull();
  });
});

// Performance Tests
describe.runIf(
  process.env.MSSQL_HOST &&
    process.env.MSSQL_DB_NAME &&
    process.env.MSSQL_USERNAME &&
    process.env.MSSQL_PASSWORD,
)("performance", () => {
  const db = createDatabase(connector(createConnectionConfig()));

  beforeAll(async () => {
    await db.exec(`
      IF OBJECT_ID('dbo.test_performance', 'U') IS NOT NULL
        DROP TABLE dbo.test_performance;
      CREATE TABLE dbo.test_performance (
        id INT PRIMARY KEY,
        data NVARCHAR(1000)
      );
    `);
  });

  afterAll(async () => {
    await db.exec("DROP TABLE IF EXISTS dbo.test_performance");
    await db.dispose();
  });

  it("should handle multiple sequential queries efficiently", async () => {
    const start = Date.now();
    const stmt = db.prepare("SELECT ?");

    for (let i = 0; i < 10; i++) {
      await stmt.all(i);
    }

    const duration = Date.now() - start;
    // Should complete 10 queries in reasonable time (less than 5 seconds)
    expect(duration).toBeLessThan(5000);
  });

  it("should handle large result sets", async () => {
    // Insert 100 rows
    const insertStmt = db.prepare(
      "INSERT INTO dbo.test_performance (id, data) VALUES (?, ?)",
    );
    for (let i = 1; i <= 100; i++) {
      await insertStmt.run(i, `Data for row ${i}`);
    }

    const start = Date.now();
    const selectStmt = db.prepare("SELECT * FROM dbo.test_performance");
    const rows = await selectStmt.all();
    const duration = Date.now() - start;

    expect(rows.length).toBe(100);
    // Should fetch 100 rows in reasonable time (less than 2 seconds)
    expect(duration).toBeLessThan(2000);
  });

  it("should handle prepared statement reuse", async () => {
    const stmt = db.prepare("SELECT * FROM dbo.test_performance WHERE id = ?");

    const start = Date.now();
    for (let i = 1; i <= 20; i++) {
      await stmt.all(i);
    }
    const duration = Date.now() - start;

    // Reusing prepared statement should be efficient (less than 3 seconds)
    expect(duration).toBeLessThan(3000);
  });

  it("should handle concurrent query execution", async () => {
    const stmt = db.prepare("SELECT ?");

    const start = Date.now();
    // Note: Current implementation may execute these sequentially due to connection management
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(stmt.all(i));
    }
    await Promise.all(promises);
    const duration = Date.now() - start;

    // Should handle 5 queries efficiently
    expect(duration).toBeLessThan(5000);
  });

  it("should handle large text data", async () => {
    const largeText = "a".repeat(900); // Just under 1000 char limit
    const stmt = db.prepare(
      "INSERT INTO dbo.test_performance (id, data) VALUES (?, ?)",
    );

    const start = Date.now();
    await stmt.run(1000, largeText);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(2000);

    const selectStmt = db.prepare(
      "SELECT * FROM dbo.test_performance WHERE id = ?",
    );
    const rows = await selectStmt.all(1000);
    expect((rows[0] as any).data).toBe(largeText);
  });

  it("should handle query timeout scenarios", async () => {
    // Test a long-running query
    const stmt = db.prepare("WAITFOR DELAY '00:00:01'; SELECT 1 as result");

    const start = Date.now();
    const rows = await stmt.all();
    const duration = Date.now() - start;

    expect(rows.length).toBe(1);
    expect(duration).toBeGreaterThanOrEqual(1000);
    expect(duration).toBeLessThan(3000);
  });
});
