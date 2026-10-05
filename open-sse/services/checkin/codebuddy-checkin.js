/**
 * CodeBuddy daily check-in (CN) + daily active-session probe (intl).
 *
 * Ported from the reverse-engineered CodeBuddy gateway behaviour documented
 * across several community projects (maiphucgiang/codebuddy2api,
 * jlcodes99/cockpit-tools, techysy/10router, neipor/codebuddy-cli2api).
 *
 * CN — the CodeBuddy CN "billing meter" exposes a daily check-in that renews a
 * free credit allowance (100 credits/day):
 *
 *   POST https://www.codebuddy.cn/v2/billing/meter/daily-checkin
 *   POST https://www.codebuddy.cn/v2/billing/meter/checkin-activity-status
 *
 * Both take an empty JSON body, the OAuth access token as a Bearer token, an
 * `X-User-Id` header (the JWT `sub` claim) and a browser-like User-Agent
 * (missing UA ⇒ HTTP 403 / code 10085). The response envelope is
 * `{ code, msg, data }`; `code === 0` is success and idempotent replays come
 * back as a non-zero code/message ("已签到" / already).
 *
 * intl — the codebuddy.ai gateway rejects OAuth tokens on the same check-in
 * host (APISIX returns 401), so there is no claim endpoint. Daily credits are
 * granted to accounts that make at least one valid chat request in the day, so
 * the intl path sends one minimal, free-tier chat probe instead. We keep this
 * best-effort and never surface it as a hard failure.
 *
 * The CN billing host is NOT the chat host (copilot.tencent.com /
 * www.codebuddy.ai); it is www.codebuddy.cn for the CN realm and
 * www.codebuddy.ai for the intl realm.
 */

import { proxyAwareFetch } from "../../utils/proxyFetch.js";

const CN_CHECKIN_URL = "https://www.codebuddy.cn/v2/billing/meter/daily-checkin";
const CN_STATUS_URL = "https://www.codebuddy.cn/v2/billing/meter/checkin-activity-status";

// intl daily active-session probe. Uses the same stream-only gateway as chat:
// a leading system prompt plus the user content as typed blocks, otherwise the
// gateway answers 11101 (invalid request). "hy4-preview" is a free-tier model.
const INTL_CHAT_URL = "https://www.codebuddy.ai/v2/chat/completions";
const INTL_PROBE_MODEL = "hy4-preview";
const INTL_PROBE_MAX_TOKENS = 16;

// A browser-like UA is effectively mandatory for the CN billing endpoints.
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export const CODEBUDDY_CHECKIN_PROVIDERS = new Set(["codebuddy-cn", "codebuddy-intl"]);

// ─── Pure helpers (unit-testable, no I/O) ──────────────────────────────────

