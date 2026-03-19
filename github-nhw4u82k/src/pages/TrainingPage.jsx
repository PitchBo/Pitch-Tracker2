import React, { useState, useEffect, useCallback } from 'react';
import { useData } from '../App';
import {
  getAllPitchers,
  getAllTeams,
  getTeamsForPitcher,
  createTrainingSession,
  getTodayDate,
  saveDraft,
  deleteDraft,
  getDraft,
} from '../storage';
import ActiveTrainingSession from '../components/training/ActiveTrainingSession';
import TrainingSummary from '../components/training/TrainingSummary';
import TrainingHistory from '../components/training/TrainingHistory';

export default function TrainingPage() {
  const { refreshData } = useData();

  const [phase, setPhase] = useState('selectPitcher');
  const [allPitchers, setAllPitchers] = useState([]);
  const [allTeams, setAllTeams] = useState([]);
  const [selectedPitcher, setSelectedPitcher] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [targetPitches, setTargetPitches] = useState(25);
  const [sessionPitches, setSessionPitches] = useState(null);
  const [resumedPitches, setResumedPitches] = useState(null); // pitches from a resumed draft
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [p, t] = await Promise.all([getAllPitchers(), getAllTeams()]);
      setAllPitchers(p);
      setAllTeams(t);
    } catch (e) {
      console.error('Failed to load training data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Pitcher selection ─────────────────────────────────
  const handleSelectPitcher = async (pitcher) => {
    setSelectedPitcher(pitcher);
    const teams = await getTeamsForPitcher(pitcher.id);
    setSelectedTeam(teams.length > 0 ? teams[0] : null);
    setResumedPitches(null); // fresh session, no resumed data
    setPhase('setup');
  };

  // ─── Start session ─────────────────────────────────────
  const handleStartSession = () => {
    setPhase('active');
  };

  // ─── Session ended ─────────────────────────────────────
  const handleSessionEnd = (pitches) => {
    if (!pitches) {
      resetToHome();
      return;
    }
    setSessionPitches(pitches);
    setPhase('summary');
  };

  // ─── Pause session ─────────────────────────────────────
  const handlePause = async (pitches) => {
    await saveDraft('training', {
      state: {
        pitcherId: selectedPitcher.id,
        teamId: selectedTeam?.id || null,
        targetPitches,
        pitches,
      },
      teamId: selectedTeam?.id || 'none',
      pitcherName: selectedPitcher.fullName,
      pitchCount: pitches.length,
      pausedAt: new Date().toISOString(),
    });
    resetToHome();
    await refreshData();
  };

  // ─── Resume from draft ─────────────────────────────────
  const handleResume = useCallback(async () => {
    const draft = await getDraft('training');
    if (!draft) {
      alert('No paused training session found.');
      return;
    }

    const pitcher = allPitchers.find((p) => p.id === draft.state.pitcherId);
    if (!pitcher) {
      alert('Pitcher not found. Discarding paused session.');
      await deleteDraft('training');
      return;
    }

    // Restore all session state including existing pitches
    setSelectedPitcher(pitcher);
    const teams = await getTeamsForPitcher(pitcher.id);
    setSelectedTeam(teams.length > 0 ? teams[0] : null);
    setTargetPitches(draft.state.targetPitches);
    setResumedPitches(draft.state.pitches || []); // pass saved pitches to component

    await deleteDraft('training');
    await refreshData();
    setPhase('active');
  }, [allPitchers, refreshData]);

  // ─── Save session ──────────────────────────────────────
  const handleSave = async ({ summary, coachNotes }) => {
    await createTrainingSession({
      pitcherId: selectedPitcher.id,
      teamId: selectedTeam?.id || null,
      date: getTodayDate(),
      targetPitches,
      summary,
      coachNotes,
    });
    await refreshData();
    resetToHome();
  };

  // ─── Reset ─────────────────────────────────────────────
  const resetToHome = () => {
    setPhase('selectPitcher');
    setSelectedPitcher(null);
    setSelectedTeam(null);
    setSessionPitches(null);
    setResumedPitches(null);
    setTargetPitches(25);
  };

  // ─── Render ────────────────────────────────────────────

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        Loading...
      </div>
    );
  }

  if (phase === 'history' && selectedPitcher) {
    return (
      <TrainingHistory
        pitcher={selectedPitcher}
        onClose={() => {
          setSelectedPitcher(null);
          setPhase('selectPitcher');
        }}
      />
    );
  }

  if (phase === 'summary' && selectedPitcher && sessionPitches) {
    return (
      <TrainingSummary
        pitcher={selectedPitcher}
        team={selectedTeam}
        targetPitches={targetPitches}
        pitches={sessionPitches}
        onSave={handleSave}
        onDiscard={resetToHome}
      />
    );
  }

  if (phase === 'active' && selectedPitcher) {
    return (
      <ActiveTrainingSession
        pitcher={selectedPitcher}
        targetPitches={targetPitches}
        initialPitches={resumedPitches || []} // restored pitch data on resume
        onEnd={handleSessionEnd}
        onPause={handlePause}
      />
    );
  }

  if (phase === 'setup' && selectedPitcher) {
    return (
      <div className="h-full overflow-y-auto p-4">
        <div className="max-w-lg mx-auto">
          <div className="bg-white rounded-xl p-4 border border-gray-100 mb-4">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold">
                  {selectedPitcher.fullName}
                </h2>
                <p className="text-xs text-gray-500">
                  {selectedPitcher.throwingHand}HP · Arsenal:{' '}
                  {selectedPitcher.pitchArsenal?.join(', ') || 'None set'}
                </p>
                {selectedTeam && (
                  <p className="text-xs text-blue-600 mt-0.5">
                    {selectedTeam.name}
                  </p>
                )}
              </div>
              <button
                onClick={() => setPhase('selectPitcher')}
                className="text-blue-600 text-xs font-medium"
              >
                Change
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Target pitches
              </label>
              <input
                type="number"
                min="15"
                max="60"
                value={targetPitches}
                onChange={(e) =>
                  setTargetPitches(
                    Math.min(60, Math.max(15, parseInt(e.target.value) || 15))
                  )
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">Min: 15 · Max: 60</p>
            </div>

            <div className="flex gap-2 mb-4">
              {[20, 25, 30, 40, 50].map((n) => (
                <button
                  key={n}
                  onClick={() => setTargetPitches(n)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    targetPitches === n
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>

            <button
              onClick={handleStartSession}
              className="w-full bg-green-600 text-white py-3 rounded-xl font-bold text-base active:bg-green-700"
            >
              Start Session
            </button>
          </div>

          <button
            onClick={() => setPhase('history')}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold text-sm"
          >
            View Training History
          </button>
        </div>
      </div>
    );
  }

  // ── Pitcher selection (home) ──
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold mb-4">Training</h1>

        <ResumeBanner allPitchers={allPitchers} onResume={handleResume} />

        <h2 className="text-sm font-medium text-gray-500 mb-3">
          Select pitcher
        </h2>

        <div className="space-y-2">
          {(() => {
            const seen = new Set();
            const unique = allPitchers.filter((p) => {
              if (seen.has(p.id)) return false;
              seen.add(p.id);
              return true;
            });

            if (unique.length === 0) {
              return (
                <div className="bg-white rounded-xl p-8 text-center">
                  <p className="text-gray-500 text-sm mb-2">
                    No pitchers in database.
                  </p>
                  <p className="text-gray-400 text-xs">
                    Add pitchers through the Teams tab first.
                  </p>
                </div>
              );
            }

            return unique.map((pitcher) => {
              const pitcherTeams = allTeams.filter((t) =>
                t.pitcherIds.includes(pitcher.id)
              );
              return (
                <button
                  key={pitcher.id}
                  onClick={() => handleSelectPitcher(pitcher)}
                  className="w-full text-left bg-white rounded-xl p-4 border border-gray-100 active:bg-gray-50"
                >
                  <h3 className="font-semibold text-sm">
                    {pitcher.fullName}
                    <span className="text-gray-400 font-normal ml-1">
                      ({pitcher.throwingHand}HP)
                    </span>
                  </h3>
                  {pitcherTeams.length > 0 && (
                    <p className="text-xs text-blue-600 mt-0.5">
                      {pitcherTeams.map((t) => t.name).join(', ')}
                    </p>
                  )}
                  {pitcher.pitchArsenal?.length > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {pitcher.pitchArsenal.join(', ')}
                    </p>
                  )}
                </button>
              );
            });
          })()}
        </div>
      </div>
    </div>
  );
}

// ─── Resume banner ──────────────────────────────────────────

function ResumeBanner({ allPitchers, onResume }) {
  const [draft, setDraft] = useState(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const check = async () => {
      const d = await getDraft('training');
      setDraft(d);
      setChecked(true);
    };
    check();
  }, []);

  if (!checked || !draft) return null;

  return (
    <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-4">
      <p className="font-semibold text-purple-800 text-sm mb-1">
        Training session paused
      </p>
      <p className="text-purple-700 text-xs mb-3">
        {draft.pitcherName} · {draft.pitchCount} pitches
        {draft.pausedAt
          ? ` · ${new Date(draft.pausedAt).toLocaleString()}`
          : ''}
      </p>
      <div className="flex gap-2">
        <button
          onClick={onResume}
          className="flex-1 bg-purple-600 text-white py-2 rounded-lg font-semibold text-sm"
        >
          Resume
        </button>
        <button
          onClick={async () => {
            if (window.confirm('Discard paused session?')) {
              await deleteDraft('training');
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
