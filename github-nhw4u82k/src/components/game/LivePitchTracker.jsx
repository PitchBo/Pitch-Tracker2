import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ResponsiveContainer,
} from 'recharts';
import StrikeBadge from '../shared/StrikeBadge';
import { useData } from '../../App';
import {
  EVENTS,
  PROMPTS,
  processEvent,
  resolveStrikeout,
  getRollingStrikePercent,
} from './GameStateMachine';

export default function LivePitchTracker({
  game,
  outing,
  pitcher,
  dailyLimit,
  onStateChange,
  onEndOuting,
  onEndGame,
  onPause,
}) {
  const { settings } = useData();
  const [pendingPrompt, setPendingPrompt] = useState(null);
  const [showStrikeType, setShowStrikeType] = useState(false);
  const [showOutType, setShowOutType] = useState(false);
  const [pendingPitchCategory, setPendingPitchCategory] = useState(null);

  // ─── Dispatch event to state machine ─────────────────────
  const dispatch = (event, payload = {}) => {
    if (pendingPitchCategory && !payload.pitchCategory) {
      payload.pitchCategory = pendingPitchCategory;
    }

    const result = processEvent(event, game, outing, payload);

    if (result.error) {
      alert(result.error);
      return;
    }

    if (result.prompt) {
      setPendingPrompt({
        type: result.prompt,
        game: result.game,
        outing: result.outing,
      });
      return;
    }

    onStateChange(result.game, result.outing);
    setPendingPitchCategory(null);
  };

  // ─── Computed stats ──────────────────────────────────────
  const totalPitches = outing.pitches.length;
  const strikes = outing.pitches.filter((p) =>
    ['strike', 'foul', 'ballInPlay', 'out'].includes(p.outcome)
  ).length;
  const strikePercent =
    totalPitches > 0 ? Math.round((strikes / totalPitches) * 100) : 0;
  const pitchesRemaining = Math.max(0, dailyLimit - totalPitches);
  const progressPercent =
    dailyLimit > 0 ? Math.min(100, (totalPitches / dailyLimit) * 100) : 0;
  const trendData = useMemo(
    () => getRollingStrikePercent(outing.pitches),
    [outing.pitches]
  );

  const rhbPitches = outing.pitches.filter((p) => p.batterHand === 'R');
  const rhbStrikes = rhbPitches.filter((p) =>
    ['strike', 'foul', 'ballInPlay', 'out'].includes(p.outcome)
  ).length;
  const rhbPercent =
    rhbPitches.length > 0
      ? Math.round((rhbStrikes / rhbPitches.length) * 100)
      : 0;
  const lhbPitches = outing.pitches.filter((p) => p.batterHand === 'L');
  const lhbStrikes = lhbPitches.filter((p) =>
    ['strike', 'foul', 'ballInPlay', 'out'].includes(p.outcome)
  ).length;
  const lhbPercent =
    lhbPitches.length > 0
      ? Math.round((lhbStrikes / lhbPitches.length) * 100)
      : 0;

  const walkPercent =
    outing.battersFaced > 0
      ? Math.round((outing.walks / outing.battersFaced) * 100)
      : 0;
  // FPS denominator is battersFaced — walks and HBP are plate appearances
  const fpsPercent =
    outing.battersFaced > 0
      ? Math.round((outing.firstPitchStrikes / outing.battersFaced) * 100)
      : 0;

  return (
    <div className="h-full flex flex-col overflow-y-auto pb-24">
      {/* Header info */}
      <div className="bg-white px-3 py-2 text-xs text-gray-500 border-b border-gray-100">
        {pitcher.fullName} ({pitcher.throwingHand}HP) · {game.gameDate}
      </div>

      {/* Pitch count progress bar */}
      <div className="bg-white px-3 py-2 border-b border-gray-100">
        <div className="flex justify-between text-xs mb-1">
          <span className="font-medium">{totalPitches} pitches</span>
          <span
            className={
              pitchesRemaining <= 10
                ? 'text-red-600 font-bold'
                : 'text-gray-500'
            }
          >
            {pitchesRemaining} remaining
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              progressPercent >= 90
                ? 'bg-red-500'
                : progressPercent >= 75
                ? 'bg-orange-400'
                : 'bg-blue-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Game situation bar */}
      <div className="bg-blue-50 px-3 py-2 border-b border-blue-100">
        <div className="flex justify-around text-center">
          <div>
            <p className="text-[10px] text-gray-500">INN</p>
            <p className="text-xl font-bold text-blue-900">{game.inning}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500">OUTS</p>
            <p className="text-xl font-bold text-blue-900">{game.outs}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500">COUNT</p>
            <p className="text-xl font-bold text-blue-900">
              {game.balls}-{game.strikes}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500">RUNNERS</p>
            <p className="text-xl font-bold text-blue-900">
              {game.runnersOnBase}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500">RUNS</p>
            <p className="text-xl font-bold text-green-700">
              {game.runsThisInning}
            </p>
          </div>
        </div>
      </div>

      <div className="px-3 py-2 space-y-2">
        {/* Batter handedness — locked after first pitch of at-bat */}
        {(() => {
          const locked = game.batterHand && !outing.isFirstPitchOfAtBat;
          return (
            <div className="flex gap-2">
              <button
                onClick={() =>
                  !locked && dispatch(EVENTS.SET_BATTER_HAND, { hand: 'L' })
                }
                disabled={locked && game.batterHand !== 'L'}
                className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-colors ${
                  game.batterHand === 'L'
                    ? locked
                      ? 'bg-blue-800 text-white'
                      : 'bg-blue-600 text-white'
                    : locked
                    ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                LHB {locked && game.batterHand === 'L' ? '(locked)' : ''}
              </button>
              <button
                onClick={() =>
                  !locked && dispatch(EVENTS.SET_BATTER_HAND, { hand: 'R' })
                }
                disabled={locked && game.batterHand !== 'R'}
                className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-colors ${
                  game.batterHand === 'R'
                    ? locked
                      ? 'bg-blue-800 text-white'
                      : 'bg-blue-600 text-white'
                    : locked
                    ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                RHB {locked && game.batterHand === 'R' ? '(locked)' : ''}
              </button>
            </div>
          );
        })()}

        {/* Pitch category (fastball/breaking) */}
        <div className="flex gap-2">
          <button
            onClick={() =>
              setPendingPitchCategory(
                pendingPitchCategory === 'fastball' ? null : 'fastball'
              )
            }
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium border ${
              pendingPitchCategory === 'fastball'
                ? 'bg-orange-100 border-orange-400 text-orange-700'
                : 'bg-white border-gray-200 text-gray-500'
            }`}
          >
            Fastball
          </button>
          <button
            onClick={() =>
              setPendingPitchCategory(
                pendingPitchCategory === 'breaking' ? null : 'breaking'
              )
            }
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium border ${
              pendingPitchCategory === 'breaking'
                ? 'bg-purple-100 border-purple-400 text-purple-700'
                : 'bg-white border-gray-200 text-gray-500'
            }`}
          >
            Breaking
          </button>
        </div>

        {/* Main pitch buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => dispatch(EVENTS.BALL)}
            className="bg-red-500 text-white py-4 rounded-xl font-bold text-base active:bg-red-600"
          >
            BALL
          </button>
          <button
            onClick={() => setShowStrikeType(true)}
            className="bg-green-500 text-white py-4 rounded-xl font-bold text-base active:bg-green-600"
          >
            STRIKE
          </button>
          <button
            onClick={() => dispatch(EVENTS.BALL_IN_PLAY)}
            className="bg-blue-500 text-white py-4 rounded-xl font-bold text-sm active:bg-blue-600"
          >
            REACHED SAFELY
          </button>
          <button
            onClick={() => setShowOutType(true)}
            className="bg-purple-500 text-white py-4 rounded-xl font-bold text-base active:bg-purple-600"
          >
            OUT
          </button>
        </div>

        {/* Secondary buttons */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => dispatch(EVENTS.FOUL)}
            className="bg-orange-400 text-white py-2.5 rounded-lg font-semibold text-xs active:bg-orange-500"
          >
            FOUL
          </button>
          <button
            onClick={() => dispatch(EVENTS.HIT_BY_PITCH)}
            className="bg-yellow-500 text-white py-2.5 rounded-lg font-semibold text-xs active:bg-yellow-600"
          >
            HBP
          </button>
          <button
            onClick={() => dispatch(EVENTS.UNDO)}
            className="bg-gray-400 text-white py-2.5 rounded-lg font-semibold text-xs active:bg-gray-500"
          >
            ↶ UNDO
          </button>
        </div>

        {/* Runs scored + End inning */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              if (game.runnersOnBase <= 0) {
                alert('No runners on base.');
                return;
              }
              setPendingPrompt({
                type: 'MANUAL_RUNS',
                game,
                outing,
                maxRuns: game.runnersOnBase,
              });
            }}
            className="bg-green-600 text-white py-2.5 rounded-lg font-semibold text-xs active:bg-green-700"
          >
            RUNS SCORED
          </button>
          <button
            onClick={() => dispatch(EVENTS.END_INNING)}
            className="bg-gray-600 text-white py-2.5 rounded-lg font-semibold text-xs active:bg-gray-700"
          >
            END INNING
          </button>
        </div>

        {/* Live stats */}
        <div className="bg-white rounded-xl p-3 border border-gray-100 text-xs space-y-1">
          <div className="flex items-center gap-1 flex-wrap">
            <span>Pitches: {totalPitches}</span>
            <span className="text-gray-300">|</span>
            <span>
              Strikes: <StrikeBadge percentage={strikePercent} />
            </span>
            <span className="text-gray-300">|</span>
            <span>BIP: {outing.ballsInPlay}</span>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {/* FPS denominator is battersFaced, not atBats */}
            <span>
              FPS: {outing.firstPitchStrikes}/{outing.battersFaced} (
              {fpsPercent}%)
            </span>
            <span className="text-gray-300">|</span>
            <span>3-Ball: {outing.threeBallCounts}</span>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            <span>
              Walks: {outing.walks} ({walkPercent}%)
            </span>
            <span className="text-gray-300">|</span>
            <span>HBP: {outing.hitBatters}</span>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            <span>
              vs RHB: <StrikeBadge percentage={rhbPercent} />
            </span>
            <span className="text-gray-300">|</span>
            <span>
              vs LHB: <StrikeBadge percentage={lhbPercent} />
            </span>
          </div>
          {(outing.fastballCount > 0 || outing.breakingCount > 0) && (
            <div className="flex items-center gap-1 flex-wrap">
              {outing.fastballCount > 0 && (
                <span>
                  FB: {outing.fastballCount}p (
                  {Math.round(
                    (outing.fastballStrikes / outing.fastballCount) * 100
                  )}
                  %)
                </span>
              )}
              {outing.fastballCount > 0 && outing.breakingCount > 0 && (
                <span className="text-gray-300">|</span>
              )}
              {outing.breakingCount > 0 && (
                <span>
                  BRK: {outing.breakingCount}p (
                  {Math.round(
                    (outing.breakingStrikes / outing.breakingCount) * 100
                  )}
                  %)
                </span>
              )}
            </div>
          )}
        </div>

        {/* Strike % trend chart */}
        {trendData.length > 3 && (
          <div className="bg-white rounded-xl p-3 border border-gray-100">
            <p className="text-xs font-medium mb-2">
              Strike % trend (rolling 20)
            </p>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="pitch" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(value) => [`${value}%`, 'Strike %']}
                  labelFormatter={(label) => `Pitch #${label}`}
                />
                <ReferenceArea
                  y1={0}
                  y2={settings?.redThreshold || 50}
                  fill="#DC3545"
                  fillOpacity={0.1}
                />
                <ReferenceArea
                  y1={settings?.redThreshold || 50}
                  y2={settings?.yellowThreshold || 65}
                  fill="#FFC107"
                  fillOpacity={0.1}
                />
                <ReferenceArea
                  y1={settings?.yellowThreshold || 65}
                  y2={100}
                  fill="#28A745"
                  fillOpacity={0.1}
                />
                <Line
                  type="monotone"
                  dataKey="percent"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ─── Bottom game controls (fixed) ──────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-300 z-50 pb-safe">
        <div className="flex gap-2 p-3">
          <button
            onClick={onPause}
            className="flex-1 bg-yellow-500 text-white py-3 rounded-xl font-semibold text-sm active:bg-yellow-600"
          >
            Pause
          </button>
          <button
            onClick={onEndOuting}
            className="flex-1 bg-orange-600 text-white py-3 rounded-xl font-semibold text-sm active:bg-orange-700"
          >
            End Outing
          </button>
          <button
            onClick={onEndGame}
            className="flex-1 bg-red-600 text-white py-3 rounded-xl font-semibold text-sm active:bg-red-700"
          >
            End Game
          </button>
        </div>
      </div>

      {/* ─── Dialogs ───────────────────────────────────────── */}

      {/* Strike type dialog */}
      {showStrikeType && (
        <Dialog onClose={() => setShowStrikeType(false)}>
          <h3 className="text-lg font-bold text-center mb-4">Strike type?</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                dispatch(EVENTS.STRIKE_CALLED);
                setShowStrikeType(false);
              }}
              className="bg-blue-600 text-white py-4 rounded-xl font-bold active:bg-blue-700"
            >
              Called
            </button>
            <button
              onClick={() => {
                dispatch(EVENTS.STRIKE_SWINGING);
                setShowStrikeType(false);
              }}
              className="bg-green-600 text-white py-4 rounded-xl font-bold active:bg-green-700"
            >
              Swinging
            </button>
          </div>
        </Dialog>
      )}

      {/* Out type dialog */}
      {showOutType && (
        <Dialog onClose={() => setShowOutType(false)}>
          <h3 className="text-lg font-bold text-center mb-4">
            How was the out recorded?
          </h3>
          <div className="space-y-3">
            <button
              onClick={() => {
                dispatch(EVENTS.OUT_ON_PITCH);
                setShowOutType(false);
              }}
              className="w-full bg-purple-600 text-white py-4 rounded-xl font-bold active:bg-purple-700"
            >
              Out on a pitch
            </button>
            <button
              onClick={() => {
                dispatch(EVENTS.OUT_NON_PITCH);
                setShowOutType(false);
              }}
              className="w-full bg-orange-600 text-white py-4 rounded-xl font-bold active:bg-orange-700"
            >
              Base out
              <span className="block text-xs font-normal mt-0.5">
                Pickoff / Caught stealing / Thrown out
              </span>
            </button>
          </div>
        </Dialog>
      )}

      {/* Strikeout resolution dialog */}
      {pendingPrompt?.type === PROMPTS.STRIKEOUT && (
        <Dialog
          onClose={() => {
            const result = resolveStrikeout(
              'cancel',
              pendingPrompt.game,
              pendingPrompt.outing
            );
            onStateChange(result.game, result.outing);
            setPendingPrompt(null);
          }}
        >
          <h3 className="text-lg font-bold text-center mb-1">Strikeout!</h3>
          <p className="text-gray-500 text-center text-sm mb-4">
            What happened?
          </p>
          <div className="space-y-3">
            <button
              onClick={() => {
                const result = resolveStrikeout(
                  'out',
                  pendingPrompt.game,
                  pendingPrompt.outing
                );
                onStateChange(result.game, result.outing);
                setPendingPrompt(
                  result.prompt
                    ? {
                        type: result.prompt,
                        game: result.game,
                        outing: result.outing,
                      }
                    : null
                );
              }}
              className="w-full bg-purple-500 text-white py-4 rounded-xl font-bold active:bg-purple-600"
            >
              Batter out
            </button>
            <button
              onClick={() => {
                const result = resolveStrikeout(
                  'uncaught',
                  pendingPrompt.game,
                  pendingPrompt.outing
                );
                onStateChange(result.game, result.outing);
                setPendingPrompt(null);
              }}
              className="w-full bg-blue-500 text-white py-4 rounded-xl font-bold active:bg-blue-600"
            >
              Uncaught 3rd strike
              <span className="block text-xs font-normal mt-0.5">
                Batter reached base
              </span>
            </button>
            <button
              onClick={() => {
                const result = resolveStrikeout(
                  'cancel',
                  pendingPrompt.game,
                  pendingPrompt.outing
                );
                onStateChange(result.game, result.outing);
                setPendingPrompt(null);
              }}
              className="w-full bg-gray-400 text-white py-3 rounded-xl font-semibold active:bg-gray-500"
            >
              Cancel &amp; undo
            </button>
          </div>
        </Dialog>
      )}

      {/* End of inning dialog */}
      {pendingPrompt?.type === PROMPTS.END_OF_INNING && (
        <Dialog onClose={() => setPendingPrompt(null)}>
          <h3 className="text-lg font-bold text-center mb-4">
            3 outs — end of inning?
          </h3>
          <div className="space-y-3">
            <button
              onClick={() => {
                const result = processEvent(
                  EVENTS.END_INNING,
                  pendingPrompt.game,
                  pendingPrompt.outing
                );
                onStateChange(result.game, result.outing);
                setPendingPrompt(null);
              }}
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold active:bg-blue-700"
            >
              Yes — next inning
            </button>
            <button
              onClick={() => {
                onStateChange(pendingPrompt.game, pendingPrompt.outing);
                setPendingPrompt(null);
              }}
              className="w-full bg-gray-400 text-white py-3 rounded-xl font-semibold active:bg-gray-500"
            >
              Not yet
            </button>
          </div>
        </Dialog>
      )}

      {/* Runs scored dialogs */}
      {(pendingPrompt?.type === PROMPTS.RUNS_SCORED ||
        pendingPrompt?.type === PROMPTS.WALK_BASES_LOADED ||
        pendingPrompt?.type === 'MANUAL_RUNS') && (
        <RunsScoredDialog
          prompt={pendingPrompt}
          onResolve={(runs) => {
            const isWalk = pendingPrompt.type === PROMPTS.WALK_BASES_LOADED;
            const result = processEvent(
              EVENTS.SCORE_RUNS,
              pendingPrompt.game,
              pendingPrompt.outing,
              {
                runs,
                isWalk,
              }
            );
            onStateChange(result.game, result.outing);
            setPendingPrompt(null);
          }}
          onCancel={() => setPendingPrompt(null)}
        />
      )}
    </div>
  );
}