export function decodeJwt(token) {
  try {
    const segment = String(token).split(".")[1];
    if (!segment) return null;
    const b64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(Buffer.from(pad, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

/** Local-day key (YYYY-MM-DD) used to memoize per-day check-ins. */
export function dayKey(nowMs = Date.now()) {
  const d = new Date(nowMs);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function isIdempotentAlready(msg) {
  if (typeof msg !== "string") return false;
  return /已签到|签到过|重复签到|已经签到|already|repeat|duplicate/i.test(msg);
}

/**
 * Map a raw daily-checkin response to a stable status.
 * @param {{ httpStatus: number, code?: number|string, msg?: string }} res
 * @returns {"checked-in"|"already"|"inactive"|"failed"}
 */
export function mapCheckinStatus({ httpStatus, code, msg } = {}) {
  if (httpStatus >= 200 && httpStatus < 300) return "checked-in";
  // Idempotent replay: HTTP 200/400 with a known already-signed message/code.
  if (isIdempotentAlready(msg)) return "already";
  if (code === 10001 || code === "10001" || code === 14001 || code === "14001") return "already";
  // The claim endpoint is OAuth-only: API-key connections are rejected here even
  // though the (read-only) status endpoint accepts them.
  if (/api\s*key not allowed|not allowed for this path/i.test(msg || "")) return "apikey-only";
  // Activity campaign not open / expired.
  if (code === 1003 || code === "1003" || /未开启|未开始|未开放|已过期|not\s*active|inactive/i.test(msg || "")) {
    return "inactive";
  }
  return "failed";
}

export function isCodeBuddyCheckinProvider(providerId) {
  return CODEBUDDY_CHECKIN_PROVIDERS.has(providerId);
}

/** Resolve the numeric uid (`sub` claim) used for the X-User-Id header. */
export function resolveUid(connection) {
  const claims = decodeJwt(connection?.accessToken || connection?.apiKey);
  if (claims?.sub) return String(claims.sub);
  const data = connection?.providerSpecificData || {};
  return String(data.uid || data.userId || data.user_id || connection?.id || "");
}

// ─── HTTP helpers ──────────────────────────────────────────────────────────

function cnHeaders(accessToken, uid) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "X-User-Id": uid,
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": BROWSER_UA,
    "X-Domain": "www.codebuddy.cn",
    "X-CodeBuddy-Request": "1",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  };
}

async function parseJsonBody(response) {
  const text = await response.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** POST the CN daily check-in for one token. Returns raw + mapped status. */
export async function postDailyCheckin(accessToken, uid, proxyOptions = null) {
  const response = await proxyAwareFetch(
    CN_CHECKIN_URL,
    { method: "POST", headers: cnHeaders(accessToken, uid), body: "{}" },
    proxyOptions,
  );
  const body = await parseJsonBody(response);
  const code = body?.code ?? body?.error_code;
  const msg = body?.msg ?? body?.message ?? body?.data?.message ?? "";
  const status = mapCheckinStatus({ httpStatus: response.status, code, msg });
  return {
    httpStatus: response.status,
    code,
    msg,
    status,
    data: body?.data ?? null,
    raw: body,
  };
}

/** Fetch the CN check-in status (today_checked_in / streak). */
export async function fetchCheckinStatus(accessToken, uid, proxyOptions = null) {
  const response = await proxyAwareFetch(
    CN_STATUS_URL,
    { method: "POST", headers: cnHeaders(accessToken, uid), body: "{}" },
    proxyOptions,
  );
  const body = await parseJsonBody(response);
  const data = body?.data || {};
  return {
    httpStatus: response.status,
    code: body?.code,
    todayCheckedIn: data.today_checked_in === true || data.checked_in === true,
    active: data.active === true,
    streakDays: Number(data.streak_days ?? data.streakDays ?? 0) || 0,
    dailyCredit: Number(data.daily_credit ?? data.today_credit ?? 0) || 0,
    streakBonusDays: Number(data.streak_bonus_days ?? 0) || 0,
    streakBonusCredit: Number(data.streak_bonus_credit ?? 0) || 0,
    raw: body,
  };
}

// ─── intl active-session probe ─────────────────────────────────────────────

async function postIntlProbe(accessToken, proxyOptions = null) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    Accept: "text/event-stream",
    "User-Agent": "IDE/2.108.1 CodeBuddy/2.108.1",
    "X-Product": "SaaS",
    "X-IDE-Type": "IDE",
    "X-IDE-Name": "IDE",
    "x-requested-with": "XMLHttpRequest",
    "x-codebuddy-request": "1",
  };
  const response = await proxyAwareFetch(
    INTL_CHAT_URL,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: INTL_PROBE_MODEL,
        stream: true,
        max_tokens: INTL_PROBE_MAX_TOKENS,
        messages: [
          { role: "system", content: "You are CodeBuddy Code." },
          { role: "user", content: [{ type: "text", text: "hi" }] },
        ],
      }),
    },
    proxyOptions,
  );
  // Stream-only gateway: a 2xx means a valid session was established. Drain
  // the SSE body so the connection frees up; it costs ~0 credits on a
  // free-tier model.
  let msg = "";
  if (response.ok) {
    await response.text().catch(() => "");
  } else {
    const text = await response.text().catch(() => "");
    msg = (text || "").slice(0, 200);
  }
  return { httpStatus: response.status, msg };
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Perform a daily check-in for one connection.
 *
 * CN: POST the daily-checkin endpoint; idempotent replays report "already".
 * intl: send one active-session probe (no claim endpoint exists).
 *
 * @param {object} connection
 * @param {object|null} proxyOptions
 * @returns {Promise<object>}
 */
