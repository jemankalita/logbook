import { describe, expect, it } from "vitest";
import { weekday } from "./dates";
import { weekGrid } from "./time";

describe("weekGrid", () => {
  it("returns whole weeks that start on a Monday and include the given day", () => {
    const grid = weekGrid("2026-11-18", 5); // a Wednesday
    expect(grid).toHaveLength(35);
    expect(grid[0]).toBe("2026-10-19");
    expect(weekday(grid[0])).toBe(1); // Monday
    expect(grid.at(-1)).toBe("2026-11-22"); // the Sunday of that week
    expect(grid).toContain("2026-11-18");
  });

  it("works when the day itself is a Monday or a Sunday", () => {
    expect(weekGrid("2026-11-16", 1)).toEqual(["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22"]);
    expect(weekGrid("2026-11-22", 1)[0]).toBe("2026-11-16");
  });

  it("crosses month and year boundaries with consecutive days", () => {
    const grid = weekGrid("2027-01-01", 2);
    for (let i = 1; i < grid.length; i++) {
      expect(new Date(`${grid[i]}T00:00:00Z`).getTime() - new Date(`${grid[i - 1]}T00:00:00Z`).getTime()).toBe(86_400_000);
    }
    expect(grid[0]).toBe("2026-12-21");
  });
});
