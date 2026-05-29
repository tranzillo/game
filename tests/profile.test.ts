import { describe, it, expect } from "vitest";
import {
  defaultProfile,
  makeProfile,
  positionsOf,
  frontRowPositions,
  backRowPositions,
  adjacentSameSide,
  sameRowNeighbors,
  behind,
  column,
  across,
  footprintFitsAt,
} from "../src/engine/profile.ts";
import type { SlotMap } from "../src/engine/types.ts";

const emptySlots = (positions: string[]): SlotMap => ({
  creatures: Object.fromEntries(positions.map((p) => [p, null])),
  structures: { r0c0: null },
  actions: { r0c0: null },
});

describe("defaultProfile", () => {
  it("returns 2x2 creatures + 1x1 structure + 1x1 action", () => {
    const p = defaultProfile();
    expect(p.creatures.rows).toBe(2);
    expect(p.creatures.cols).toBe(2);
    expect(p.creatures.positions.length).toBe(4);
    expect(p.structures.rows).toBe(1);
    expect(p.structures.positions.length).toBe(1);
    expect(p.actions.rows).toBe(1);
    expect(p.actions.positions.length).toBe(1);
  });

  it("creature positions are r0c0, r0c1, r1c0, r1c1 in iteration order", () => {
    const p = defaultProfile();
    expect(p.creatures.positions).toEqual(["r0c0", "r0c1", "r1c0", "r1c1"]);
  });

  it("no locked cells by default", () => {
    const p = defaultProfile();
    expect(p.creatures.locked.size).toBe(0);
    expect(p.structures.locked.size).toBe(0);
    expect(p.actions.locked.size).toBe(0);
  });
});

describe("makeProfile — variant profiles", () => {
  it("builds a 3x3 creature grid", () => {
    const p = makeProfile({ creatures: { rows: 3, cols: 3 } });
    expect(p.creatures.positions.length).toBe(9);
    expect(positionsOf(p, "creature")).toEqual([
      "r0c0",
      "r0c1",
      "r0c2",
      "r1c0",
      "r1c1",
      "r1c2",
      "r2c0",
      "r2c1",
      "r2c2",
    ]);
  });

  it("excludes locked cells from positions but tracks them in `locked`", () => {
    const p = makeProfile({
      creatures: { rows: 2, cols: 2, locked: [{ r: 0, c: 0 }] },
    });
    expect(p.creatures.positions).not.toContain("r0c0");
    expect(p.creatures.positions).toEqual(["r0c1", "r1c0", "r1c1"]);
    expect(p.creatures.locked.has("r0c0")).toBe(true);
    // Coord still resolvable for locked cells (so UI can render the hole)
    expect(p.creatures.coords["r0c0"]).toEqual({ r: 0, c: 0 });
  });

  it("rejects grids outside the 1..3 bounds", () => {
    expect(() => makeProfile({ creatures: { rows: 0, cols: 2 } })).toThrow();
    expect(() => makeProfile({ creatures: { rows: 4, cols: 2 } })).toThrow();
    expect(() => makeProfile({ creatures: { rows: 2, cols: 0 } })).toThrow();
  });
});

describe("front / back row", () => {
  it("on a 2x2 profile, front row = r0c0 + r0c1; back row = r1c0 + r1c1", () => {
    const p = defaultProfile();
    expect(frontRowPositions(p, "creature").sort()).toEqual(["r0c0", "r0c1"]);
    expect(backRowPositions(p, "creature").sort()).toEqual(["r1c0", "r1c1"]);
  });

  it("on a 1-row profile, every slot is both front and back", () => {
    const p = makeProfile({ creatures: { rows: 1, cols: 3 } });
    const positions = positionsOf(p, "creature");
    expect(frontRowPositions(p, "creature")).toEqual(positions);
    expect(backRowPositions(p, "creature")).toEqual(positions);
  });
});

describe("adjacent (Manhattan-1)", () => {
  it("r0c0 in a 2x2 profile is adjacent to r0c1 and r1c0 (not r1c1)", () => {
    const p = defaultProfile();
    const adj = adjacentSameSide(p, "creature", "r0c0").sort();
    expect(adj).toEqual(["r0c1", "r1c0"]);
  });

  it("center of a 3x3 profile has 4 adjacents", () => {
    const p = makeProfile({ creatures: { rows: 3, cols: 3 } });
    const adj = adjacentSameSide(p, "creature", "r1c1").sort();
    expect(adj).toEqual(["r0c1", "r1c0", "r1c2", "r2c1"]);
  });

  it("does not include locked cells as adjacents", () => {
    const p = makeProfile({
      creatures: { rows: 2, cols: 2, locked: [{ r: 0, c: 1 }] },
    });
    expect(adjacentSameSide(p, "creature", "r0c0").sort()).toEqual(["r1c0"]);
  });
});

describe("same row neighbors", () => {
  it("in a 2x2 profile, r0c0's same-row neighbor is r0c1", () => {
    const p = defaultProfile();
    expect(sameRowNeighbors(p, "creature", "r0c0")).toEqual(["r0c1"]);
  });

  it("in a 3-col row, two same-row neighbors", () => {
    const p = makeProfile({ creatures: { rows: 1, cols: 3 } });
    expect(sameRowNeighbors(p, "creature", "r0c1").sort()).toEqual(["r0c0", "r0c2"]);
  });
});

