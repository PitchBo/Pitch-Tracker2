/**
 * Game State Machine
 *
 * Single source of truth for all game state transitions.
 *
 * KEY DESIGN DECISIONS:
 * - Count (balls/strikes/batterHand) lives in GAME state, not pitcher state
 * - Outs at game level = current inning only (0-2, resets on inning change)
 *   outsRecorded at pitcher level = cumulative for that pitcher
 * - FPS denominator is battersFaced (includes walks and HBP)
 * - Bases loaded + BALL_IN_PLAY prompts for runs scored
 * - HBP is a first-class event
 * - Fastball/breaking pitch category tracked per pitch
 */

// ─── Initial State Factories ────────────────────────────────────

export function createGameState(teamId) {
  return {
    teamId,
    gameDate: new Date().toISOString().split('T')[0],
    inning: 1,
    outs: 0,
    runnersOnBase: 0,
    runsScored: 0,
    runsThisInning: 0,
    currentPitcherId: null,
    batterHand: null,
    balls: 0,
    strikes: 0,
    completedOutings: [],
    phase: 'selectPitcher',
  };
}

export function createPitcherOuting(pitcherId) {
  return {
    pitcherId,
    pitches: [],
    battersFaced: 0,
    atBats: 0,
    ballsInPlay: 0,
    firstPitchStrikes: 0,
    threeBallCounts: 0,
    walks: 0,
    hitBatters: 0,
    runsAllowed: 0,
    outsRecorded: 0,
    swingingStrikes: 0,
    calledStrikes: 0,
    fastballCount: 0,
    fastballStrikes: 0,
    breakingCount: 0,
    breakingStrikes: 0,
    rhbPitches: 0,
    rhbStrikes: 0,
    lhbPitches: 0,
    lhbStrikes: 0,
    isFirstPitchOfAtBat: true,
    firstPitchWasStrike: false,
  };
}

// ─── Event Types ────────────────────────────────────────────────

export const EVENTS = {
  BALL: 'BALL',
  STRIKE_CALLED: 'STRIKE_CALLED',
  STRIKE_SWINGING: 'STRIKE_SWINGING',
  FOUL: 'FOUL',
  BALL_IN_PLAY: 'BALL_IN_PLAY',
  HIT_BY_PITCH: 'HIT_BY_PITCH',
  OUT_ON_PITCH: 'OUT_ON_PITCH',
  OUT_NON_PITCH: 'OUT_NON_PITCH',
  UNDO: 'UNDO',
  SET_BATTER_HAND: 'SET_BATTER_HAND',
  SELECT_PITCHER: 'SELECT_PITCHER',
  END_OUTING: 'END_OUTING',
  END_INNING: 'END_INNING',
  END_GAME: 'END_GAME',
  SCORE_RUNS: 'SCORE_RUNS',
};

// ─── Result Types (for UI to handle) ────────────────────────────

export const PROMPTS = {
  STRIKEOUT: 'STRIKEOUT',
  END_OF_INNING: 'END_OF_INNING',
  RUNS_SCORED: 'RUNS_SCORED',
  WALK_BASES_LOADED: 'WALK_BASES_LOADED',
};

// ─── Main State Machine ─────────────────────────────────────────

