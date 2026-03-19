// ─── src/storage/eligibility.js ──────────────────────────────────────────────
//
// Pure eligibility calculation functions. No IndexedDB imports.
//
// Usage:
//   import { calculateEligibility, getAgeOnDate } from '../storage';
//   import { getPresetForTeam } from '../storage';
//
//   const preset = getPresetForTeam(team);
//   const result = calculateEligibility(pitcher, today, outings, preset, settings.customPitchRules);
// ─────────────────────────────────────────────────────────────────────────────

export function getAgeOnDate(birthday, date) {
  if (!birthday) return 99;
  const birth = new Date(birthday + 'T00:00:00');
  const check = new Date(date + 'T00:00:00');
  let age = check.getFullYear() - birth.getFullYear();
  const monthDiff = check.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && check.getDate() < birth.getDate()))
    age--;
  return age;
}

function addDays(dateString, n) {
  const d = new Date(dateString + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysBetween(earlier, later) {
  const a = new Date(earlier + 'T00:00:00');
  const b = new Date(later + 'T00:00:00');
  return Math.round((b - a) / 86_400_000);
}

export function getDailyMax(age, preset, customRules = null) {
  if (customRules?.dailyLimits?.length) {
    const sorted = [...customRules.dailyLimits].sort(
      (a, b) => a.maxAge - b.maxAge
    );
    const bracket =
      sorted.find((b) => age <= b.maxAge) ?? sorted[sorted.length - 1];
    return bracket.pitches;
  }
  const brackets = preset.ageBrackets;
  const bracket =
    brackets.find((b) => age <= b.maxAge) ?? brackets[brackets.length - 1];
  return bracket.dailyMax;
}

export function getRestDaysRequired(
  pitchCount,
  age,
  preset,
  customRules = null
) {
  if (customRules?.restDays?.length) {
    const sorted = [...customRules.restDays].sort(
      (a, b) => a.maxPitches - b.maxPitches
    );
    const threshold = sorted.find((t) => pitchCount <= t.maxPitches);
    return threshold ? threshold.days : sorted[sorted.length - 1].days;
  }
  const restBrackets = preset.restBrackets;
  const ageBracket =
    restBrackets.find((b) => age <= b.maxAge) ??
    restBrackets[restBrackets.length - 1];
  const threshold = ageBracket.thresholds.find(
    (t) => pitchCount <= t.maxPitches
  );
  return threshold
    ? threshold.restDays
    : ageBracket.thresholds[ageBracket.thresholds.length - 1].restDays;
}

/**
 * calculateEligibility
 *
 * @param {object}      pitcher      — { birthday: 'YYYY-MM-DD' }
 * @param {string}      checkDate    — 'YYYY-MM-DD'
 * @param {object[]}    outings      — all game outings for this pitcher (all teams)
 * @param {object}      preset       — org rule preset
 * @param {object|null} customRules  — settings.customPitchRules or null
 *
 * @returns {{
 *   eligible:                boolean,
 *   reason:                  string,
 *   pitchLimit:              number,
 *   restDaysRemaining:       number,
 *   nextEligibleDate:        string|null,
 *   consecutiveDayCapActive: boolean,
 * }}
 */
export function calculateEligibility(
  pitcher,
  checkDate,
  outings,
  preset,
  customRules = null
) {
  const today = checkDate;
  const age = getAgeOnDate(pitcher?.birthday, today);
  const dailyMax = getDailyMax(age, preset, customRules);

  // Build date → pitch count map for recent outings (last 7 days, INCLUDING today)
  const recentMap = {};
  for (const outing of outings) {
    if (!outing.date) continue;
    const daysAgo = daysBetween(outing.date, today);
    if (daysAgo >= 0 && daysAgo <= 7) {
      recentMap[outing.date] =
        (recentMap[outing.date] ?? 0) + (outing.summary?.totalPitches ?? 0);
    }
  }

  // ── Check 1: mandatory rest days from most recent outing ─────────────────
  // Includes today's outing so the Teams screen reflects a completed game.
  const recentDates = Object.keys(recentMap).sort().reverse();
  if (recentDates.length > 0) {
    const lastDate = recentDates[0];
    const lastCount = recentMap[lastDate];
    const restRequired = getRestDaysRequired(
      lastCount,
      age,
      preset,
      customRules
    );
    const daysElapsed = daysBetween(lastDate, today);

    if (daysElapsed === 0 && restRequired > 0) {
      // Pitched today and rest is required — ineligible for next appearance
      return {
        eligible: false,
        reason: `${lastCount} pitches today requires ${restRequired} day${
          restRequired !== 1 ? 's' : ''
        } rest`,
        pitchLimit: 0,
        restDaysRemaining: restRequired, // full rest period starts tomorrow
        nextEligibleDate: addDays(today, restRequired + 1),
        consecutiveDayCapActive: false,
      };
    }

    if (daysElapsed > 0 && daysElapsed <= restRequired) {
      // Pitched on a prior day and still within rest window
      return {
        eligible: false,
        reason: `${lastCount} pitches on ${lastDate} requires ${restRequired} day${
          restRequired !== 1 ? 's' : ''
        } rest`,
        pitchLimit: 0,
        restDaysRemaining: restRequired - daysElapsed + 1,
        nextEligibleDate: addDays(lastDate, restRequired + 1),
        consecutiveDayCapActive: false,
      };
    }
  }

  // ── Check 2: no 3 consecutive days ───────────────────────────────────────
  if (preset.noThreeConsecutiveDays || customRules) {
    const dayMinus1 = addDays(today, -1);
    const dayMinus2 = addDays(today, -2);
    const pitchedYesterday =
      dayMinus1 in recentMap || outings.some((o) => o.date === dayMinus1);
    const pitchedTwoDaysAgo =
      dayMinus2 in recentMap || outings.some((o) => o.date === dayMinus2);

    if (pitchedYesterday && pitchedTwoDaysAgo) {
      return {
        eligible: false,
        reason: 'Cannot pitch 3 consecutive days',
        pitchLimit: 0,
        restDaysRemaining: 1,
        nextEligibleDate: addDays(today, 1),
        consecutiveDayCapActive: false,
      };
    }

    // ── Check 3: NFHS consecutive-day pitch cap ───────────────────────────
    if (preset.consecutiveDayPitchCap != null && pitchedYesterday) {
      const cap = preset.consecutiveDayPitchCap;
      const effectiveMax = Math.min(dailyMax, cap);
      return {
        eligible: true,
        reason: `Pitched yesterday — limited to ${effectiveMax} pitches today (NFHS rule)`,
        pitchLimit: effectiveMax,
        restDaysRemaining: 0,
        nextEligibleDate: null,
        consecutiveDayCapActive: true,
      };
    }
  }

  // ── Eligible at full daily limit ──────────────────────────────────────────
  return {
    eligible: true,
    reason: 'Available',
    pitchLimit: dailyMax,
    restDaysRemaining: 0,
    nextEligibleDate: null,
    consecutiveDayCapActive: false,
  };
}

/**
 * calculateRosterEligibility — batch helper for the team availability view.
 * Returns { [pitcherId]: EligibilityResult }
 */
export async function calculateRosterEligibility(
  pitchers,
  checkDate,
  allOutings,
  teamsByPitcher,
  presetsByOrg,
  customRules
) {
  const results = {};
  for (const pitcher of pitchers) {
    const outings = allOutings.filter((o) => o.pitcherId === pitcher.id);
    const team = teamsByPitcher[pitcher.id];
    const preset = presetsByOrg[team?.organization] ?? presetsByOrg.pitchSmart;
    results[pitcher.id] = calculateEligibility(
      pitcher,
      checkDate,
      outings,
      preset,
      customRules
    );
  }
  return results;
}
