/**
 * Training Sessions collection
 * 
 * One record per training session. Advisory only —
 * does NOT count toward pitch count limits or rest day calculations.
 * 
 * Raw pitchData is NOT stored permanently. Only the computed summary.
 */

import { generateId } from './uuid.js';
import { getById, put, deleteById, getAllByIndex, getAllByRange, deleteAllByIndex, count } from './db.js';

const STORE = 'trainingSessions';

/**
 * Create a training session record.
 * Called when "Save & Done" is tapped after a session.
 */
export async function createTrainingSession({ pitcherId, teamId = null, date, targetPitches, summary, coachNotes = null }) {
  if (!pitcherId) throw new Error('pitcherId is required');
  if (!date) throw new Error('date is required');
  if (!summary) throw new Error('summary is required');

  const record = {
    id: generateId(),
    pitcherId,
    teamId,
    date,
    targetPitches: targetPitches || 25,
    summary: {
      totalPitches: summary.totalPitches || 0,
      strikePercent: summary.strikePercent || 0,
      byPitchType: summary.byPitchType || {},
      // byPitchType shape: { "4-Seam": { count: 10, strikes: 7, strikePercent: 70 }, ... }
    },
    coachNotes: coachNotes ? coachNotes.slice(0, 500) : null,
    createdAt: new Date().toISOString(),
  };

  await put(STORE, record);
  return record;
}

/**
 * Get a single session by ID.
 */
export async function getTrainingSession(id) {
  return getById(STORE, id);
}

/**
 * Get all sessions for a pitcher, sorted by date descending.
 */
export async function getSessionsForPitcher(pitcherId) {
  const sessions = await getAllByIndex(STORE, 'pitcherId', pitcherId);
  return sessions.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Get the last N sessions for a pitcher.
 */
export async function getLastNSessions(pitcherId, n) {
  const sessions = await getSessionsForPitcher(pitcherId);
  return sessions.slice(0, n);
}

/**
 * Get sessions for a pitcher within a date range.
 */
export async function getSessionsInRange(pitcherId, startDate, endDate) {
  // Get all for pitcher, then filter by date range
  const sessions = await getAllByIndex(STORE, 'pitcherId', pitcherId);
  return sessions
    .filter((s) => s.date >= startDate && s.date <= endDate)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Get training pitch count for a pitcher within the last N days.
 * Used for advisory display: "Training last 3 days: 45 pitches"
 */
export async function getTrainingPitchesInLastDays(pitcherId, days) {
  const today = new Date();
  const start = new Date();
  start.setDate(today.getDate() - days);
  const startDate = start.toISOString().split('T')[0];
  const endDate = today.toISOString().split('T')[0];

  const sessions = await getSessionsInRange(pitcherId, startDate, endDate);
  return sessions.reduce((sum, s) => sum + (s.summary.totalPitches || 0), 0);
}

/**
 * Count sessions for a pitcher.
 */
export async function countSessionsForPitcher(pitcherId) {
  return count(STORE, 'pitcherId', pitcherId);
}

/**
 * Delete a single session.
 */
export async function deleteTrainingSession(id) {
  return deleteById(STORE, id);
}

/**
 * Delete all sessions for a pitcher.
 */
export async function deleteSessionsForPitcher(pitcherId) {
  return deleteAllByIndex(STORE, 'pitcherId', pitcherId);
}
