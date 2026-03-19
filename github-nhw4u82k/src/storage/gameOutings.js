/**
 * Game Outings collection
 * 
 * One record per pitcher per game appearance. This is the pitch-count
 * enforcement source of truth. The availability engine queries this
 * collection across ALL teams for a given pitcher.
 * 
 * Raw pitchData is NOT stored permanently (per design decision).
 * Only the computed summary is persisted.
 */

import { generateId } from './uuid.js';
import { getById, getAll, put, deleteById, getAllByIndex, getAllByRange, deleteAllByIndex, count } from './db.js';

const STORE = 'gameOutings';

/**
 * Create a game outing record.
 * Called when a pitcher's outing ends (either mid-game pitcher change or end of game).
 * 
 * @param {Object} params
 * @param {string} params.pitcherId - FK to pitchers
 * @param {string} params.teamId - FK to teams
 * @param {string} params.date - ISO date string (YYYY-MM-DD, no time)
 * @param {Object} params.summary - Pre-computed summary stats
 * @param {boolean} params.overrideWarning - True if coach overrode availability warning
 */
export async function createGameOuting({ pitcherId, teamId, date, summary, overrideWarning = false }) {
  if (!pitcherId) throw new Error('pitcherId is required');
  if (!teamId) throw new Error('teamId is required');
  if (!date) throw new Error('date is required');
  if (!summary) throw new Error('summary is required');
  if (!summary.totalPitches || summary.totalPitches < 1) throw new Error('summary.totalPitches must be at least 1');

  const record = {
    id: generateId(),
    pitcherId,
    teamId,
    date, // ISO date string: "2026-03-16"
    summary: {
      totalPitches: summary.totalPitches || 0,
      strikes: summary.strikes || 0,
      balls: summary.balls || 0,
      strikePercent: summary.strikePercent || 0,
      ballPercent: summary.ballPercent || 0,
      innings: summary.innings || '0',
      outs: summary.outs || 0,
      battersFaced: summary.battersFaced || 0,
      atBats: summary.atBats || 0,
      walks: summary.walks || 0,
      walkPercent: summary.walkPercent || 0,
      hitBatters: summary.hitBatters || 0,
      firstPitchStrikes: summary.firstPitchStrikes || 0,
      firstPitchStrikePercent: summary.firstPitchStrikePercent || 0,
      threeBallCounts: summary.threeBallCounts || 0,
      ballsInPlay: summary.ballsInPlay || 0,
      swingingStrikes: summary.swingingStrikes || 0,
      calledStrikes: summary.calledStrikes || 0,
      fastballCount: summary.fastballCount || 0,
      fastballStrikePercent: summary.fastballStrikePercent || 0,
      breakingCount: summary.breakingCount || 0,
      breakingStrikePercent: summary.breakingStrikePercent || 0,
      rhbPitches: summary.rhbPitches || 0,
      rhbStrikes: summary.rhbStrikes || 0,
      rhbStrikePercent: summary.rhbStrikePercent || 0,
      lhbPitches: summary.lhbPitches || 0,
      lhbStrikes: summary.lhbStrikes || 0,
      lhbStrikePercent: summary.lhbStrikePercent || 0,
      runsAllowed: summary.runsAllowed || 0,
      mandatoryRestDays: summary.mandatoryRestDays || 0,
    },
    overrideWarning,
    createdAt: new Date().toISOString(),
  };

  await put(STORE, record);
  return record;
}

/**
 * Get a single outing by ID.
 */
export async function getGameOuting(id) {
  return getById(STORE, id);
}

/**
 * Get all outings for a pitcher (across all teams).
 * Sorted by date descending (most recent first).
 */
export async function getOutingsForPitcher(pitcherId) {
  const outings = await getAllByIndex(STORE, 'pitcherId', pitcherId);
  return outings.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Get all outings for a team.
 * Sorted by date descending.
 */
export async function getOutingsForTeam(teamId) {
  const outings = await getAllByIndex(STORE, 'teamId', teamId);
  return outings.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Get all outings for a pitcher within a date range.
 * Used for rest day calculations and season stats.
 * 
 * @param {string} pitcherId
 * @param {string} startDate - ISO date string (inclusive)
 * @param {string} endDate - ISO date string (inclusive)
 */
export async function getOutingsForPitcherInRange(pitcherId, startDate, endDate) {
  // Use the compound index for efficient lookup
  const outings = await getAllByRange(STORE, 'pitcherDate', [pitcherId, startDate], [pitcherId, endDate]);
  return outings.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Get all outings within a date range (any pitcher).
 */
export async function getOutingsInDateRange(startDate, endDate) {
  return getAllByRange(STORE, 'date', startDate, endDate);
}

/**
 * Get the most recent outing for a pitcher.
 */
export async function getLastOuting(pitcherId) {
  const outings = await getOutingsForPitcher(pitcherId);
  return outings.length > 0 ? outings[0] : null;
}

/**
 * Get the last N outings for a pitcher.
 */
export async function getLastNOutings(pitcherId, n) {
  const outings = await getOutingsForPitcher(pitcherId);
  return outings.slice(0, n);
}

/**
 * Count outings for a pitcher.
 */
export async function countOutingsForPitcher(pitcherId) {
  return count(STORE, 'pitcherId', pitcherId);
}

/**
 * Delete a single outing.
 */
export async function deleteGameOuting(id) {
  return deleteById(STORE, id);
}

/**
 * Delete all outings for a pitcher.
 * Returns the number of deleted records.
 */
export async function deleteOutingsForPitcher(pitcherId) {
  return deleteAllByIndex(STORE, 'pitcherId', pitcherId);
}

/**
 * Get today's ISO date string (no time component).
 */
export function getTodayDate() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * Get an ISO date string for N days ago.
 */
export function getDateDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}
