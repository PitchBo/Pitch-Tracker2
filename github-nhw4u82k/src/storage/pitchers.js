/**
 * Pitcher collection operations
 * 
 * The pitcher record is the canonical player identity. It exists
 * independently of any team. Contains only WHO the player is —
 * not what they've done (that's in gameOutings and trainingSessions).
 */

import { generateId } from './uuid.js';
import { getById, getAll, put, deleteById, deleteAllByIndex } from './db.js';

const STORE = 'pitchers';

const VALID_THROWING_HANDS = ['L', 'R'];
const VALID_PITCH_TYPES = [
  '4-Seam', '2-Seam', 'Curve', 'Slider',
  'Change', 'Splitter', 'Cutter', 'Knuckle'
];

/**
 * Calculate age from birthday string.
 * Always derive age — never store it.
 */
export function calculateAge(birthday) {
  const today = new Date();
  const birth = new Date(birthday);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

/**
 * Validate pitcher data before save.
 * Returns { valid: boolean, errors: string[] }
 */
function validate(data) {
  const errors = [];

  if (!data.fullName || typeof data.fullName !== 'string' || data.fullName.trim().length === 0) {
    errors.push('Full name is required');
  }

  if (!data.birthday || isNaN(new Date(data.birthday).getTime())) {
    errors.push('Valid birthday is required');
  }

  if (!VALID_THROWING_HANDS.includes(data.throwingHand)) {
    errors.push('Throwing hand must be L or R');
  }

  if (data.pitchArsenal && Array.isArray(data.pitchArsenal)) {
    const invalid = data.pitchArsenal.filter((p) => !VALID_PITCH_TYPES.includes(p));
    if (invalid.length > 0) {
      errors.push(`Invalid pitch types: ${invalid.join(', ')}`);
    }
  }

  if (data.notes && typeof data.notes === 'string' && data.notes.length > 500) {
    errors.push('Notes must be 500 characters or fewer');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Create a new pitcher.
 * Returns the created pitcher record with generated ID and timestamps.
 */
export async function createPitcher({ fullName, birthday, throwingHand, pitchArsenal = [], playerPhone = null, notes = null }) {
  const data = { fullName, birthday, throwingHand, pitchArsenal, playerPhone, notes };
  const { valid, errors } = validate(data);
  if (!valid) {
    throw new Error(`Invalid pitcher data: ${errors.join('; ')}`);
  }

  const now = new Date().toISOString();
  const record = {
    id: generateId(),
    fullName: fullName.trim(),
    birthday,
    throwingHand,
    pitchArsenal: pitchArsenal.filter((p) => VALID_PITCH_TYPES.includes(p)),
    playerPhone: playerPhone || null,
    notes: notes ? notes.slice(0, 500) : null,
    createdAt: now,
    updatedAt: now,
  };

  await put(STORE, record);
  return record;
}

/**
 * Get a pitcher by ID.
 * Returns the record or null.
 */
export async function getPitcher(id) {
  return getById(STORE, id);
}

/**
 * Get all pitchers.
 */
export async function getAllPitchers() {
  return getAll(STORE);
}

/**
 * Update an existing pitcher. Merges provided fields with existing record.
 * Returns the updated record.
 */
export async function updatePitcher(id, updates) {
  const existing = await getById(STORE, id);
  if (!existing) {
    throw new Error(`Pitcher not found: ${id}`);
  }

  const merged = { ...existing, ...updates, id: existing.id, createdAt: existing.createdAt };
  const { valid, errors } = validate(merged);
  if (!valid) {
    throw new Error(`Invalid pitcher data: ${errors.join('; ')}`);
  }

  merged.updatedAt = new Date().toISOString();
  if (merged.fullName) merged.fullName = merged.fullName.trim();
  if (merged.notes) merged.notes = merged.notes.slice(0, 500);

  await put(STORE, merged);
  return merged;
}

/**
 * Delete a pitcher and ALL associated data (gameOutings + trainingSessions).
 * Returns { deletedOutings, deletedSessions }.
 */
export async function deletePitcher(id) {
  const deletedOutings = await deleteAllByIndex('gameOutings', 'pitcherId', id);
  const deletedSessions = await deleteAllByIndex('trainingSessions', 'pitcherId', id);
  await deleteById(STORE, id);
  return { deletedOutings, deletedSessions };
}

/**
 * Delete only stats (gameOutings + trainingSessions) for a pitcher,
 * keeping the pitcher identity record intact.
 * Returns { deletedOutings, deletedSessions }.
 */
export async function deletePitcherStats(id) {
  const existing = await getById(STORE, id);
  if (!existing) {
    throw new Error(`Pitcher not found: ${id}`);
  }

  const deletedOutings = await deleteAllByIndex('gameOutings', 'pitcherId', id);
  const deletedSessions = await deleteAllByIndex('trainingSessions', 'pitcherId', id);
  return { deletedOutings, deletedSessions };
}

/**
 * Export: valid pitch types list (for UI dropdowns).
 */
export { VALID_PITCH_TYPES, VALID_THROWING_HANDS };
