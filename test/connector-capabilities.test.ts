import { describe, expect, it } from "vitest";
import { connectors, type ConnectorName } from "../src/_connectors";
import { getCapabilities } from "../src/capabilities";
import { connectorCapabilities } from "../scripts/_capabilities-data";

/**
 * `bun-sqlite` statically imports `bun:sqlite`, which cannot be resolved under
 * Node — it is covered by `test/connectors/bun-test.ts` instead.
 */
const NOT_LOADABLE_IN_NODE = new Set(["bun-sqlite", "bun"]);

describe("connector capabilities", () => {
  for (const name of Object.keys(connectors) as ConnectorName[]) {
    it.skipIf(NOT_LOADABLE_IN_NODE.has(name))(name, async () => {
      const specifier = connectors[name].replace(
        "db0/connectors/",
        "../src/connectors/",
      );
      const { default: createConnector } = await import(specifier);

      // Connectors are lazy: building one never touches the underlying driver,
      // so `{}` is enough to read its declared `dialect`/`capabilityOverrides`.
      const connector = createConnector({});

      expect(
        getCapabilities(connector.dialect, connector.capabilityOverrides),
        `${name}: docs table is out of sync with the connector`,
      ).toEqual(connectorCapabilities[name]);
    });
  }

  it("aliases share the same capabilities", () => {
    expect(connectorCapabilities["libsql"]).toEqual(
      connectorCapabilities["libsql-node"],
    );
    expect(connectorCapabilities["bun"]).toEqual(
      connectorCapabilities["bun-sqlite"],
    );
    expect(connectorCapabilities["sqlite"]).toEqual(
      connectorCapabilities["node-sqlite"],
    );
  });
});
