import React, { useState, useMemo } from 'react';
import StrikeBadge from '../shared/StrikeBadge';
import { VALID_PITCH_TYPES } from '../../storage';

const MAX_PITCHES = 60;
const WARNING_THRESHOLD = 45;
const MIN_PITCHES = 15;

export default function ActiveTrainingSession({
  pitcher,
  targetPitches,
  initialPitches = [],
  onEnd,
  onPause,
}) {
  // Initialize from resumedPitches if provided — this is how resume works
  const [pitches, setPitches] = useState(() => initialPitches || []);
  const [pendingType, setPendingType] = useState(null);
  const [warned45, setWarned45] = useState(
    () => (initialPitches?.length || 0) >= WARNING_THRESHOLD
  );
  const [showAddPitch, setShowAddPitch] = useState(false);

  // Local arsenal — seed from pitcher profile, add types already used in resumed pitches
  const [arsenal, setArsenal] = useState(() => {
    const base =
      pitcher.pitchArsenal?.length > 0 ? [...pitcher.pitchArsenal] : ['4-Seam'];
    // If resuming, include any pitch types already recorded that aren't in the arsenal
    const resumedTypes = (initialPitches || [])
      .map((p) => p.pitchType)
      .filter(Boolean);
    const combined = [...new Set([...base, ...resumedTypes])];
    return combined;
  });

  const availableToAdd = VALID_PITCH_TYPES.filter((t) => !arsenal.includes(t));

  // ─── Record outcome ───────────────────────────────────
  const recordOutcome = (outcome) => {
    if (!pendingType) return;

    const newPitch = {
      pitchType: pendingType,
      outcome,
      timestamp: Date.now(),
    };
    const updated = [...pitches, newPitch];
    setPitches(updated);
    setPendingType(null);

    // 45-pitch warning
    if (updated.length === WARNING_THRESHOLD && !warned45) {
      setWarned45(true);
      setTimeout(
        () => alert('45 pitches thrown. Consider ending the session soon.'),
        100
      );
    }

    // 60-pitch hard stop
    if (updated.length >= MAX_PITCHES) {
      setTimeout(() => {
        alert('Maximum 60 pitches reached. Session ending.');
        onEnd(updated);
      }, 100);
    }
  };

  // ─── Undo ─────────────────────────────────────────────
  const undo = () => {
    if (pitches.length > 0) {
      setPitches(pitches.slice(0, -1));
    }
  };

  // ─── End session ──────────────────────────────────────
  const handleEnd = () => {
    if (pitches.length < MIN_PITCHES) {
      if (
        window.confirm(
          `Minimum ${MIN_PITCHES} pitches required.\n\nYou have ${pitches.length}. Discard this session?`
        )
      ) {
        onEnd(null);
      }
      return;
    }
    onEnd(pitches);
  };

  // ─── Computed stats ───────────────────────────────────
  const stats = useMemo(() => {
    const total = pitches.length;
    const strikes = pitches.filter((p) => p.outcome === 'strike').length;
    const strikePercent = total > 0 ? Math.round((strikes / total) * 100) : 0;

    const byType = {};
    for (const pitch of pitches) {
      if (!byType[pitch.pitchType]) {
        byType[pitch.pitchType] = { count: 0, strikes: 0 };
      }
      byType[pitch.pitchType].count++;
      if (pitch.outcome === 'strike') byType[pitch.pitchType].strikes++;
    }

    for (const type of Object.keys(byType)) {
      const t = byType[type];
      t.strikePercent =
        t.count > 0 ? Math.round((t.strikes / t.count) * 100) : 0;
    }

    return { total, strikes, strikePercent, byType };
  }, [pitches]);

  const progressPercent = Math.min(100, (stats.total / MAX_PITCHES) * 100);
  const progressColor =
    stats.total < MIN_PITCHES
      ? 'bg-red-500'
      : stats.total < targetPitches
      ? 'bg-yellow-500'
      : stats.total < WARNING_THRESHOLD
      ? 'bg-green-500'
      : 'bg-orange-500';

  return (
    <div className="h-full flex flex-col overflow-y-auto pb-24">
      {/* Header */}
      <div className="bg-white px-3 py-2 border-b border-gray-100">
        <p className="font-semibold text-sm">{pitcher.fullName}</p>
        <div className="flex justify-between text-xs mt-1 mb-1">
          <span
            className={
              stats.total >= WARNING_THRESHOLD
                ? 'text-orange-600 font-bold'
                : ''
            }
          >
            {stats.total}/{targetPitches} pitches (Max: {MAX_PITCHES})
          </span>
          <span>
            Strike %: <StrikeBadge percentage={stats.strikePercent} />
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${progressColor}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="px-3 py-3 space-y-3">
        {/* Pitch type selection OR outcome buttons */}
        {pendingType ? (
          <div className="bg-blue-50 border-2 border-blue-400 rounded-xl p-4">
            <p className="text-center font-bold text-blue-800 mb-3">
              {pendingType}
            </p>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => recordOutcome('strike')}
                className="bg-green-500 text-white py-6 rounded-xl font-bold text-lg active:bg-green-600"
              >
                STRIKE
              </button>
              <button
                onClick={() => recordOutcome('ball')}
                className="bg-red-500 text-white py-6 rounded-xl font-bold text-lg active:bg-red-600"
              >
                BALL
              </button>
              <button
                onClick={() => setPendingType(null)}
                className="bg-gray-400 text-white py-6 rounded-xl font-bold text-lg active:bg-gray-500"
              >
                CANCEL
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium mb-2">Select pitch type</p>
            <div className="grid grid-cols-4 gap-2">
              {arsenal.map((type) => (
                <button
                  key={type}
                  onClick={() => setPendingType(type)}
                  className="bg-blue-500 text-white py-3 rounded-lg text-xs font-semibold active:bg-blue-600"
                >
                  {type}
                </button>
              ))}
              {availableToAdd.length > 0 && (
                <button
                  onClick={() => setShowAddPitch(true)}
                  className="bg-gray-200 text-gray-600 py-3 rounded-lg text-xs font-semibold active:bg-gray-300"
                >
                  + Add
                </button>
              )}
            </div>
          </div>
        )}

        {/* Add pitch type dialog */}
        {showAddPitch && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-5 max-w-sm w-full">
              <h3 className="text-lg font-bold mb-3">Add pitch type</h3>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {availableToAdd.map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setArsenal((prev) => [...prev, type]);
                      setShowAddPitch(false);
                    }}
                    className="bg-blue-50 text-blue-700 py-3 rounded-lg text-sm font-medium active:bg-blue-100 border border-blue-200"
                  >
                    {type}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowAddPitch(false)}
                className="w-full bg-gray-200 text-gray-600 py-2 rounded-lg text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Undo */}
        <button
          onClick={undo}
          className="w-full bg-gray-300 text-gray-700 py-2 rounded-lg font-semibold text-xs active:bg-gray-400"
        >
          ↶ UNDO LAST PITCH
        </button>

        {/* Live stats by pitch type */}
        <div className="bg-white rounded-xl p-3 border border-gray-100">
          <p className="text-xs font-medium mb-2">Session stats</p>
          <div className="space-y-1">
            {arsenal.map((type) => {
              const typeStats = stats.byType[type];
              if (!typeStats || typeStats.count === 0) return null;
              return (
                <div
                  key={type}
                  className="flex justify-between items-center text-xs"
                >
                  <span className="text-gray-600">
                    {type}: {typeStats.count} pitches
                  </span>
                  <StrikeBadge percentage={typeStats.strikePercent} />
                </div>
              );
            })}
            {stats.total === 0 && (
              <p className="text-xs text-gray-400">No pitches recorded yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Bottom controls (fixed) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-300 z-50 pb-safe">
        <div className="flex gap-2 p-3">
          <button
            onClick={() => {
              if (window.confirm('Pause training? You can resume later.')) {
                onPause(pitches);
              }
            }}
            className="flex-1 bg-yellow-500 text-white py-3 rounded-xl font-semibold text-sm active:bg-yellow-600"
          >
            Pause
          </button>
          <button
            onClick={handleEnd}
            className="flex-1 bg-red-600 text-white py-3 rounded-xl font-semibold text-sm active:bg-red-700"
          >
            End Session
          </button>
        </div>
      </div>
    </div>
  );
}
