/**
 * CodeBuddy CN usage handler
 *
 * Scoped to the "codebuddy-cn" provider specifically — a future "codebuddy-intl"
 * variant would get its own handler/endpoint, so keep this CN-only.
 *
 * Quota lives behind a Tencent billing endpoint (POST, payload wrapped twice
 * under data.Response.Data). It mixes two credit types that must NOT be merged:
 *
 *  - Refill / base ("基础体验包"): a recurring allowance whose cycle resets long
 *    before the resource itself expires (CycleEndTime << DeductionEndTime). The
 *    live numbers live in the *Cycle* fields (e.g. CycleCapacityUsed 6.54 / 500)
 *    and resetAt is the next monthly refresh.
 *  - Bonus ("活动赠送包"): one-shot credits that run a single cycle and then
 *    expire for good (CycleEndTime == DeductionEndTime). Numbers live in the
 *    plain Capacity fields.
 *
 * We surface one quota row per package — a cadence label (Monthly/Weekly/Daily)
 * for refill packs, "Bonus Pack N" for bonus packs (soonest-expiring first).
 *
 * The account is considered rate-limited only once its COMBINED usable quota
 * (refill remaining + all bonus remaining) is empty — see isCodeBuddyQuotaExhausted.
 */

import { proxyAwareFetch } from "../../utils/proxyFetch.js";
import { PROVIDERS } from "../../providers/index.js";
import { U, parseResetTime } from "./shared.js";

const PROVIDER_ID = "codebuddy-cn";

