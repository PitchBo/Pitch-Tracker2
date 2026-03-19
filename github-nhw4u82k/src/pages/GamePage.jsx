import React, { useState, useCallback } from 'react';
import { useData } from '../App';
import {
  createGameOuting,
  getAllTeams,
  getPitcher,
  getTeam,
  calculateAvailability,
  computeMandatoryRestForOuting,
  getOutingsForPitcherInRange,
  getDateDaysAgo,
  getTodayDate,
  saveDraft,
  deleteDraft,
  getDraft,
  calculateAge,
} from '../storage';
import {
  createGameState,
  createPitcherOuting,
  processEvent,
  EVENTS,
  computeOutingSummary,
} from '../components/game/GameStateMachine';
import PitcherSelection from '../components/game/PitcherSelection';
import LivePitchTracker from '../components/game/LivePitchTracker';
import GameSummary from '../components/game/GameSummary';

export default function GamePage() {
  const { refreshData, pendingGameTeamId, setPendingGameTeamId } = useData();
  const [gameState, setGameState] = useState(null);
  const [outingState, setOutingState] = useState(null);
  const [pitcherRecord, setPitcherRecord] = useState(null);
  const [dailyLimit, setDailyLimit] = useState(0);
  const [selectingTeam, setSelectingTeam] = useState(false);
  const [teams, setTeams] = useState([]);
  const [overrideWarning, setOverrideWarning] = useState(false);

  // Auto-start game when launched from Teams tab
  React.useEffect(() => {
    if (pendingGameTeamId && !gameState) {
      const g = createGameState(pendingGameTeamId);
      setGameState(g);
      setPendingGameTeamId(null);
    }
  }, [pendingGameTeamId, gameState, setPendingGameTeamId]);

  // ─── Start game from team selection ─────────────────────
  const handleStartGame = useCallback(async () => {
    const allTeams = await getAllTeams();
    if (allTeams.length === 0) {
      alert('Create a team first.');
      return;
    }
    if (allTeams.length === 1) {
      const g = createGameState(allTeams[0].id);
      setGameState(g);
      return;
    }
    setTeams(allTeams);
    setSelectingTeam(true);
  }, []);

  const handleSelectTeam = (teamId) => {
    const g = createGameState(teamId);
    setGameState(g);
    setSelectingTeam(false);
  };

  // ─── Pitcher selected ──────────────────────────────────
  const handleSelectPitcher = async (pitcher, wasOverridden) => {
    setOverrideWarning(wasOverridden);
    setPitcherRecord(pitcher);

    const team = await getTeam(gameState.teamId);
    const avail = await calculateAvailability(
      pitcher.id,
      pitcher.birthday,
      team.organization
    );
    setDailyLimit(avail.availablePitches);

    const result = processEvent(EVENTS.SELECT_PITCHER, gameState, null, {
      pitcherId: pitcher.id,
    });
    setGameState(result.game);
    setOutingState(result.outing);
  };

  // ─── State change from live tracker ────────────────────
  const handleStateChange = (newGame, newOuting) => {
    setGameState(newGame);
    setOutingState(newOuting);
  };

  // ─── End outing (switch pitcher) ───────────────────────
  const handleEndOuting = async () => {
    if (!outingState || outingState.pitches.length === 0) {
      const g = {
        ...gameState,
        currentPitcherId: null,
        phase: 'selectPitcher',
      };
      setGameState(g);
      setOutingState(null);
      setPitcherRecord(null);
      return;
    }

    await saveCurrentOuting();

    const result = processEvent(EVENTS.END_OUTING, gameState, outingState);
    setGameState(result.game);
    setOutingState(null);
    setPitcherRecord(null);
  };

  // ─── End game ──────────────────────────────────────────
  const handleEndGame = async () => {
    if (outingState && outingState.pitches.length > 0) {
      await saveCurrentOuting();
    }

    const result = processEvent(EVENTS.END_GAME, gameState, outingState);
    setGameState(result.game);
    setOutingState(null);

    await deleteDraft('game');
    await refreshData();
  };

  // ─── Pause game ────────────────────────────────────────
  const handlePause = async () => {
    if (window.confirm('Pause this game? You can resume later.')) {
      await saveDraft('game', {
        state: { gameState, outingState },
        teamId: gameState.teamId,
        pitcherName: pitcherRecord?.fullName || 'Unknown',
        pitchCount: outingState?.pitches?.length || 0,
        pausedAt: new Date().toISOString(),
      });
      resetGame();
      await refreshData();
    }
  };

  // ─── Resume game from draft ────────────────────────────
  const handleResume = useCallback(async () => {
    const draft = await getDraft('game');
    if (!draft) {
      alert('No paused game found.');
      return;
    }
    setGameState(draft.state.gameState);
    setOutingState(draft.state.outingState);

    if (draft.state.outingState?.pitcherId) {
      const p = await getPitcher(draft.state.outingState.pitcherId);
      setPitcherRecord(p);
      if (p) {
        const team = await getTeam(draft.state.gameState.teamId);
        const avail = await calculateAvailability(
          p.id,
          p.birthday,
          team.organization
        );
        setDailyLimit(avail.availablePitches);
      }
    }

    await deleteDraft('game');
    await refreshData();
  }, [refreshData]);

  // ─── Save current outing to storage ────────────────────
  const saveCurrentOuting = async () => {
    if (!outingState || outingState.pitches.length === 0) return;

    const summary = computeOutingSummary(outingState);
    const team = await getTeam(gameState.teamId);
    const pitcher = await getPitcher(outingState.pitcherId);
    const age = calculateAge(pitcher.birthday);

    // computeMandatoryRestForOuting is sync: (totalPitches, age, organization)
    summary.mandatoryRestDays = computeMandatoryRestForOuting(
      summary.totalPitches,
      age,
      team.organization
    );

    await createGameOuting({
      pitcherId: outingState.pitcherId,
      teamId: gameState.teamId,
      date: gameState.gameDate,
      pitches: outingState.pitches,
      outs: outingState.outsRecorded,
      summary,
      overrideWarning,
    });

    setOverrideWarning(false);
  };

  // ─── Reset ─────────────────────────────────────────────
  const resetGame = () => {
    setGameState(null);
    setOutingState(null);
    setPitcherRecord(null);
    setSelectingTeam(false);
    setOverrideWarning(false);
  };

  const handleDone = async () => {
    resetGame();
    await refreshData();
  };

  // ─── Derive already-pitched pitcher IDs for re-entry rule ──
  // Includes both completed outings AND the current pitcher if active
  const alreadyPitchedIds = gameState
    ? [
        ...gameState.completedOutings.map((o) => o.pitcherId),
        ...(gameState.currentPitcherId ? [gameState.currentPitcherId] : []),
      ]
    : [];

  // ─── Render ────────────────────────────────────────────

  // No active game
  if (!gameState) {
    return (
      <div className="h-full overflow-y-auto p-4">
        <div className="max-w-lg mx-auto">
          <h1 className="text-2xl font-bold mb-4">Game Mode</h1>

          <ResumeCheck onResume={handleResume} />

          <button
            onClick={handleStartGame}
            className="w-full bg-green-600 text-white py-4 rounded-xl font-bold text-lg active:bg-green-700 mb-4"
          >
            Start New Game
          </button>

          <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded-r-lg">
            <p className="text-blue-800 text-sm">
              Select a team, then pick your starting pitcher. Track every pitch
              with outcome, batter handedness, and pitch category.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Team selection
  if (selectingTeam) {
    return (
      <div className="h-full overflow-y-auto p-4">
        <h1 className="text-lg font-bold mb-4">Select team</h1>
        <div className="space-y-2">
          {teams.map((t) => (
            <button
              key={t.id}
              onClick={() => handleSelectTeam(t.id)}
              className="w-full text-left bg-white rounded-xl p-4 border border-gray-100 active:bg-gray-50"
            >
              <h3 className="font-semibold">{t.name}</h3>
              <p className="text-sm text-gray-500">
                {t.organization} · {t.ageGroup}
              </p>
            </button>
          ))}
          <button
            onClick={() => {
              setSelectingTeam(false);
              resetGame();
            }}
            className="w-full bg-gray-200 text-gray-600 py-3 rounded-xl font-medium text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Game ended
  if (gameState.phase === 'ended') {
    return <GameSummary game={gameState} onDone={handleDone} />;
  }

  // Select pitcher — pass already-pitched IDs to enforce re-entry rule
  if (gameState.phase === 'selectPitcher') {
    return (
      <PitcherSelection
        teamId={gameState.teamId}
        alreadyPitchedIds={alreadyPitchedIds}
        onSelect={handleSelectPitcher}
        onCancel={() => {
          if (gameState.completedOutings.length > 0) {
            if (window.confirm('End game? Completed outings will be saved.')) {
              handleEndGame();
            }
          } else {
            resetGame();
          }
        }}
      />
    );
  }

  // Active tracking
  if (gameState.phase === 'tracking' && outingState && pitcherRecord) {
    return (
      <LivePitchTracker
        game={gameState}
        outing={outingState}
        pitcher={pitcherRecord}
        dailyLimit={dailyLimit}
        onStateChange={handleStateChange}
        onEndOuting={handleEndOuting}
        onEndGame={handleEndGame}
        onPause={handlePause}
      />
    );
  }

  return (
    <div className="h-full flex items-center justify-center text-gray-400">
      Loading...
    </div>
  );
}

// ─── Resume check component ──────────────────────────────────

function ResumeCheck({ onResume }) {
  const [draft, setDraft] = useState(null);
  const [checked, setChecked] = useState(false);

  React.useEffect(() => {
    const check = async () => {
      const { getDraft } = await import('../storage');
      const d = await getDraft('game');
      setDraft(d);
      setChecked(true);
    };
    check();
  }, []);

  if (!checked || !draft) return null;

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
      <p className="font-semibold text-orange-800 text-sm mb-1">
        Game in progress
      </p>
      <p className="text-orange-700 text-xs mb-3">
        {draft.pitcherName} · {draft.pitchCount} pitches
        {draft.pausedAt
          ? ` · Paused ${new Date(draft.pausedAt).toLocaleString()}`
          : ''}
      </p>
      <div className="flex gap-2">
        <button
          onClick={onResume}
          className="flex-1 bg-orange-600 text-white py-2 rounded-lg font-semibold text-sm"
        >
          Resume
        </button>
        <button
          onClick={async () => {
            if (window.confirm('Discard paused game? Data will be lost.')) {
              const { deleteDraft } = await import('../storage');
              await deleteDraft('game');
              setDraft(null);
            }
          }}
          className="flex-1 bg-gray-200 text-gray-600 py-2 rounded-lg font-medium text-sm"
        >
          Discard
        </button>
      </div>
    </div>
  );
}