export async function checkInCodeBuddy(connection, proxyOptions = null) {
  const provider = connection?.provider;
  const accessToken = connection?.accessToken || connection?.apiKey;
  if (!accessToken) {
    return {
      provider,
      status: "failed",
      message: "No access token on this connection.",
      checkedIn: false,
      alreadyCheckedIn: false,
      inactive: false,
    };
  }

  const uid = resolveUid(connection);

  try {
    if (provider === "codebuddy-intl") {
      const probe = await postIntlProbe(accessToken, proxyOptions);
      if (probe.httpStatus >= 200 && probe.httpStatus < 300) {
        return {
          provider,
          status: "session-ok",
          message:
            "Active session registered — CodeBuddy intl grants daily credits for accounts with a daily chat request (no manual claim endpoint).",
          checkedIn: true,
          alreadyCheckedIn: false,
          inactive: false,
        };
      }
      if (probe.httpStatus === 401 || probe.httpStatus === 403) {
        return {
          provider,
          status: "unsupported",
          message:
            "CodeBuddy intl has no daily check-in endpoint (the codebuddy.ai gateway rejects OAuth tokens). Daily credits accrue automatically when you chat each day.",
          checkedIn: false,
          alreadyCheckedIn: false,
          inactive: true,
          raw: { httpStatus: probe.httpStatus, msg: probe.msg },
        };
      }
      return {
        provider,
        status: "failed",
        message: probe.msg || `Intl session probe failed (HTTP ${probe.httpStatus}).`,
        checkedIn: false,
        alreadyCheckedIn: false,
        inactive: false,
        raw: { httpStatus: probe.httpStatus },
      };
    }

    // CN (default). Status-first so we don't re-claim and churn "已签到".
    try {
      const status = await fetchCheckinStatus(accessToken, uid, proxyOptions);
      if (status.todayCheckedIn) {
        return {
          provider,
          status: "already",
          message: "Already checked in today.",
          checkedIn: true,
          alreadyCheckedIn: true,
          inactive: false,
          streakDays: status.streakDays,
          credit: status.dailyCredit,
          raw: status.raw,
        };
      }
    } catch {
      // Status check is best-effort — fall through to a plain check-in.
    }

    const result = await postDailyCheckin(accessToken, uid, proxyOptions);

    // API-key connections can read status but cannot claim (OAuth-only path).
    if (result.status === "apikey-only") {
      // Re-check status: if the day's credit already landed (e.g. via the IDE),
      // surface it as done rather than as a failure.
      try {
        const status = await fetchCheckinStatus(accessToken, uid, proxyOptions);
        if (status.todayCheckedIn) {
          return {
            provider,
            status: "already",
            message: "Already checked in today.",
            checkedIn: true,
            alreadyCheckedIn: true,
            inactive: false,
            streakDays: status.streakDays,
            credit: status.dailyCredit,
          };
        }
        return {
          provider,
          status: "apikey-only",
          message:
            "Daily check-in requires an OAuth (login) CodeBuddy connection; API-key connections can only read status.",
          checkedIn: false,
          alreadyCheckedIn: false,
          inactive: false,
          streakDays: status.streakDays,
          credit: status.dailyCredit,
        };
      } catch {
        return {
          provider,
          status: "apikey-only",
          message:
            "Daily check-in requires an OAuth (login) CodeBuddy connection; API-key connections can only read status.",
          checkedIn: false,
          alreadyCheckedIn: false,
          inactive: false,
        };
      }
    }

    const checkedIn = result.status === "checked-in" || result.status === "already";
    const message =
      result.status === "checked-in"
        ? "Checked in successfully."
        : result.status === "already"
          ? "Already checked in today."
          : result.status === "inactive"
            ? result.msg || "Check-in activity is not open right now."
            : result.msg || `Check-in failed (HTTP ${result.httpStatus}).`;

    return {
      provider,
      status: result.status,
      message,
      checkedIn,
      alreadyCheckedIn: result.status === "already",
      inactive: result.status === "inactive",
      credit: Number(result.data?.credit ?? result.data?.today_credit ?? 0) || undefined,
      streakDays: Number(result.data?.streak_days ?? 0) || undefined,
      raw: result.raw,
    };
  } catch (error) {
    return {
      provider,
      status: "failed",
      message: error?.message || "Daily check-in request failed.",
      checkedIn: false,
      alreadyCheckedIn: false,
      inactive: false,
    };
  }
}

/**
 * Read-only check-in status (does not claim). CN only; intl returns a synthetic
 * "auto" status because it has no claim endpoint.
 */
export async function getCodeBuddyCheckinStatus(connection, proxyOptions = null) {
  const provider = connection?.provider;
  if (provider === "codebuddy-intl") {
    return {
      provider,
      supported: false,
      todayCheckedIn: false,
      active: false,
      streakDays: 0,
      dailyCredit: 0,
      message:
        "CodeBuddy intl has no daily check-in endpoint — daily credits accrue automatically with a daily chat request.",
    };
  }
  if (!connection?.accessToken && !connection?.apiKey) {
    return { provider, supported: false, todayCheckedIn: false, message: "No access token." };
  }
  try {
    const status = await fetchCheckinStatus(connection.accessToken || connection.apiKey, resolveUid(connection), proxyOptions);
    return {
      provider,
      supported: true,
      todayCheckedIn: status.todayCheckedIn,
      active: status.active,
      streakDays: status.streakDays,
      dailyCredit: status.dailyCredit,
      streakBonusDays: status.streakBonusDays,
      streakBonusCredit: status.streakBonusCredit,
    };
  } catch (error) {
    return {
      provider,
      supported: true,
      todayCheckedIn: false,
      message: error?.message || "Failed to read check-in status.",
    };
  }
}
