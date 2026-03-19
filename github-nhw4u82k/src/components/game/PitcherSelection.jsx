import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { getAllPitchers, getTeam, calculateAvailability } from '../../storage';

export default function PitcherSelection({
  teamId,
  alreadyPitchedIds = [],
  onSelect,
  onCancel,
}) {
  const [team, setTeam] = useState(null);
  const [pitchersWithAvail, setPitchersWithAvail] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const t = await getTeam(teamId);
        setTeam(t);
        const allP = await getAllPitchers();
        const teamPitchers = allP.filter((p) => t.pitcherIds.includes(p.id));

        const withAvail = await Promise.all(
          teamPitchers.map(async (p) => {
            const avail = await calculateAvailability(
              p.id,
              p.birthday,
              t.organization
            );
            return { pitcher: p, avail };
          })
        );

        // Sort: available first, then by available pitches desc
        // Already-pitched pitchers always sort to the bottom
        withAvail.sort((a, b) => {
          const aAlready = alreadyPitchedIds.includes(a.pitcher.id);
          const bAlready = alreadyPitchedIds.includes(b.pitcher.id);
          if (aAlready && !bAlready) return 1;
          if (!aAlready && bAlready) return -1;
          if (a.avail.available && !b.avail.available) return -1;
          if (!a.avail.available && b.avail.available) return 1;
          return b.avail.availablePitches - a.avail.availablePitches;
        });

        setPitchersWithAvail(withAvail);
      } catch (e) {
        console.error('Failed to load pitchers:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [teamId]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="text-gray-400">Loading pitchers...</span>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onCancel} className="text-blue-600 p-1">
          <ArrowLeft size={22} />
        </button>
        <div>
          <h1 className="text-lg font-bold">Select Pitcher</h1>
          <p className="text-xs text-gray-500">{team?.name}</p>
        </div>
      </div>

      <div className="space-y-2">
        {pitchersWithAvail.map(({ pitcher, avail }) => {
          // ── Re-entry rule: once removed, cannot return this game ──
          const alreadyPitched = alreadyPitchedIds.includes(pitcher.id);
          if (alreadyPitched) {
            return (
              <div
                key={pitcher.id}
                className="w-full text-left rounded-xl p-4 border bg-gray-50 border-gray-200 opacity-60"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-sm text-gray-500">
                      {pitcher.fullName}
                      <span className="font-normal ml-1">
                        ({pitcher.throwingHand}HP)
                      </span>
                    </h3>
                    <p className="text-gray-400 text-xs mt-1 font-medium">
                      Already pitched this game — cannot re-enter
                    </p>
                  </div>
                  <span className="text-gray-300 text-lg">&#9654;</span>
                </div>
              </div>
            );
          }

          // ── Normal availability check ──────────────────────────
          const canPitch = avail.available && avail.availablePitches > 0;

          return (
            <button
              key={pitcher.id}
              onClick={() => {
                if (!canPitch) {
                  const override = window.confirm(
                    `${pitcher.fullName} is ${avail.reason}.\n\n` +
                      `Override and allow pitching anyway?\n\n` +
                      `This will be recorded for audit purposes.`
                  );
                  if (!override) return;
                }
                onSelect(pitcher, !canPitch);
              }}
              className={`w-full text-left rounded-xl p-4 border transition-colors ${
                canPitch
                  ? 'bg-white border-gray-100 active:bg-gray-50'
                  : 'bg-red-50 border-red-100'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-sm">
                    {pitcher.fullName}
                    <span className="text-gray-400 font-normal ml-1">
                      ({pitcher.throwingHand}HP, {avail.age})
                    </span>
                  </h3>
                  {canPitch ? (
                    <p className="text-green-600 text-sm font-medium mt-1">
                      {avail.availablePitches} pitches available
                    </p>
                  ) : (
                    <p className="text-red-600 text-xs mt-1">{avail.reason}</p>
                  )}
                  {avail.warning && (
                    <p className="text-orange-500 text-xs mt-0.5">
                      {avail.warning}
                    </p>
                  )}
                </div>
                {canPitch && (
                  <span className="text-green-500 text-lg">&#9654;</span>
                )}
              </div>
            </button>
          );
        })}

        {pitchersWithAvail.length === 0 && (
          <div className="bg-white rounded-xl p-8 text-center">
            <p className="text-gray-500 text-sm">
              No pitchers on this team's roster.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
