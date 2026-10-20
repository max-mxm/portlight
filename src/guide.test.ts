import { describe, expect, it } from "vitest";
import {
  ageShare,
  blockStart,
  clockLabel,
  guideHours,
  guideTicks,
  thresholdAt,
} from "./guide";

describe("programme guide", () => {
  it("shows the review threshold plus a quarter", () => {
    expect(guideHours(8)).toBe(10);
    expect(guideHours(24)).toBe(30);
    expect(guideHours(1)).toBe(2);
  });
  it("places blocks on one time scale and clips the older ones", () => {
    expect(blockStart(5 * 3600, 10)).toEqual({ start: 0.5, clipped: false });
    expect(blockStart(0, 10)).toEqual({ start: 1, clipped: false });
    expect(blockStart(40 * 3600, 10)).toEqual({ start: 0, clipped: true });
    expect(thresholdAt(8, 10)).toBeCloseTo(0.2);
  });
  it("fills the age meter up to the threshold", () => {
    expect(ageShare(4 * 3600, 8)).toBe(0.5);
    expect(ageShare(20 * 3600, 8)).toBe(1);
  });
  it("puts ticks on round local hours", () => {
    const now = new Date(2026, 9, 19, 19, 24).getTime();
    const ticks = guideTicks(now, 10);
    expect(ticks.map((t) => new Date(t.at).getHours())).toEqual([
      10, 12, 14, 16, 18,
    ]);
    for (const t of ticks) expect(t.x).toBeGreaterThan(0);
    expect(ticks.at(-1)!.x).toBeLessThan(1);
  });
  it("names another day", () => {
    const now = new Date(2026, 9, 19, 19, 24).getTime();
    expect(
      clockLabel(new Date(2026, 9, 19, 9, 12).getTime(), now, "fr-FR"),
    ).toBe("09:12");
    expect(
      clockLabel(new Date(2026, 9, 16, 3, 10).getTime(), now, "en-US"),
    ).toBe("Fri 03:10 AM");
  });
});
