// ─── src/storage/index.js ────────────────────────────────────────────────────
//
// All IndexedDB operations, org rule presets, summary computation, utility
// functions, and compatibility wrappers.
//
// Object stores:
//   teams            — keyed by id
//   pitchers         — keyed by id
//   gameOutings      — keyed by id, indexed on pitcherId
//   trainingSessions — keyed by id, indexed on pitcherId
//   settings         — single record { key: 'main', data: {...} }
//   drafts           — keyed by type ('game' | 'training')
// ─────────────────────────────────────────────────────────────────────────────

import {
  calculateEligibility,
  getAgeOnDate,
  getDailyMax,
  getRestDaysRequired,
} from './availability.js';

export { calculateEligibility, getAgeOnDate, getDailyMax, getRestDaysRequired };

// ── Org Rule Presets ─────────────────────────────────────────────────────────

export const PITCH_SMART_PRESET = {
  id: 'pitchSmart',
  label: 'Pitch Smart / USA Baseball',
  description:
    'Covers Little League, USSSA, Perfect Game, AAU, NABF, AABC, ' +
    'American Legion, Babe Ruth / Cal Ripken, PONY, Dixie Youth, Game Day USA',
  ageBrackets: [
    { maxAge: 8, dailyMax: 50 },
    { maxAge: 10, dailyMax: 75 },
    { maxAge: 12, dailyMax: 85 },
    { maxAge: 14, dailyMax: 95 },
    { maxAge: 16, dailyMax: 95 },
    { maxAge: 18, dailyMax: 105 },
    { maxAge: 99, dailyMax: 120 },
  ],
  restBrackets: [
    {
      maxAge: 8,
      thresholds: [
        { maxPitches: 20, restDays: 0 },
        { maxPitches: 35, restDays: 1 },
        { maxPitches: 999, restDays: 2 },
      ],
    },
    {
      maxAge: 14,
      thresholds: [
        { maxPitches: 20, restDays: 0 },
        { maxPitches: 35, restDays: 1 },
        { maxPitches: 50, restDays: 2 },
        { maxPitches: 65, restDays: 3 },
        { maxPitches: 999, restDays: 4 },
      ],
    },
    {
      maxAge: 16,
      thresholds: [
        { maxPitches: 30, restDays: 0 },
        { maxPitches: 45, restDays: 1 },
        { maxPitches: 60, restDays: 2 },
        { maxPitches: 75, restDays: 3 },
        { maxPitches: 999, restDays: 4 },
      ],
    },
    {
      maxAge: 18,
      thresholds: [
        { maxPitches: 30, restDays: 0 },
        { maxPitches: 45, restDays: 1 },
        { maxPitches: 60, restDays: 2 },
        { maxPitches: 80, restDays: 3 },
        { maxPitches: 999, restDays: 4 },
      ],
    },
    {
      maxAge: 99,
      thresholds: [
        { maxPitches: 30, restDays: 0 },
        { maxPitches: 45, restDays: 1 },
        { maxPitches: 60, restDays: 2 },
        { maxPitches: 80, restDays: 3 },
        { maxPitches: 105, restDays: 5 },
        { maxPitches: 999, restDays: 5 },
      ],
    },
  ],
  noThreeConsecutiveDays: true,
  consecutiveDayPitchCap: null,
};

export const NFHS_PRESET = {
  id: 'nfhs',
  label: 'NFHS (High School)',
  description:
    'National Federation of State High School Associations — 110 pitch max.',
  ageBrackets: [{ maxAge: 99, dailyMax: 110 }],
  restBrackets: [
    {
      maxAge: 99,
      thresholds: [
        { maxPitches: 30, restDays: 0 },
        { maxPitches: 50, restDays: 1 },
        { maxPitches: 70, restDays: 2 },
        { maxPitches: 90, restDays: 3 },
        { maxPitches: 999, restDays: 4 },
      ],
    },
  ],
  noThreeConsecutiveDays: true,
  consecutiveDayPitchCap: 50,
};