export function processEvent(event, game, outing, payload = {}) {
  let g = { ...game };
  let o = outing ? { ...outing, pitches: [...(outing.pitches || [])] } : null;
  let prompt = null;

  switch (event) {
    case EVENTS.SET_BATTER_HAND: {
      g.batterHand = payload.hand;
      return { game: g, outing: o, prompt: null };
    }

    case EVENTS.SELECT_PITCHER: {
      g.currentPitcherId = payload.pitcherId;
      g.phase = 'tracking';
      o = createPitcherOuting(payload.pitcherId);
      return { game: g, outing: o, prompt: null };
    }

    case EVENTS.BALL: {
      if (!g.batterHand)
        return {
          game: g,
          outing: o,
          prompt: null,
          error: 'Select batter handedness first',
        };

      o.pitches.push({
        outcome: 'ball',
        batterHand: g.batterHand,
        pitchCategory: payload.pitchCategory || null,
        inning: g.inning,
        timestamp: Date.now(),
      });

      updatePitchCategoryCounts(o, payload.pitchCategory, false);
      updateHandednessCounts(o, g.batterHand, false);

      if (o.isFirstPitchOfAtBat) {
        o.isFirstPitchOfAtBat = false;
        o.firstPitchWasStrike = false;
      }

      g.balls++;

      if (g.balls >= 4) {
        o.battersFaced++;
        o.walks++;
        if (g.balls >= 3) o.threeBallCounts++;
        if (o.firstPitchWasStrike) o.firstPitchStrikes++;

        if (g.runnersOnBase >= 3) {
          prompt = PROMPTS.WALK_BASES_LOADED;
          return { game: g, outing: o, prompt };
        }

        g.runnersOnBase = Math.min(3, g.runnersOnBase + 1);
        resetAtBat(g, o);
      }

      return { game: g, outing: o, prompt };
    }

    case EVENTS.STRIKE_CALLED: {
      if (!g.batterHand)
        return {
          game: g,
          outing: o,
          prompt: null,
          error: 'Select batter handedness first',
        };

      o.pitches.push({
        outcome: 'strike',
        strikeType: 'called',
        batterHand: g.batterHand,
        pitchCategory: payload.pitchCategory || null,
        inning: g.inning,
        timestamp: Date.now(),
      });

      updatePitchCategoryCounts(o, payload.pitchCategory, true);
      updateHandednessCounts(o, g.batterHand, true);
      o.calledStrikes++;

      if (o.isFirstPitchOfAtBat) {
        o.isFirstPitchOfAtBat = false;
        o.firstPitchWasStrike = true;
      }

      g.strikes++;
      if (g.strikes >= 3) prompt = PROMPTS.STRIKEOUT;

      return { game: g, outing: o, prompt };
    }

    case EVENTS.STRIKE_SWINGING: {
      if (!g.batterHand)
        return {
          game: g,
          outing: o,
          prompt: null,
          error: 'Select batter handedness first',
        };

      o.pitches.push({
        outcome: 'strike',
        strikeType: 'swinging',
        batterHand: g.batterHand,
        pitchCategory: payload.pitchCategory || null,
        inning: g.inning,
        timestamp: Date.now(),
      });

      updatePitchCategoryCounts(o, payload.pitchCategory, true);
      updateHandednessCounts(o, g.batterHand, true);
      o.swingingStrikes++;

      if (o.isFirstPitchOfAtBat) {
        o.isFirstPitchOfAtBat = false;
        o.firstPitchWasStrike = true;
      }

      g.strikes++;
      if (g.strikes >= 3) prompt = PROMPTS.STRIKEOUT;

      return { game: g, outing: o, prompt };
    }

    case EVENTS.FOUL: {
      if (!g.batterHand)
        return {
          game: g,
          outing: o,
          prompt: null,
          error: 'Select batter handedness first',
        };

      o.pitches.push({
        outcome: 'foul',
        batterHand: g.batterHand,
        pitchCategory: payload.pitchCategory || null,
        inning: g.inning,
        timestamp: Date.now(),
      });

      updatePitchCategoryCounts(o, payload.pitchCategory, true);
      updateHandednessCounts(o, g.batterHand, true);
      o.swingingStrikes++;

      if (o.isFirstPitchOfAtBat) {
        o.isFirstPitchOfAtBat = false;
        o.firstPitchWasStrike = true;
      }

      if (g.strikes < 2) g.strikes++;
      // foul on 2 strikes: batter stays alive, count unchanged

      return { game: g, outing: o, prompt: null };
    }

    case EVENTS.BALL_IN_PLAY: {
      if (!g.batterHand)
        return {
          game: g,
          outing: o,
          prompt: null,
          error: 'Select batter handedness first',
        };

      o.pitches.push({
        outcome: 'ballInPlay',
        batterHand: g.batterHand,
        pitchCategory: payload.pitchCategory || null,
        inning: g.inning,
        timestamp: Date.now(),
      });

      updatePitchCategoryCounts(o, payload.pitchCategory, true);
      updateHandednessCounts(o, g.batterHand, true);

      o.ballsInPlay++;
      o.battersFaced++;
      o.atBats++;
      // Credit FPS if first pitch was a strike-type OR if this BIP is the first pitch
      // (a ball in play counts as a strike in totals, so it qualifies as a first-pitch strike)
      if (o.firstPitchWasStrike || o.isFirstPitchOfAtBat) o.firstPitchStrikes++;
      if (g.balls >= 3) o.threeBallCounts++;

      // Snapshot runners BEFORE adding the batter so we know if bases were loaded
      const runnersBeforePlay = g.runnersOnBase;

      // Batter becomes a runner
      g.runnersOnBase = Math.min(3, g.runnersOnBase + 1);

      resetAtBat(g, o);

      // If bases were loaded before the play, prompt for how many runs scored
      // (payload.runsScored can bypass the prompt when called from SCORE_RUNS resolution)
      if (runnersBeforePlay >= 3 && payload.runsScored === undefined) {
        prompt = PROMPTS.RUNS_SCORED;
        return { game: g, outing: o, prompt };
      }

      // Runs provided directly (e.g. re-entry from SCORE_RUNS event)
      if (payload.runsScored !== undefined) {
        const runs = payload.runsScored;
        g.runsScored += runs;
        g.runsThisInning += runs;
        o.runsAllowed += runs;
        g.runnersOnBase = Math.max(0, g.runnersOnBase - runs);
      }

      return { game: g, outing: o, prompt: null };
    }

    case EVENTS.HIT_BY_PITCH: {
      if (!g.batterHand)
        return {
          game: g,
          outing: o,
          prompt: null,
          error: 'Select batter handedness first',
        };

      o.pitches.push({
        outcome: 'hitByPitch',
        batterHand: g.batterHand,
        pitchCategory: payload.pitchCategory || null,
        inning: g.inning,
        timestamp: Date.now(),
      });

      updatePitchCategoryCounts(o, payload.pitchCategory, false);
      updateHandednessCounts(o, g.batterHand, false);

      o.hitBatters++;
      o.battersFaced++;
      if (o.firstPitchWasStrike) o.firstPitchStrikes++;
      if (g.balls >= 3) o.threeBallCounts++;

      if (g.runnersOnBase >= 3) {
        prompt = PROMPTS.RUNS_SCORED;
        g.runnersOnBase = Math.min(3, g.runnersOnBase + 1);
        resetAtBat(g, o);
        return { game: g, outing: o, prompt };
      }

      g.runnersOnBase = Math.min(3, g.runnersOnBase + 1);
      resetAtBat(g, o);
      return { game: g, outing: o, prompt: null };
    }

    case EVENTS.OUT_ON_PITCH: {
      if (!g.batterHand)
        return {
          game: g,
          outing: o,
          prompt: null,
          error: 'Select batter handedness first',
        };

      o.pitches.push({
        outcome: 'out',
        outType: 'pitch',
        batterHand: g.batterHand,
        pitchCategory: payload.pitchCategory || null,
        inning: g.inning,
        timestamp: Date.now(),
      });

      updatePitchCategoryCounts(o, payload.pitchCategory, true);
      updateHandednessCounts(o, g.batterHand, true);

      o.battersFaced++;
      o.atBats++;
      o.outsRecorded++;
      if (o.firstPitchWasStrike) o.firstPitchStrikes++;
      if (g.balls >= 3) o.threeBallCounts++;

      g.outs++;

      if (payload.runsScored) {
        g.runsScored += payload.runsScored;
        g.runsThisInning += payload.runsScored;
        o.runsAllowed += payload.runsScored;
        g.runnersOnBase = Math.max(0, g.runnersOnBase - payload.runsScored);
      }

      resetAtBat(g, o);

      if (g.outs >= 3) prompt = PROMPTS.END_OF_INNING;

      return { game: g, outing: o, prompt };
    }

    case EVENTS.OUT_NON_PITCH: {
      if (g.runnersOnBase <= 0) {
        return {
          game: g,
          outing: o,
          prompt: null,
          error: 'No runners on base',
        };
      }

      o.outsRecorded++;
      g.outs++;
      g.runnersOnBase = Math.max(0, g.runnersOnBase - 1);

      if (g.outs >= 3) prompt = PROMPTS.END_OF_INNING;

      return { game: g, outing: o, prompt };
    }

    case EVENTS.END_INNING: {
      g.inning++;
      g.outs = 0;
      g.runnersOnBase = 0;
      g.runsThisInning = 0;
      g.balls = 0;
      g.strikes = 0;
      g.batterHand = null;
      if (o) {
        o.isFirstPitchOfAtBat = true;
        o.firstPitchWasStrike = false;
      }
      return { game: g, outing: o, prompt: null };
    }

    case EVENTS.SCORE_RUNS: {
      const runs = payload.runs || 0;
      g.runsScored += runs;
      g.runsThisInning += runs;
      if (o) o.runsAllowed += runs;
      g.runnersOnBase = Math.max(0, g.runnersOnBase - runs);

      if (payload.isWalk) {
        g.runnersOnBase = Math.min(3, g.runnersOnBase + 1);
        resetAtBat(g, o);
      }

      return { game: g, outing: o, prompt: null };
    }

    case EVENTS.END_OUTING: {
      if (o && o.pitches.length > 0) {
        const summary = computeOutingSummary(o);
        g.completedOutings = [
          ...g.completedOutings,
          { pitcherId: o.pitcherId, summary },
        ];
      }
      g.currentPitcherId = null;
      g.phase = 'selectPitcher';
      return { game: g, outing: null, prompt: null };
    }

    case EVENTS.END_GAME: {
      if (o && o.pitches.length > 0) {
        const summary = computeOutingSummary(o);
        g.completedOutings = [
          ...g.completedOutings,
          { pitcherId: o.pitcherId, summary },
        ];
      }
      g.phase = 'ended';
      return { game: g, outing: null, prompt: null };
    }

    case EVENTS.UNDO: {
      if (!o || o.pitches.length === 0) {
        return { game: g, outing: o, prompt: null };
      }
      return undoLastPitch(g, o);
    }

    default:
      return { game: g, outing: o, prompt: null };
  }
}

