import { describe, it, expect } from "vitest";
import { aggregateCodeBuddyQuotas } from "../../src/app/(dashboard)/dashboard/usage/components/ProviderLimits/utils.js";

// Real numbers from a live CodeBuddy CN account (entry 0):
// refill 0/500 + 27 bonus packs 4,500 total, 200 left → combined 200/5000.
const REFILL = { name: "Monthly", used: 500, total: 500, recurring: true, resetAt: "2026-10-31T16:59:59.000Z" };
const BONUS = (used, total) => ({ name: "Bonus", used, total, recurring: false, resetAt: "2026-10-16T00:00:00.000Z" });

describe("aggregateCodeBuddyQuotas — one combined line", () => {
  it("collapses every pack into a single 'Total' row", () => {
    const { quotas } = aggregateCodeBuddyQuotas("codebuddy-cn", [REFILL, BONUS(4300, 4500)]);
    expect(quotas).toHaveLength(1);
    expect(quotas[0].name).toMatch(/Total/);
    expect(quotas[0].total).toBe(5000);
    expect(quotas[0].used).toBe(4800);
  });

  it("labels how many refill + bonus packs were combined", () => {
    const { label } = aggregateCodeBuddyQuotas("codebuddy-cn", [REFILL, BONUS(4300, 4500)]);
    expect(label).toBe("Total · 1 refill + 1 bonus pack");
  });

  it("keeps the soonest reset time as the row's resetAt", () => {
    const { quotas } = aggregateCodeBuddyQuotas("codebuddy-cn", [REFILL, BONUS(4300, 4500)]);
    expect(quotas[0].resetAt).toBe("2026-10-16T00:00:00.000Z");
  });

  it("leaves other providers untouched", () => {
    const rows = [{ name: "x", used: 1, total: 2 }];
    expect(aggregateCodeBuddyQuotas("codex", rows).quotas).toBe(rows);
  });
});
