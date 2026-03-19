/**
 * App Settings (singleton) and Draft Sessions (pause/resume)
 */

import { getById, put, deleteById, getAll } from './db.js';

// ─── App Settings ───────────────────────────────────────────────

const SETTINGS_STORE = 'appSettings';
const SETTINGS_KEY = 'settings';

const DEFAULT_SETTINGS = {
  key: SETTINGS_KEY,
  schemaVersion: 1,
  redThreshold: 50,
  yellowThreshold: 65,
  customPitchRules: null,
  seasonStartDate: `${new Date().getFullYear()}-01-01`,
  trainingHistoryCount: 5,
};

/**
 * Get app settings. Returns defaults if none saved.
 */
export async function getSettings() {
  const stored = await getById(SETTINGS_STORE, SETTINGS_KEY);
  if (!stored) {
    return { ...DEFAULT_SETTINGS };
  }
  // Merge with defaults to pick up any new fields added in future versions
  return { ...DEFAULT_SETTINGS, ...stored, key: SETTINGS_KEY };
}

/**
 * Update app settings. Merges with existing.
 * Validates thresholds before saving.
 */
export async function updateSettings(updates) {
  const current = await getSettings();
  const merged = { ...current, ...updates, key: SETTINGS_KEY };

  // Validate thresholds
  if (merged.redThreshold >= merged.yellowThreshold) {
    throw new Error('Red threshold must be lower than yellow threshold');
  }
  if (merged.redThreshold < 0 || merged.redThreshold > 100) {
    throw new Error('Red threshold must be between 0 and 100');
  }
  if (merged.yellowThreshold < 0 || merged.yellowThreshold > 100) {
    throw new Error('Yellow threshold must be between 0 and 100');
  }

  // Validate custom pitch rules if present
  if (merged.customPitchRules) {
    validateCustomPitchRules(merged.customPitchRules);
  }

  // Validate training history count
  if (merged.trainingHistoryCount < 1) {
    throw new Error('Training history count must be at least 1');
  }

  await put(SETTINGS_STORE, merged);
  return merged;
}

/**
 * Reset settings to defaults.
 */
export async function resetSettings() {
  const defaults = { ...DEFAULT_SETTINGS, seasonStartDate: `${new Date().getFullYear()}-01-01` };
  await put(SETTINGS_STORE, defaults);
  return defaults;
}

/**
 * Validate custom pitch rules structure.
 * Throws on invalid data.
 */
function validateCustomPitchRules(rules) {
  if (!rules.dailyLimits || !Array.isArray(rules.dailyLimits) || rules.dailyLimits.length === 0) {
    throw new Error('Custom rules must have at least one daily limit entry');
  }
  if (!rules.restDays || !Array.isArray(rules.restDays) || rules.restDays.length === 0) {
    throw new Error('Custom rules must have at least one rest day entry');
  }

  // Validate daily limits
  let prevAge = -1;
  for (const limit of rules.dailyLimits) {
    if (typeof limit.maxAge !== 'number' || limit.maxAge <= 0) {
      throw new Error('Daily limit maxAge must be a positive number');
    }
    if (typeof limit.pitches !== 'number' || limit.pitches <= 0) {
      throw new Error('Daily limit pitches must be a positive number');
    }
    if (limit.maxAge <= prevAge) {
      throw new Error('Daily limit maxAge values must be in ascending order with no duplicates');
    }
    prevAge = limit.maxAge;
  }

  // Warn (not error) if highest maxAge is too low
  const highestAge = rules.dailyLimits[rules.dailyLimits.length - 1].maxAge;
  if (highestAge < 18) {
    console.warn(`⚠️ Highest daily limit maxAge is ${highestAge}. Pitchers older than this will use the last bracket.`);
  }

  // Validate rest days
  let prevPitches = -1;
  for (const rest of rules.restDays) {
    if (typeof rest.maxPitches !== 'number' || rest.maxPitches <= 0) {
      throw new Error('Rest day maxPitches must be a positive number');
    }
    if (typeof rest.days !== 'number' || rest.days < 0) {
      throw new Error('Rest days must be a non-negative number');
    }
    if (rest.maxPitches <= prevPitches) {
      throw new Error('Rest day maxPitches values must be in ascending order with no duplicates');
    }
    prevPitches = rest.maxPitches;
  }
}

/**
 * Get strike percentage color based on current thresholds.
 * Returns { bg, text } color strings.
 */
export function getStrikeColor(percentage, settings) {
  const red = settings?.redThreshold ?? DEFAULT_SETTINGS.redThreshold;
  const yellow = settings?.yellowThreshold ?? DEFAULT_SETTINGS.yellowThreshold;

  if (percentage < red) return { bg: '#DC3545', text: 'white', zone: 'red' };
  if (percentage < yellow) return { bg: '#FFC107', text: 'black', zone: 'yellow' };
  return { bg: '#28A745', text: 'white', zone: 'green' };
}

// ─── Draft Sessions (pause/resume) ──────────────────────────────

const DRAFT_STORE = 'draftSessions';
const DRAFT_EXPIRY_HOURS = 24;

/**
 * Save a draft session (game or training).
 * Only one of each type can exist at a time.
 * 
 * @param {"game"|"training"} type
 * @param {Object} state - Full session state to serialize
 * @param {string} teamId - For display on resume prompt
 * @param {string} pitcherName - Denormalized for display
 * @param {number} pitchCount - Current pitch count for display
 */
export async function saveDraft(type, { state, teamId, pitcherName, pitchCount }) {
  if (type !== 'game' && type !== 'training') {
    throw new Error('Draft type must be "game" or "training"');
  }

  const record = {
    key: type,
    type,
    state,
    teamId,
    pitcherName,
    pitchCount,
    pausedAt: new Date().toISOString(),
  };

  await put(DRAFT_STORE, record);
  return record;
}

/**
 * Get a draft session by type. Returns null if none exists or if expired.
 */
export async function getDraft(type) {
  const draft = await getById(DRAFT_STORE, type);
  if (!draft) return null;

  // Check expiry
  const pausedAt = new Date(draft.pausedAt);
  const now = new Date();
  const hoursSincePause = (now - pausedAt) / (1000 * 60 * 60);

  if (hoursSincePause > DRAFT_EXPIRY_HOURS) {
    // Expired — clean up silently
    await deleteById(DRAFT_STORE, type);
    return null;
  }

  return draft;
}

/**
 * Delete a draft session (after resume or discard).
 */
export async function deleteDraft(type) {
  await deleteById(DRAFT_STORE, type);
}

/**
 * Get all active (non-expired) drafts.
 * Returns { game: draft|null, training: draft|null }
 */
export async function getAllDrafts() {
  const game = await getDraft('game');
  const training = await getDraft('training');
  return { game, training };
}

export { DEFAULT_SETTINGS, DRAFT_EXPIRY_HOURS };