// ─── Strikeout Resolution ───────────────────────────────────────

export function resolveStrikeout(choice, game, outing) {
  let g = { ...game };
  let o = { ...outing, pitches: [...outing.pitches] };
  let prompt = null;

  if (choice === 'cancel') {
    return undoLastPitch(g, o);
  }

  if (choice === 'out') {
    o.battersFaced++;
    o.atBats++;
    o.outsRecorded++;
    if (o.firstPitchWasStrike) o.firstPitchStrikes++;
    if (g.balls >= 3) o.threeBallCounts++;

    g.outs++;
    resetAtBat(g, o);

    if (g.outs >= 3) prompt = PROMPTS.END_OF_INNING;
  }

  if (choice === 'uncaught') {
    o.battersFaced++;
    o.atBats++;
    if (o.firstPitchWasStrike) o.firstPitchStrikes++;
    if (g.balls >= 3) o.threeBallCounts++;

    g.runnersOnBase = Math.min(3, g.runnersOnBase + 1);
    resetAtBat(g, o);
  }

  return { game: g, outing: o, prompt };
}

// ─── Helper Functions ───────────────────────────────────────────

function resetAtBat(game, outing) {
  game.balls = 0;
  game.strikes = 0;
  game.batterHand = null;
  if (outing) {
    outing.isFirstPitchOfAtBat = true;
    outing.firstPitchWasStrike = false;
  }
}