export const ORG_PRESETS = {
  pitchSmart: PITCH_SMART_PRESET,
  nfhs: NFHS_PRESET,
};

// ── Constants ─────────────────────────────────────────────────────────────────

export const MAX_TEAMS = 10;
export const MAX_PITCHERS_PER_TEAM = 25;

export const PITCH_TYPES = [
  '4-Seam',
  '2-Seam',
  'Curve',
  'Slider',
  'Change',
  'Splitter',
  'Cutter',
  'Knuckle',
];
export const VALID_PITCH_TYPES = PITCH_TYPES;
export const VALID_THROWING_HANDS = ['R', 'L'];

// Each entry: { value, label } — value is the stored org key used in presets.
export const VALID_ORGANIZATIONS = [
  { value: 'pitchSmart', label: 'Pitch Smart / USA Baseball' },
  { value: 'nfhs', label: 'NFHS (High School)' },
  { value: 'custom', label: 'Custom Rules' },
];

// ── Default settings ─────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  redThreshold: 50,
  yellowThreshold: 65,
  seasonStartDate: `${new Date().getFullYear()}-01-01`,
  trainingHistoryCount: 10,
  customPitchRules: null,
};

// ── DB lifecycle ─────────────────────────────────────────────────────────────

const DB_NAME = 'pitchTrackerDB';
const DB_VERSION = 1;
let _db = null;

export function openDatabase() {
  return new Promise((resolve, reject) => {
    if (_db) {
      resolve(_db);
      return;
    }

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('teams')) {
        db.createObjectStore('teams', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('pitchers')) {
        db.createObjectStore('pitchers', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('gameOutings')) {
        const s = db.createObjectStore('gameOutings', { keyPath: 'id' });
        s.createIndex('pitcherId', 'pitcherId', { unique: false });
      }
      if (!db.objectStoreNames.contains('trainingSessions')) {
        const s = db.createObjectStore('trainingSessions', { keyPath: 'id' });
        s.createIndex('pitcherId', 'pitcherId', { unique: false });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('drafts')) {
        db.createObjectStore('drafts', { keyPath: 'type' });
      }
    };

    req.onsuccess = (e) => {
      _db = e.target.result;
      resolve(_db);
    };
    req.onerror = (e) => reject(new Error(`DB open failed: ${e.target.error}`));
  });
}

export function deleteDatabase() {
  return new Promise((resolve, reject) => {
    if (_db) {
      _db.close();
      _db = null;
    }
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = (e) =>
      reject(new Error(`DB delete failed: ${e.target.error}`));
    req.onblocked = () => {
      if (_db) {
        _db.close();
        _db = null;
      }
    };
  });
}

// ── Low-level IDB helpers ─────────────────────────────────────────────────────

