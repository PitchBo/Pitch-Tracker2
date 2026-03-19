/**
 * Teams collection operations
 * 
 * Teams hold roster assignments (pitcherIds[]) and organization info
 * that determines which pitch count ruleset applies.
 * 
 * The team references pitchers — pitchers don't reference teams.
 * Max 5 teams. Max 15 pitchers per team.
 */

import { generateId } from './uuid.js';
import { getById, getAll, put, deleteById } from './db.js';

const STORE = 'teams';
const MAX_TEAMS = 5;
const MAX_PITCHERS_PER_TEAM = 15;

const VALID_ORGANIZATIONS = [
  'USA Baseball',
  'MLB/Pitch Smart',
  'Little League Baseball',
  'PONY Baseball',
  'Babe Ruth League/Cal Ripken',
  'American Legion Baseball',
  'USSSA',
  'NFHS',
  'AAU Baseball',
  'AABC',
  'NABF',
  'Dixie Youth Baseball',
  'Perfect Game',
  'Game Day USA',
];

/**
 * Validate team data before save.
 */
function validate(data, existingTeams = [], selfId = null) {
  const errors = [];

  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.push('Team name is required');
  }

  if (!VALID_ORGANIZATIONS.includes(data.organization)) {
    errors.push(`Invalid organization. Must be one of: ${VALID_ORGANIZATIONS.join(', ')}`);
  }

  if (!data.ageGroup || typeof data.ageGroup !== 'string' || data.ageGroup.trim().length === 0) {
    errors.push('Age group is required');
  }

  // Check team limit (only for new teams)
  if (!selfId && existingTeams.length >= MAX_TEAMS) {
    errors.push(`Maximum ${MAX_TEAMS} teams allowed`);
  }

  // Check pitcher limit
  if (data.pitcherIds && data.pitcherIds.length > MAX_PITCHERS_PER_TEAM) {
    errors.push(`Maximum ${MAX_PITCHERS_PER_TEAM} pitchers per team`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Create a new team.
 */
export async function createTeam({ name, organization, ageGroup, coach1Name = null, coach1Phone = null, coach2Name = null, coach2Phone = null, pitcherIds = [] }) {
  const existingTeams = await getAll(STORE);

  const data = { name, organization, ageGroup, pitcherIds, coach1Name, coach1Phone, coach2Name, coach2Phone };
  const { valid, errors } = validate(data, existingTeams);
  if (!valid) {
    throw new Error(`Invalid team data: ${errors.join('; ')}`);
  }

  const now = new Date().toISOString();
  const record = {
    id: generateId(),
    name: name.trim(),
    organization,
    ageGroup: ageGroup.trim(),
    coach1Name: coach1Name || null,
    coach1Phone: coach1Phone || null,
    coach2Name: coach2Name || null,
    coach2Phone: coach2Phone || null,
    pitcherIds: [...new Set(pitcherIds)], // Deduplicate
    createdAt: now,
    updatedAt: now,
  };

  await put(STORE, record);
  return record;
}

/**
 * Get a team by ID.
 */
export async function getTeam(id) {
  return getById(STORE, id);
}

/**
 * Get all teams.
 */
export async function getAllTeams() {
  return getAll(STORE);
}

/**
 * Update an existing team.
 */
export async function updateTeam(id, updates) {
  const existing = await getById(STORE, id);
  if (!existing) {
    throw new Error(`Team not found: ${id}`);
  }

  const merged = { ...existing, ...updates, id: existing.id, createdAt: existing.createdAt };
  const { valid, errors } = validate(merged, [], id);
  if (!valid) {
    throw new Error(`Invalid team data: ${errors.join('; ')}`);
  }

  merged.updatedAt = new Date().toISOString();
  if (merged.name) merged.name = merged.name.trim();
  if (merged.ageGroup) merged.ageGroup = merged.ageGroup.trim();
  if (merged.pitcherIds) merged.pitcherIds = [...new Set(merged.pitcherIds)];

  await put(STORE, merged);
  return merged;
}

/**
 * Delete a team. Does NOT delete pitchers or their stats.
 * Pitchers become unassigned.
 */
export async function deleteTeam(id) {
  await deleteById(STORE, id);
}

/**
 * Add a pitcher to a team's roster.
 */
export async function addPitcherToTeam(teamId, pitcherId) {
  const team = await getById(STORE, teamId);
  if (!team) throw new Error(`Team not found: ${teamId}`);

  if (team.pitcherIds.includes(pitcherId)) {
    return team; // Already assigned
  }

  if (team.pitcherIds.length >= MAX_PITCHERS_PER_TEAM) {
    throw new Error(`Team roster full (${MAX_PITCHERS_PER_TEAM} max)`);
  }

  team.pitcherIds = [...team.pitcherIds, pitcherId];
  team.updatedAt = new Date().toISOString();
  await put(STORE, team);
  return team;
}

/**
 * Remove a pitcher from a team's roster.
 * Does NOT delete the pitcher record or their stats.
 */
export async function removePitcherFromTeam(teamId, pitcherId) {
  const team = await getById(STORE, teamId);
  if (!team) throw new Error(`Team not found: ${teamId}`);

  team.pitcherIds = team.pitcherIds.filter((id) => id !== pitcherId);
  team.updatedAt = new Date().toISOString();
  await put(STORE, team);
  return team;
}

/**
 * Find all teams that a pitcher is assigned to.
 * Returns an array of team records.
 */
export async function getTeamsForPitcher(pitcherId) {
  const allTeams = await getAll(STORE);
  return allTeams.filter((t) => t.pitcherIds.includes(pitcherId));
}

/**
 * Find all pitchers not assigned to any team.
 * Takes the full pitcher list and returns unassigned ones.
 */
export async function getUnassignedPitcherIds(allPitcherIds) {
  const allTeams = await getAll(STORE);
  const assignedIds = new Set(allTeams.flatMap((t) => t.pitcherIds));
  return allPitcherIds.filter((id) => !assignedIds.has(id));
}

export { VALID_ORGANIZATIONS, MAX_TEAMS, MAX_PITCHERS_PER_TEAM };