// Prefer the *Precise string fields (exact), fall back to the numeric ones.
function num(precise, plain) {
  const n = Number(precise ?? plain);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Is a CodeBuddy account's *usable* request quota exhausted?
 *
 * CodeBuddy reports usable credit across two kinds of packs:
 *  - Refill/base ("体验版"): recurring allowance, live numbers in the
 *    CycleCapacity* fields.
 *  - Bonus ("运营裂变包" etc.): one-shot gift credits, numbers in the plain
 *    Capacity* fields.
 *
 * Upstream only starts answering rate-limited once the account has NOTHING
 * left to spend across *all* its packs — so exhaustion means the combined
 * remaining (refill remain + sum of bonus remaining) is <= 0, NOT that any one
 * pack hit zero. A fresh refill pack keeps the account alive even with an empty
 * bonus balance, and leftover bonus credits keep it alive even after the refill
 * pack drains (which is the common case: the 500-request refill runs out long
 * before the ~4,500 gifted requests do).
 *
 * Unknown/missing sizes contribute nothing and must NOT force exhaustion (an
 * empty/unknown payload would otherwise poison the router cache).
 *
 * @param {Array<Object>} accounts - data.Response.Data.Accounts[]
 * @returns {boolean}
 */
export function isCodeBuddyQuotaExhausted(accounts) {
  if (!Array.isArray(accounts) || accounts.length === 0) return false;

  const cycleEndMs = (acc) => {
    const r = parseResetTime(acc.CycleEndTime);
    return r ? new Date(r).getTime() : Number.POSITIVE_INFINITY;
  };
  // Refill packs roll into a new cycle well before the resource expires; bonus
  // packs end exactly at expiry. >2d gap between cycle end and validity end = refill.
  const REFILL_GAP_MS = 2 * 24 * 60 * 60 * 1000;
  const isRefill = (acc) => {
    const ce = cycleEndMs(acc);
    const de = Number(acc.DeductionEndTime);
    return Number.isFinite(ce) && Number.isFinite(de) && de - ce > REFILL_GAP_MS;
  };

  let totalRemain = 0;
  let sawSizedPack = false;
  for (const acc of accounts) {
    if (!acc || typeof acc !== "object") continue;
    if (isRefill(acc)) {
      const size = num(acc.CycleCapacitySizePrecise, acc.CycleCapacitySize);
      const remain = num(acc.CycleCapacityRemainPrecise, acc.CycleCapacityRemain);
      if (size > 0) {
        sawSizedPack = true;
        totalRemain += remain;
      }
    } else {
      const size = num(acc.CapacitySizePrecise, acc.CapacitySize);
      const used = num(acc.CapacityUsedPrecise, acc.CapacityUsed);
      if (size > 0) {
        sawSizedPack = true;
        totalRemain += size - used;
      }
    }
  }

  if (!sawSizedPack) return false; // nothing measurable → don't poison the cache
  return totalRemain <= 0;
}


// Label a refill pack by its cycle length (Monthly is the common CodeBuddy case).
function refillCadence(acc) {
  const start = parseResetTime(acc.CycleStartTime);
  const end = parseResetTime(acc.CycleEndTime);
  if (start && end) {
    const days = (new Date(end).getTime() - new Date(start).getTime()) / 86400000;
    if (days <= 1.5) return "Daily";
    if (days <= 10) return "Weekly";
  }
  return "Monthly";
}

async function getCodeBuddyUsage(providerId, accessToken, apiKey, providerSpecificData, proxyOptions = null) {
  const token = accessToken || apiKey;
  if (!token) {
    return { message: `CodeBuddy (${providerId}) credential not available.` };
  }

  try {
    const response = await proxyAwareFetch(U(providerId).url, {
      method: "POST",
      headers: {
        ...(PROVIDERS[providerId]?.headers || {}),
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: "{}",
    }, proxyOptions);

    if (response.status === 401 || response.status === 403) {
      return { message: "CodeBuddy CN credential invalid or expired." };
    }
    if (!response.ok) {
      return { message: `CodeBuddy CN quota API error (${response.status}).` };
    }

    const json = await response.json();
    if (json?.code !== 0) {
      return { message: `CodeBuddy CN quota error: ${json?.msg || "unknown"}` };
    }

    const data = json?.data?.Response?.Data || {};
    const accounts = Array.isArray(data.Accounts) ? data.Accounts : [];
    if (accounts.length === 0) {
      return { message: "CodeBuddy CN connected. No credit package found." };
    }

    const cycleEndMs = (acc) => {
      const r = parseResetTime(acc.CycleEndTime);
      return r ? new Date(r).getTime() : Number.POSITIVE_INFINITY;
    };
    // Refill packs roll into a new cycle before the resource expires; bonus packs
    // end exactly at expiry. >2d gap between cycle end and validity end = refill.
    const REFILL_GAP_MS = 2 * 24 * 60 * 60 * 1000;
    const isRefill = (acc) => {
      const ce = cycleEndMs(acc);
      const de = Number(acc.DeductionEndTime);
      return Number.isFinite(ce) && Number.isFinite(de) && de - ce > REFILL_GAP_MS;
    };
    const byExpiry = (a, b) => cycleEndMs(a) - cycleEndMs(b);

    const refills = accounts.filter(isRefill).sort(byExpiry);
    const bonuses = accounts.filter((a) => !isRefill(a)).sort(byExpiry);

    const quotas = {};
    // Refill packs first: cadence-labelled, using the *Cycle* balance and
    // resetting at the next refresh.
    const seenRefill = {};
    refills.forEach((acc) => {
      const base = refillCadence(acc);
      seenRefill[base] = (seenRefill[base] || 0) + 1;
      const name = seenRefill[base] > 1 ? `${base} ${seenRefill[base]}` : base;
      quotas[name] = {
        used: num(acc.CycleCapacityUsedPrecise, acc.CycleCapacityUsed),
        total: num(acc.CycleCapacitySizePrecise, acc.CycleCapacitySize),
        resetAt: parseResetTime(acc.CycleEndTime),
        unlimited: false,
        // Recurring allowance: the CycleEndTime is the next refresh, not the
        // final expiry. The UI must show "Resets in", not "Expires in".
        recurring: true,
      };
    });
    // Bonus packs: use the lifetime Capacity balance; resetAt is the expiry.
    // These are one-shot credits (CycleEndTime == DeductionEndTime), so they
    // never replenish — mark recurring:false so the UI shows "Expires in"
    // instead of implying a monthly refill.
    bonuses.forEach((acc, i) => {
      quotas[`Bonus Pack ${i + 1}`] = {
        used: num(acc.CapacityUsedPrecise, acc.CapacityUsed),
        total: num(acc.CapacitySizePrecise, acc.CapacitySize),
        resetAt: parseResetTime(acc.CycleEndTime),
        unlimited: false,
        recurring: false,
      };
    });

    const basePkg = refills[0] || accounts[0] || {};
    const plan = basePkg.PackageName || basePkg.SubProductName || "CodeBuddy";

    // Request-meter signal for the router: the account is rate limited only
    // once its COMBINED usable quota (refill + all bonus packs) is empty. The
    // reset time is the soonest refresh among the packs that will refill first
    // (refill packs reset monthly; bonus packs never do), matching the order
    // used above so the retry time is the earliest recovery.
    const requestExhausted = isCodeBuddyQuotaExhausted(accounts);
    const requestExhaustedAt = requestExhausted
      ? parseResetTime((refills[0] || accounts[0] || {}).CycleEndTime)
      : null;

    return { plan, quotas, requestExhausted, resetAt: requestExhaustedAt };
  } catch (error) {
    return { message: `CodeBuddy (${providerId}) error: ${error.message}` };
  }
}

export async function getCodeBuddyCnUsage(accessToken, apiKey, providerSpecificData, proxyOptions = null) {
  return getCodeBuddyUsage(PROVIDER_ID, accessToken, apiKey, providerSpecificData, proxyOptions);
}

export async function getCodeBuddyIntlUsage(accessToken, apiKey, providerSpecificData, proxyOptions = null) {
  return getCodeBuddyUsage("codebuddy-intl", accessToken, apiKey, providerSpecificData, proxyOptions);
}