function updatePitchCategoryCounts(outing, category, isStrike) {
  if (category === 'fastball') {
    outing.fastballCount++;
    if (isStrike) outing.fastballStrikes++;
  } else if (category === 'breaking') {
    outing.breakingCount++;
    if (isStrike) outing.breakingStrikes++;
  }
}

function updateHandednessCounts(outing, batterHand, isStrike) {
  if (batterHand === 'R') {
    outing.rhbPitches++;
    if (isStrike) outing.rhbStrikes++;
  } else if (batterHand === 'L') {
    outing.lhbPitches++;
    if (isStrike) outing.lhbStrikes++;
  }
}

function undoLastPitch(game, outing) {
  let g = { ...game };
  let o = { ...outing, pitches: [...outing.pitches] };

  const removedPitch = o.pitches.pop();
  if (!removedPitch) return { game: g, outing: o, prompt: null };

  if (removedPitch.pitchCategory === 'fastball') {
    o.fastballCount--;
    if (isStrikePitch(removedPitch)) o.fastballStrikes--;
  } else if (removedPitch.pitchCategory === 'breaking') {
    o.breakingCount--;
    if (isStrikePitch(removedPitch)) o.breakingStrikes--;
  }

  if (removedPitch.batterHand === 'R') {
    o.rhbPitches--;
    if (isStrikePitch(removedPitch)) o.rhbStrikes--;
  } else if (removedPitch.batterHand === 'L') {
    o.lhbPitches--;
    if (isStrikePitch(removedPitch)) o.lhbStrikes--;
  }

  if (
    removedPitch.outcome === 'strike' &&
    removedPitch.strikeType === 'called'
  ) {
    o.calledStrikes--;
  } else if (
    removedPitch.outcome === 'strike' &&
    removedPitch.strikeType === 'swinging'
  ) {
    o.swingingStrikes--;
  } else if (removedPitch.outcome === 'foul') {
    o.swingingStrikes--;
  }

  // Replay all remaining pitches to recompute current AB count
  let abBalls = 0;
  let abStrikes = 0;
  let currentBatterHand = null;
  let isFirst = true;
  let firstPitchStrike = false;

  for (const p of o.pitches) {
    if (isFirst && isStrikePitch(p)) firstPitchStrike = true;
    isFirst = false;
    currentBatterHand = p.batterHand;

    if (p.outcome === 'ball') {
      abBalls++;
      if (abBalls >= 4) {
        abBalls = 0;
        abStrikes = 0;
        currentBatterHand = null;
        isFirst = true;
        firstPitchStrike = false;
      }
    } else if (p.outcome === 'foul') {
      if (abStrikes < 2) abStrikes++;
    } else if (p.outcome === 'strike') {
      abStrikes++;
      if (abStrikes >= 3) {
        abBalls = 0;
        abStrikes = 0;
        currentBatterHand = null;
        isFirst = true;
        firstPitchStrike = false;
      }
    } else if (['ballInPlay', 'out', 'hitByPitch'].includes(p.outcome)) {
      abBalls = 0;
      abStrikes = 0;
      currentBatterHand = null;
      isFirst = true;
      firstPitchStrike = false;
    }
  }

  g.balls = abBalls;
  g.strikes = abStrikes;
  g.batterHand = currentBatterHand;
  o.isFirstPitchOfAtBat = isFirst;
  o.firstPitchWasStrike = firstPitchStrike;

  return { game: g, outing: o, prompt: null };
}