function db() {
  if (!_db)
    throw new Error('Database not initialized — call openDatabase() first.');
  return _db;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function txGet(store, key) {
  return new Promise((resolve, reject) => {
    const req = db().transaction(store, 'readonly').objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

function txGetAll(store) {
  return new Promise((resolve, reject) => {
    const req = db().transaction(store, 'readonly').objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}

function txGetByIndex(store, index, value) {
  return new Promise((resolve, reject) => {
    const req = db()
      .transaction(store, 'readonly')
      .objectStore(store)
      .index(index)
      .getAll(value);
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}

function txPut(store, record) {
  return new Promise((resolve, reject) => {
    const req = db()
      .transaction(store, 'readwrite')
      .objectStore(store)
      .put(record);
    req.onsuccess = () => resolve(record);
    req.onerror = () => reject(req.error);
  });
}

function txDelete(store, key) {
  return new Promise((resolve, reject) => {
    const req = db()
      .transaction(store, 'readwrite')
      .objectStore(store)
      .delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ── Settings ─────────────────────────────────────────────────────────────────

export async function getSettings() {
  const stored = await txGet('settings', 'main');
  return { ...DEFAULT_SETTINGS, ...(stored?.data ?? {}) };
}

export async function updateSettings(updates) {
  const current = await getSettings();
  const merged = { ...current, ...updates };
  await txPut('settings', { key: 'main', data: merged });
  return merged;
}

export async function resetSettings() {
  const defaults = { ...DEFAULT_SETTINGS };
  await txPut('settings', { key: 'main', data: defaults });
  return defaults;
}

// ── Teams ─────────────────────────────────────────────────────────────────────

export async function getAllTeams() {
  return txGetAll('teams');
}

export async function getTeam(id) {
  return txGet('teams', id);
}

export async function createTeam(data) {
  const team = {
    id: generateId(),
    name: '',
    organization: 'pitchSmart',
    ageGroup: '',
    coach1Name: '',
    coach1Phone: '',
    coach2Name: '',
    coach2Phone: '',
    pitcherIds: [],
    createdAt: new Date().toISOString(),
    ...data,
  };
  return txPut('teams', team);
}

export async function updateTeam(id, updates) {
  const existing = await txGet('teams', id);
  if (!existing) throw new Error(`Team ${id} not found`);
  return txPut('teams', { ...existing, ...updates, id });
}

export async function deleteTeam(id) {
  return txDelete('teams', id);
}

// ── Team / Pitcher roster helpers ─────────────────────────────────────────────

export async function addPitcherToTeam(teamId, pitcherId) {
  const team = await getTeam(teamId);
  if (!team) throw new Error(`Team ${teamId} not found`);
  if (team.pitcherIds.includes(pitcherId)) return team;
  if (team.pitcherIds.length >= MAX_PITCHERS_PER_TEAM) {
    throw new Error(
      `Team already has the maximum of ${MAX_PITCHERS_PER_TEAM} pitchers.`
    );
  }
  return updateTeam(teamId, { pitcherIds: [...team.pitcherIds, pitcherId] });
}

export async function removePitcherFromTeam(teamId, pitcherId) {
  const team = await getTeam(teamId);
  if (!team) throw new Error(`Team ${teamId} not found`);
  return updateTeam(teamId, {
    pitcherIds: team.pitcherIds.filter((id) => id !== pitcherId),
  });
}

export async function getTeamsForPitcher(pitcherId) {
  const teams = await getAllTeams();
  return teams.filter((t) => t.pitcherIds.includes(pitcherId));
}

// ── Pitchers ──────────────────────────────────────────────────────────────────

export async function getAllPitchers() {
  return txGetAll('pitchers');
}

export async function getPitcher(id) {
  return txGet('pitchers', id);
}

export async function createPitcher(data) {
  const pitcher = {
    id: generateId(),
    fullName: '',
    birthday: '',
    throwingHand: 'R',
    pitchArsenal: [],
    playerPhone: null,
    notes: '',
    createdAt: new Date().toISOString(),
    ...data,
  };
  return txPut('pitchers', pitcher);
}

export async function updatePitcher(id, updates) {
  const existing = await txGet('pitchers', id);
  if (!existing) throw new Error(`Pitcher ${id} not found`);
  return txPut('pitchers', { ...existing, ...updates, id });
}

export async function deletePitcher(id) {
  const teams = await getAllTeams();
  for (const team of teams) {
    if (team.pitcherIds?.includes(id)) {
      await updateTeam(team.id, {
        pitcherIds: team.pitcherIds.filter((pid) => pid !== id),
      });
    }
  }
  await deletePitcherStats(id);
  return txDelete('pitchers', id);
}

export async function deletePitcherStats(pitcherId) {
  const [outings, sessions] = await Promise.all([
    getOutingsForPitcher(pitcherId),
    getSessionsForPitcher(pitcherId),
  ]);
  await Promise.all([
    ...outings.map((o) => txDelete('gameOutings', o.id)),
    ...sessions.map((s) => txDelete('trainingSessions', s.id)),
  ]);
}

// ── Game Outings ──────────────────────────────────────────────────────────────

export async function getOutingsForPitcher(pitcherId) {
  const rows = await txGetByIndex('gameOutings', 'pitcherId', pitcherId);
  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

export async function getLastNOutings(pitcherId, n) {
  const outings = await getOutingsForPitcher(pitcherId);
  return outings.slice(0, n);
}

export async function countOutingsForPitcher(pitcherId) {
  const outings = await getOutingsForPitcher(pitcherId);
  return outings.length;
}

export async function getOuting(id) {
  return txGet('gameOutings', id);
}

export async function createOuting(data) {
  const outing = {
    id: generateId(),
    pitcherId: '',
    teamId: '',
    date: new Date().toISOString().slice(0, 10),
    opponent: '',
    pitches: [],
    outs: 0,
    summary: computeOutingSummary([], 0),
    createdAt: new Date().toISOString(),
    ...data,
  };
  // Only recompute summary if one wasn't already provided by the caller.
  // GamePage pre-computes via GameStateMachine.computeOutingSummary which uses
  // different pitch outcome strings — recomputing here would produce zeros.
  if (!data.summary) {
    outing.summary = computeOutingSummary(outing.pitches, outing.outs);
  }
  return txPut('gameOutings', outing);
}

export async function updateOuting(id, updates) {
  const existing = await txGet('gameOutings', id);
  if (!existing) throw new Error(`Outing ${id} not found`);
  const updated = { ...existing, ...updates, id };
  if (updates.pitches !== undefined || updates.outs !== undefined) {
    updated.summary = computeOutingSummary(updated.pitches, updated.outs);
  }
  return txPut('gameOutings', updated);
}

export async function deleteOuting(id) {
  return txDelete('gameOutings', id);
}

// ── Training Sessions ─────────────────────────────────────────────────────────

export async function getSessionsForPitcher(pitcherId) {
  const rows = await txGetByIndex('trainingSessions', 'pitcherId', pitcherId);
  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

export async function getLastNSessions(pitcherId, n) {
  const sessions = await getSessionsForPitcher(pitcherId);
  return sessions.slice(0, n);
}

export async function countSessionsForPitcher(pitcherId) {
  const sessions = await getSessionsForPitcher(pitcherId);
  return sessions.length;
}

export async function getTrainingPitchesInLastDays(pitcherId, days) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const sessions = await getSessionsForPitcher(pitcherId);
  return sessions
    .filter((s) => s.date >= cutoffStr)
    .reduce((sum, s) => sum + (s.summary?.totalPitches ?? 0), 0);
}

export async function getSession(id) {
  return txGet('trainingSessions', id);
}

export async function createSession(data) {
  const session = {
    id: generateId(),
    pitcherId: '',
    teamId: '',
    date: new Date().toISOString().slice(0, 10),
    targetPitches: 50,
    coachNotes: '',
    pitches: [],
    summary: computeSessionSummary([]),
    createdAt: new Date().toISOString(),
    ...data,
  };
  // Only recompute if summary not already provided by caller (TrainingSummary pre-computes)
  if (!data.summary) {
    session.summary = computeSessionSummary(session.pitches);
  }
  return txPut('trainingSessions', session);
}

export async function updateSession(id, updates) {
  const existing = await txGet('trainingSessions', id);
  if (!existing) throw new Error(`Session ${id} not found`);
  const updated = { ...existing, ...updates, id };
  if (updates.pitches !== undefined) {
    updated.summary = computeSessionSummary(updated.pitches);
  }
  return txPut('trainingSessions', updated);
}

export async function deleteSession(id) {
  return txDelete('trainingSessions', id);
}

// ── Drafts ────────────────────────────────────────────────────────────────────

export async function getAllDrafts() {
  const [game, training] = await Promise.all([
    txGet('drafts', 'game'),
    txGet('drafts', 'training'),
  ]);
  return {
    game: game?.data ?? null,
    training: training?.data ?? null,
  };
}

export async function saveDraft(type, data) {
  return txPut('drafts', { type, data });
}

export async function clearDraft(type) {
  return txDelete('drafts', type);
}

// ── Summary: Game Outings ─────────────────────────────────────────────────────
//
// Runs a PA state machine over the raw pitch array.
// Fouls on 2-strike counts keep the batter alive (standard rule).
// Walks auto-detected at 4 balls.
// Pitch categories (fastball / breaking) tracked for K% split.
// Backward-compat aliases kept so old component field names still resolve.

export function computeOutingSummary(pitches, outs = 0) {
  const zero = {
    totalPitches: 0,
    strikes: 0,
    balls: 0,
    calledStrikes: 0,
    swingingStrikes: 0,
    fouls: 0,
    hitIntoPlay: 0,
    hitByPitch: 0,
    walks: 0,
    strikePercent: 0,
    ballPercent: 0,
    firstPitchStrikes: 0,
    threeBallCounts: 0,
    battersFaced: 0,
    atBats: 0,
    battersVsL: 0,
    battersVsR: 0,
    pitchesVsL: 0,
    pitchesVsR: 0,
    strikesVsL: 0,
    strikesVsR: 0,
    strikePercentVsL: 0,
    strikePercentVsR: 0,
    fastballCount: 0,
    fastballStrikes: 0,
    fastballStrikePercent: 0,
    breakingCount: 0,
    breakingStrikes: 0,
    breakingStrikePercent: 0,
    outs: 0,
    innings: '0.0',
    mandatoryRestDays: 0,
    // Backward-compat aliases
    hitBatters: 0,
    ballsInPlay: 0,
    runsAllowed: 0,
    rhbPitches: 0,
    rhbStrikes: 0,
    lhbPitches: 0,
    lhbStrikes: 0,
  };
  if (!pitches?.length) return { ...zero, outs };

  let totalStrikes = 0,
    totalBalls = 0;
  let calledStrikes = 0,
    swingingStrikes = 0,
    fouls = 0;
  let hitIntoPlay = 0,
    hitByPitch = 0;
  let walks = 0,
    firstPitchStrikes = 0,
    threeBallCounts = 0;
  let fastballCount = 0,
    fastballStrikes = 0;
  let breakingCount = 0,
    breakingStrikes = 0;
  const vsL = { pitches: 0, strikes: 0, batters: 0 };
  const vsR = { pitches: 0, strikes: 0, batters: 0 };

  // PA state
  let paBalls = 0,
    paStrikes = 0,
    paFirstPitch = true;
  const resetPA = () => {
    paBalls = 0;
    paStrikes = 0;
    paFirstPitch = true;
  };

  for (const p of pitches) {
    const hand = p.batterHand === 'L' ? 'L' : 'R';
    const vs = hand === 'L' ? vsL : vsR;

    if (paFirstPitch) vs.batters++;

    let isStrike = false;

    switch (p.outcome) {
      case 'ball':
        totalBalls++;
        paBalls++;
        if (paBalls === 3) threeBallCounts++;
        break;
      case 'calledStrike':
        totalStrikes++;
        calledStrikes++;
        paStrikes++;
        isStrike = true;
        break;
      case 'swingingStrike':
        totalStrikes++;
        swingingStrikes++;
        paStrikes++;
        isStrike = true;
        break;
      case 'foul':
        fouls++;
        if (paStrikes < 2) {
          totalStrikes++;
          paStrikes++;
          isStrike = true;
        }
        // foul on 2 strikes: batter stays alive, count unchanged
        break;
      case 'hitIntoPlay':
        hitIntoPlay++;
        totalStrikes++;
        isStrike = true;
        break;
      case 'hitByPitch':
        hitByPitch++;
        break;
      default:
        break;
    }

    if (paFirstPitch && isStrike) firstPitchStrikes++;
    paFirstPitch = false;

    vs.pitches++;
    if (isStrike) vs.strikes++;

    // Category K% — calledStrike, swingingStrike, all fouls, hitIntoPlay count as strikes
    const isCatStrike = [
      'calledStrike',
      'swingingStrike',
      'foul',
      'hitIntoPlay',
    ].includes(p.outcome);
    if (p.pitchCategory === 'fastball') {
      fastballCount++;
      if (isCatStrike) fastballStrikes++;
    } else if (p.pitchCategory === 'breaking') {
      breakingCount++;
      if (isCatStrike) breakingStrikes++;
    }

    // PA ending conditions
    if (p.outcome === 'hitIntoPlay' || p.outcome === 'hitByPitch') {
      resetPA();
    } else if (paBalls >= 4) {
      walks++;
      resetPA();
    } else if (paStrikes >= 3) {
      resetPA();
    }
  }

  const total = pitches.length;
  const fullInnings = Math.floor(outs / 3);
  const partialOuts = outs % 3;
  const battersFaced = vsL.batters + vsR.batters;
  const atBats = Math.max(0, battersFaced - walks - hitByPitch);

  return {
    totalPitches: total,
    strikes: totalStrikes,
    balls: totalBalls,
    calledStrikes,
    swingingStrikes,
    fouls,
    hitIntoPlay,
    hitByPitch,
    walks,
    strikePercent: total > 0 ? Math.round((totalStrikes / total) * 100) : 0,
    ballPercent: total > 0 ? Math.round((totalBalls / total) * 100) : 0,
    firstPitchStrikes,
    threeBallCounts,
    battersFaced,
    atBats,
    battersVsL: vsL.batters,
    battersVsR: vsR.batters,
    pitchesVsL: vsL.pitches,
    pitchesVsR: vsR.pitches,
    strikesVsL: vsL.strikes,
    strikesVsR: vsR.strikes,
    strikePercentVsL:
      vsL.pitches > 0 ? Math.round((vsL.strikes / vsL.pitches) * 100) : 0,
    strikePercentVsR:
      vsR.pitches > 0 ? Math.round((vsR.strikes / vsR.pitches) * 100) : 0,
    fastballCount,
    fastballStrikes,
    fastballStrikePercent:
      fastballCount > 0
        ? Math.round((fastballStrikes / fastballCount) * 100)
        : 0,
    breakingCount,
    breakingStrikes,
    breakingStrikePercent:
      breakingCount > 0
        ? Math.round((breakingStrikes / breakingCount) * 100)
        : 0,
    outs,
    innings: `${fullInnings}.${partialOuts}`,
    mandatoryRestDays: 0,
    // Backward-compat aliases
    hitBatters: hitByPitch,
    ballsInPlay: hitIntoPlay,
    runsAllowed: 0,
    rhbPitches: vsR.pitches,
    rhbStrikes: vsR.strikes,
    lhbPitches: vsL.pitches,
    lhbStrikes: vsL.strikes,
  };
}

// ── Summary: Training Sessions ────────────────────────────────────────────────

export function computeSessionSummary(pitches) {
  if (!pitches?.length) {
    return {
      totalPitches: 0,
      strikes: 0,
      balls: 0,
      strikePercent: 0,
      byPitchType: {},
    };
  }

  let strikes = 0;
  const byPitchType = {};

  for (const p of pitches) {
    const isStrike = p.outcome === 'strike';
    if (isStrike) strikes++;
    if (p.pitchType) {
      if (!byPitchType[p.pitchType]) {
        byPitchType[p.pitchType] = { count: 0, strikes: 0, strikePercent: 0 };
      }
      byPitchType[p.pitchType].count++;
      if (isStrike) byPitchType[p.pitchType].strikes++;
    }
  }

  for (const t of Object.values(byPitchType)) {
    t.strikePercent = t.count > 0 ? Math.round((t.strikes / t.count) * 100) : 0;
  }

  const total = pitches.length;
  return {
    totalPitches: total,
    strikes,
    balls: total - strikes,
    strikePercent: total > 0 ? Math.round((strikes / total) * 100) : 0,
    byPitchType,
  };
}

// ── Utility: calculateAge ─────────────────────────────────────────────────────

export function calculateAge(birthday) {
  if (!birthday) return 0;
  return getAgeOnDate(birthday, new Date().toISOString().slice(0, 10));
}

// ── Utility: calculateAvailability ───────────────────────────────────────────
//
// Compatibility wrapper for components that call:
//   calculateAvailability(pitcherId, birthday, organization)
//
// Returns a shape compatible with existing component code.

export async function calculateAvailability(pitcherId, birthday, organization) {
  const today = new Date().toISOString().slice(0, 10);
  const [outings, settings] = await Promise.all([
    getOutingsForPitcher(pitcherId),
    getSettings(),
  ]);

  const pitcher = { birthday };
  const preset = ORG_PRESETS[organization] ?? PITCH_SMART_PRESET;
  const result = calculateEligibility(
    pitcher,
    today,
    outings,
    preset,
    settings.customPitchRules
  );

  const pitchesToday = outings
    .filter((o) => o.date === today)
    .reduce((sum, o) => sum + (o.summary?.totalPitches ?? 0), 0);

  return {
    available: result.eligible,
    availablePitches: result.eligible
      ? Math.max(0, result.pitchLimit - pitchesToday)
      : 0,
    pitchesToday,
    mandatoryRestDays: result.restDaysRemaining,
    reason: result.reason,
    nextEligibleDate: result.nextEligibleDate,
    warning: result.consecutiveDayCapActive ? result.reason : null,
    age: calculateAge(birthday),
  };
}

// ── Utility: getPresetForTeam ─────────────────────────────────────────────────

export function getPresetForTeam(team) {
  return ORG_PRESETS[team?.organization] ?? PITCH_SMART_PRESET;
}

// ── Utility: getStrikeColor ───────────────────────────────────────────────────

export function getStrikeColor(percentage, settings) {
  const red = settings?.redThreshold ?? 50;
  const yellow = settings?.yellowThreshold ?? 65;
  if (percentage < red) return { bg: '#DC3545', text: 'white' };
  if (percentage < yellow) return { bg: '#FFC107', text: 'black' };
  return { bg: '#28A745', text: 'white' };
}

// ── Date utilities ────────────────────────────────────────────────────────────

export function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

export function getDateDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

// ── Aliases: Game Outings ─────────────────────────────────────────────────────
// GamePage uses createGameOuting instead of createOuting

export const createGameOuting = createOuting;

export async function getOutingsForPitcherInRange(
  pitcherId,
  startDate,
  endDate
) {
  const outings = await getOutingsForPitcher(pitcherId);
  return outings.filter((o) => o.date >= startDate && o.date <= endDate);
}

// Sync — GamePage calls without await: computeMandatoryRestForOuting(totalPitches, age, organization)
export function computeMandatoryRestForOuting(totalPitches, age, organization) {
  if (!totalPitches) return 0;
  const preset = ORG_PRESETS[organization] ?? PITCH_SMART_PRESET;
  return getRestDaysRequired(totalPitches, age, preset, null);
}

// ── Aliases: Training Sessions ────────────────────────────────────────────────
// TrainingPage uses createTrainingSession instead of createSession

export const createTrainingSession = createSession;

// ── Aliases: Drafts ───────────────────────────────────────────────────────────
// GamePage and TrainingPage use deleteDraft / getDraft

export const deleteDraft = clearDraft;

export async function getDraft(type) {
  const record = await txGet('drafts', type);
  return record?.data ?? null;
}
