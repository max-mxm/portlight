import { describe, expect, it } from "vitest";
import { activity } from "./test/activity";
import { activityRows, allRows, holdOrder, selectionTotals } from "./activity";

describe("Vue Processus", () => {
  it("filtre ses processus et trie les plus lourds en premier", () => {
    const rows = activityRows(activity(), true, "", "cpu");
    expect(rows.map((r) => r.id)).toEqual([
      "pid:20",
      "app:/Applications/Chrome.app",
    ]);
    const all = activityRows(activity(), false, "", "memory");
    expect(all.map((r) => r.id)).toEqual([
      "app:/Applications/Chrome.app",
      "pid:20",
      "pid:1",
    ]);
  });
  it("trouve une application par l’un de ses processus ou un PID", () => {
    expect(activityRows(activity(), true, "helper", "cpu")[0].id).toBe(
      "app:/Applications/Chrome.app",
    );
    expect(
      activityRows(activity(), false, "20", "cpu").map((r) => r.id),
    ).toEqual(["pid:20"]);
  });
  it("garde l’ordre sous le pointeur, ajoute les nouveaux à la fin", () => {
    expect(holdOrder(["c", "a", "d"], ["a", "b", "c"])).toEqual([
      "a",
      "c",
      "d",
    ]);
  });
  it("totalise ce qu’une sélection libérerait", () => {
    const totals = selectionTotals(
      allRows(activity()),
      new Set(["app:/Applications/Chrome.app", "pid:20"]),
    );
    expect(totals).toEqual({ count: 2, memoryBytes: 850, cpuPercent: 65 });
  });
});