// ─── Reusable dialog wrapper ──────────────────────────────────

function Dialog({ children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-5 max-w-sm w-full">{children}</div>
    </div>
  );
}

// ─── Runs scored dialog ───────────────────────────────────────

function RunsScoredDialog({ prompt, onResolve, onCancel }) {
  const maxRuns =
    prompt.type === 'MANUAL_RUNS'
      ? prompt.maxRuns
      : Math.min(4, (prompt.game?.runnersOnBase || 0) + 1);
  const minRuns = prompt.type === PROMPTS.WALK_BASES_LOADED ? 1 : 0;
  const isWalk = prompt.type === PROMPTS.WALK_BASES_LOADED;

  const buttons = [];
  for (let i = minRuns; i <= maxRuns; i++) {
    buttons.push(i);
  }

  return (
    <Dialog onClose={onCancel}>
      <h3 className="text-lg font-bold text-center mb-1">
        {isWalk ? 'Bases loaded walk!' : 'Runs scored'}
      </h3>
      <p className="text-gray-500 text-center text-sm mb-1">
        Runners on base: {prompt.game?.runnersOnBase || 0}
      </p>
      {isWalk && (
        <p className="text-orange-600 text-center text-xs font-medium mb-3">
          At least 1 run must score
        </p>
      )}
      <p className="text-gray-500 text-center text-sm mb-4">
        How many runs scored?
      </p>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {buttons.map((n) => (
          <button
            key={n}
            onClick={() => onResolve(n)}
            className={`py-4 rounded-xl font-bold text-xl text-white active:scale-95 ${
              n === 0 ? 'bg-gray-400' : n >= 4 ? 'bg-green-600' : 'bg-blue-500'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <button
        onClick={onCancel}
        className="w-full bg-gray-200 text-gray-600 py-2 rounded-lg text-sm"
      >
        Cancel
      </button>
    </Dialog>
  );
}
