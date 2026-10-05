/**
 * CodeBuddy CN request-meter exhaustion.
 *
 * An account is rate-limited only once its COMBINED usable quota is empty:
 * refill (CycleCapacity*) remaining + every bonus pack (Capacity*) remaining,
 * summed across ALL packs. A drained refill pack does NOT exhaust the account
 * while gifted bonus requests remain — that is the normal state for these
 * accounts (the 500-request refill runs out long before the ~4,500 gifted).
 * Guards the field rule + the >2d cycle/expiry gap that classifies a refill
 * pack, and feeds the cache module carried into auth.js.
 */
import { describe, it, expect } from "vitest";
import { isCodeBuddyQuotaExhausted } from "../../open-sse/services/usage/codebuddy-cn.js";

// ms timestamps: bonus packs have CycleEndTime == DeductionEndTime (gap 0);
// refill packs roll over ~30d before the resource expires (gap >> 2d).
const CYCLE_END = "2026-10-31 23:59:59";
const REFILL = (size, remain) => ({
  CycleCapacitySizePrecise: String(size),
  CycleCapacityRemainPrecise: String(remain),
  CycleEndTime: CYCLE_END,
  DeductionEndTime: String(new Date("2027-12-31T00:00:00Z").getTime()),
});
const BONUS = (size, used) => ({
  CapacitySizePrecise: String(size),
  CapacityUsedPrecise: String(used),
  CycleEndTime: CYCLE_END,
  DeductionEndTime: String(new Date(CYCLE_END.replace(" ", "T") + "Z").getTime()),
});

describe("isCodeBuddyQuotaExhausted", () => {
  it("is exhausted only when refill AND all bonus packs are empty", () => {
    expect(isCodeBuddyQuotaExhausted([REFILL(500, 0), BONUS(4500, 4500)])).toBe(true);
  });

  it("stays usable while bonus requests remain (refill drained)", () => {
    // Real entry-0 shape: refill 0/500 but 200 gifted requests left.
    expect(isCodeBuddyQuotaExhausted([REFILL(500, 0), BONUS(4500, 4300)])).toBe(false);
  });

  it("stays usable while the refill pack has credit (bonus drained)", () => {
    expect(isCodeBuddyQuotaExhausted([REFILL(500, 500), BONUS(4500, 4500)])).toBe(false);
  });

  it("sums multiple bonus packs", () => {
    expect(isCodeBuddyQuotaExhausted([REFILL(500, 0), BONUS(100, 100), BONUS(100, 99)])).toBe(false);
    expect(isCodeBuddyQuotaExhausted([REFILL(500, 0), BONUS(100, 100), BONUS(100, 100)])).toBe(true);
  });

  it("does not flag an empty/unknown payload (won't poison the cache)", () => {
    expect(isCodeBuddyQuotaExhausted([])).toBe(false);
    expect(isCodeBuddyQuotaExhausted(null)).toBe(false);
    expect(isCodeBuddyQuotaExhausted([{ Foo: 1 }])).toBe(false);
  });

  it("ignores packs with no size", () => {
    expect(isCodeBuddyQuotaExhausted([{ CycleCapacitySizePrecise: "0", CycleCapacityRemainPrecise: "0" }])).toBe(false);
  });
});