describe("behind", () => {
  it("r0c0's behind on a 2x2 profile is r1c0", () => {
    const p = defaultProfile();
    expect(behind(p, "creature", "r0c0")).toBe("r1c0");
  });

  it("r1c0 (back row) has no behind", () => {
    const p = defaultProfile();
    expect(behind(p, "creature", "r1c0")).toBeNull();
  });

  it("locked back-row cell makes behind null", () => {
    const p = makeProfile({
      creatures: { rows: 2, cols: 2, locked: [{ r: 1, c: 0 }] },
    });
    expect(behind(p, "creature", "r0c0")).toBeNull();
  });
});

describe("column", () => {
  it("column returns positions in column front-to-back", () => {
    const p = makeProfile({ creatures: { rows: 3, cols: 2 } });
    expect(column(p, "creature", "r1c0")).toEqual(["r0c0", "r1c0", "r2c0"]);
  });
});

describe("across (combat targeting)", () => {
  it("returns the front-most occupied enemy position in the same column", () => {
    const p = defaultProfile();
    const enemy: SlotMap = emptySlots(positionsOf(p, "creature"));
    // Enemy at r1c0 (back row); r0c0 empty.
    enemy.creatures["r1c0"] = 42;
    expect(across(p, "creature", "r0c0", enemy)).toBe("r1c0");
  });

  it("returns the front-row enemy when both rows occupied", () => {
    const p = defaultProfile();
    const enemy: SlotMap = emptySlots(positionsOf(p, "creature"));
    enemy.creatures["r0c0"] = 42;
    enemy.creatures["r1c0"] = 43;
    expect(across(p, "creature", "r0c0", enemy)).toBe("r0c0");
  });

  it("returns null when the enemy column is empty", () => {
    const p = defaultProfile();
    const enemy: SlotMap = emptySlots(positionsOf(p, "creature"));
    expect(across(p, "creature", "r0c1", enemy)).toBeNull();
  });
});

describe("footprintFitsAt", () => {
  it("single-slot footprint at empty position returns [anchor]", () => {
    const p = defaultProfile();
    const slots: SlotMap = emptySlots(positionsOf(p, "creature"));
    const result = footprintFitsAt(p, "creature", [{ r: 0, c: 0 }], "r0c0", slots);
    expect(result).toEqual(["r0c0"]);
  });

  it("single-slot footprint at occupied position returns null", () => {
    const p = defaultProfile();
    const slots: SlotMap = emptySlots(positionsOf(p, "creature"));
    slots.creatures["r0c0"] = 42;
    const result = footprintFitsAt(p, "creature", [{ r: 0, c: 0 }], "r0c0", slots);
    expect(result).toBeNull();
  });

  it("row-spanner (2-slot horizontal) fits in front row of 2x2", () => {
    const p = defaultProfile();
    const slots: SlotMap = emptySlots(positionsOf(p, "creature"));
    const result = footprintFitsAt(
      p,
      "creature",
      [
        { r: 0, c: 0 },
        { r: 0, c: 1 },
      ],
      "r0c0",
      slots,
    );
    expect(result).toEqual(["r0c0", "r0c1"]);
  });

  it("row-spanner blocked if one of its cells is occupied", () => {
    const p = defaultProfile();
    const slots: SlotMap = emptySlots(positionsOf(p, "creature"));
    slots.creatures["r0c1"] = 42;
    const result = footprintFitsAt(
      p,
      "creature",
      [
        { r: 0, c: 0 },
        { r: 0, c: 1 },
      ],
      "r0c0",
      slots,
    );
    expect(result).toBeNull();
  });

  it("column-spanner (2-slot vertical) fits left column", () => {
    const p = defaultProfile();
    const slots: SlotMap = emptySlots(positionsOf(p, "creature"));
    const result = footprintFitsAt(
      p,
      "creature",
      [
        { r: 0, c: 0 },
        { r: 1, c: 0 },
      ],
      "r0c0",
      slots,
    );
    expect(result).toEqual(["r0c0", "r1c0"]);
  });

  it("rejects footprints that extend outside the grid", () => {
    const p = defaultProfile();
    const slots: SlotMap = emptySlots(positionsOf(p, "creature"));
    // Anchor r0c1 with offset c:+1 would land at r0c2 — out of bounds.
    const result = footprintFitsAt(
      p,
      "creature",
      [
        { r: 0, c: 0 },
        { r: 0, c: 1 },
      ],
      "r0c1",
      slots,
    );
    expect(result).toBeNull();
  });

  it("rejects footprints that land on locked cells", () => {
    const p = makeProfile({
      creatures: { rows: 2, cols: 2, locked: [{ r: 0, c: 1 }] },
    });
    const slots: SlotMap = emptySlots(positionsOf(p, "creature"));
    const result = footprintFitsAt(
      p,
      "creature",
      [
        { r: 0, c: 0 },
        { r: 0, c: 1 },
      ],
      "r0c0",
      slots,
    );
    expect(result).toBeNull();
  });
});
