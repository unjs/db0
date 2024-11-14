import { vi } from "vitest";
import { Connector } from "../../src";

export const userId = "1001";

export function getCreateDatabaseMock() {
  return {
    createDatabase: vi.fn().mockImplementation((connector: Connector) => {
      return {
        get dialect() {
          return connector.dialect; // Mock the dialect from the connector
        },

        exec: vi.fn().mockImplementation((sql: string) => {
          // Simulate the exec function
          return Promise.resolve(connector.exec(sql));
        }),

        prepare: vi.fn().mockImplementation((sql: string) => {
          // Simulate the prepare function
          return connector.prepare(sql);
        }),

        sql: vi.fn().mockImplementation(async (strings, ..._values) => {
          if (strings.some(query => query.includes("DROP TABLE"))) { // Simulate successful drop table
            return { rows: [] };
          } else if (strings.some(query => query.includes("CREATE TABLE"))) { // Simulate successful table creation
            return { rows: [] };
          } else if (strings.some(query => query.includes("INSERT INTO users"))) { // Simulate successful insert
            return { rows: [] };
          } else if (strings.some(query => query.includes("SELECT * FROM users WHERE id"))) { // Simulate successful select retrieval
            return {
              rows: [{
                id: "1001",
                firstName: "John",
                lastName: "Doe",
                email: "john.doe@example.com",
              }],
            };
          }
          return { rows: [] };
        }),
      };
    }),
  };
}
