import { describe, expect, it } from "vitest";
import { buildShowdownIdMap, fromShowdownId, toShowdownId } from "../showdown-id";

describe("toShowdownId", () => {
  it("strips dashes", () => {
    expect(toShowdownId("fire-blast")).toBe("fireblast");
  });

  it("lowercases", () => {
    expect(toShowdownId("Fire-Blast")).toBe("fireblast");
  });

  it("handles ids without dashes", () => {
    expect(toShowdownId("psychic")).toBe("psychic");
  });

  it("handles nidoran-f and nidoran-m without collision", () => {
    expect(toShowdownId("nidoran-f")).toBe("nidoranf");
    expect(toShowdownId("nidoran-m")).toBe("nidoranm");
  });

  it("handles mr-mime", () => {
    expect(toShowdownId("mr-mime")).toBe("mrmime");
  });

  it("handles farfetch-d", () => {
    expect(toShowdownId("farfetch-d")).toBe("farfetchd");
  });
});

describe("fromShowdownId", () => {
  it("retrieves kebab id from compressed", () => {
    const map = buildShowdownIdMap(["fire-blast", "hydro-pump", "psychic"]);
    expect(fromShowdownId("fireblast", map)).toBe("fire-blast");
    expect(fromShowdownId("hydropump", map)).toBe("hydro-pump");
    expect(fromShowdownId("psychic", map)).toBe("psychic");
  });

  it("returns undefined for unknown compressed id", () => {
    const map = buildShowdownIdMap(["fire-blast"]);
    expect(fromShowdownId("waterpulse", map)).toBeUndefined();
  });

  it("is case-insensitive on lookup", () => {
    const map = buildShowdownIdMap(["fire-blast"]);
    expect(fromShowdownId("FireBlast", map)).toBe("fire-blast");
  });

  it("handles nidoran-f / nidoran-m distinct lookups", () => {
    const map = buildShowdownIdMap(["nidoran-f", "nidoran-m"]);
    expect(fromShowdownId("nidoranf", map)).toBe("nidoran-f");
    expect(fromShowdownId("nidoranm", map)).toBe("nidoran-m");
  });
});