function isStrikePitch(pitch) {
  return ['strike', 'foul', 'ballInPlay', 'out'].includes(pitch.outcome);
}

// ─── Summary Computation ────────────────────────────────────────

export function computeOutingSummary(outing) {
  const totalPitches = outing.pitches.length;
  const strikes = outing.pitches.filter((p) => isStrikePitch(p)).length;
  const balls = outing.pitches.filter(
    (p) => p.outcome === 'ball' || p.outcome === 'hitByPitch'
  ).length;

  const pct = (num, den) => (den > 0 ? Math.round((num / den) * 100) : 0);

  const fullInnings = Math.floor(outing.outsRecorded / 3);
  const partialOuts = outing.outsRecorded % 3;
  const innings =
    partialOuts === 0
      ? `${fullInnings}`
      : partialOuts === 1
      ? `${fullInnings}+`
      : `${fullInnings}++`;

  return {
    totalPitches,
    strikes,
    balls,
    strikePercent: pct(strikes, totalPitches),
    ballPercent: pct(balls, totalPitches),
    innings,
    outs: outing.outsRecorded,
    battersFaced: outing.battersFaced,
    atBats: outing.atBats,
    walks: outing.walks,
    walkPercent: pct(outing.walks, outing.battersFaced),
    hitBatters: outing.hitBatters,
    firstPitchStrikes: outing.firstPitchStrikes,
    firstPitchStrikePercent: pct(outing.firstPitchStrikes, outing.battersFaced),
    threeBallCounts: outing.threeBallCounts,
    ballsInPlay: outing.ballsInPlay,
    swingingStrikes: outing.swingingStrikes,
    calledStrikes: outing.calledStrikes,
    fastballCount: outing.fastballCount,
    fastballStrikePercent: pct(outing.fastballStrikes, outing.fastballCount),
    breakingCount: outing.breakingCount,
    breakingStrikePercent: pct(outing.breakingStrikes, outing.breakingCount),
    rhbPitches: outing.rhbPitches,
    rhbStrikes: outing.rhbStrikes,
    rhbStrikePercent: pct(outing.rhbStrikes, outing.rhbPitches),
    lhbPitches: outing.lhbPitches,
    lhbStrikes: outing.lhbStrikes,
    lhbStrikePercent: pct(outing.lhbStrikes, outing.lhbPitches),
    runsAllowed: outing.runsAllowed,
    mandatoryRestDays: 0,
  };
}

export function getRollingStrikePercent(pitches, windowSize = 20) {
  const data = [];
  for (let i = 0; i < pitches.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const window = pitches.slice(start, i + 1);
    const windowStrikes = window.filter((p) => isStrikePitch(p)).length;
    const percent = Math.round((windowStrikes / window.length) * 100);
    data.push({ pitch: i + 1, percent });
  }
  return data;
}
