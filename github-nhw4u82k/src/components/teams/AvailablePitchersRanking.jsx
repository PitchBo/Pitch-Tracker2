import React, { useState, useEffect } from 'react';
import StrikeBadge from '../shared/StrikeBadge';
import {
  calculateAge, calculateAvailability, getOutingsForPitcher,
} from '../../storage';

export default function AvailablePitchersRanking({ pitchers, organization }) {
  const [ranked, setRanked] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const withStats = await Promise.all(
          pitchers.map(async (pitcher) => {
            const avail = await calculateAvailability(pitcher.id, pitcher.birthday, organization);
            const outings = await getOutingsForPitcher(pitcher.id);
            const age = calculateAge(pitcher.birthday);

            let strikePercent = 0;
            let fpsPercent = 0;
            let walkPercent = 0;
            const hasGameData = outings.length > 0;

            if (hasGameData) {
              const totP = outings.reduce((s, o) => s + o.summary.totalPitches, 0);
              const totS = outings.reduce((s, o) => s + o.summary.strikes, 0);
              const totBF = outings.reduce((s, o) => s + o.summary.battersFaced, 0);
              const totAB = outings.reduce((s, o) => s + o.summary.atBats, 0);
              const totFPS = outings.reduce((s, o) => s + o.summary.firstPitchStrikes, 0);
              const totWalks = outings.reduce((s, o) => s + o.summary.walks, 0);

              strikePercent = totP > 0 ? (totS / totP) * 100 : 0;
              fpsPercent = totAB > 0 ? (totFPS / totAB) * 100 : 0;
              walkPercent = totBF > 0 ? (totWalks / totBF) * 100 : 0;
            }

            return {
              pitcher,
              age,
              available: avail.availablePitches,
              isAvailable: avail.available,
              pitchesToday: avail.pitchesToday,
              mandatoryRestDays: avail.mandatoryRestDays,
              strikePercent,
              fpsPercent,
              walkPercent,
              hasGameData,
            };
          })
        );

        // Sort: available desc, strike% desc, FPS% desc, walk% asc
        withStats.sort((a, b) => {
          if (a.available !== b.available) return b.available - a.available;
          if (Math.abs(a.strikePercent - b.strikePercent) > 0.5) return b.strikePercent - a.strikePercent;
          if (Math.abs(a.fpsPercent - b.fpsPercent) > 0.5) return b.fpsPercent - a.fpsPercent;
          return a.walkPercent - b.walkPercent;
        });

        setRanked(withStats);
      } catch (e) {
        console.error('Failed to load ranking:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [pitchers, organization]);

  if (loading) {
    return <div className="text-center py-8 text-gray-400 text-sm">Loading rankings...</div>;
  }

  if (ranked.length === 0) {
    return <div className="text-center py-8 text-gray-400 text-sm">No pitchers on roster.</div>;
  }

  return (
    <div className="p-4 space-y-3">
      <div>
        <h2 className="text-lg font-bold">Available Pitchers</h2>
        <p className="text-xs text-gray-500 mt-1">
          Ranked by: available pitches, strike %, FPS %, lowest walk %
        </p>
      </div>

      {ranked.map((stats, index) => (
        <div
          key={stats.pitcher.id}
          className={`rounded-xl p-3 border ${
            stats.isAvailable
              ? 'bg-white border-gray-100'
              : 'bg-red-50 border-red-100'
          }`}
        >
          <div className="flex items-center gap-3 mb-2">
            <span className={`text-xl font-bold ${stats.isAvailable ? 'text-blue-600' : 'text-red-400'}`}>
              #{index + 1}
            </span>
            <div>
              <h3 className="font-semibold text-sm">
                {stats.pitcher.fullName}, {stats.age}
                <span className="text-gray-400 font-normal ml-1">({stats.pitcher.throwingHand}HP)</span>
              </h3>
              <p className="text-[10px] text-gray-500">
                {stats.hasGameData ? 'Game stats' : 'No game data'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-gray-50 rounded p-2 text-center">
              <p className="text-[10px] text-gray-500">Available</p>
              <p className={`text-sm font-bold ${stats.isAvailable ? 'text-green-600' : 'text-red-600'}`}>
                {stats.available}
              </p>
            </div>
            <div className="bg-gray-50 rounded p-2 text-center">
              <p className="text-[10px] text-gray-500">Today</p>
              <p className="text-sm font-bold text-blue-600">{stats.pitchesToday}</p>
            </div>
            <div className="bg-gray-50 rounded p-2 text-center">
              <p className="text-[10px] text-gray-500">Rest</p>
              <p className={`text-sm font-bold ${
                stats.mandatoryRestDays === 0 ? 'text-green-600' : stats.mandatoryRestDays >= 4 ? 'text-red-600' : 'text-orange-500'
              }`}>
                {stats.mandatoryRestDays}d
              </p>
            </div>
            <div className="bg-gray-50 rounded p-2 text-center">
              <p className="text-[10px] text-gray-500">Strike %</p>
              <p className="text-sm font-bold">
                <StrikeBadge percentage={Math.round(stats.strikePercent)} />
              </p>
            </div>
            <div className="bg-gray-50 rounded p-2 text-center">
              <p className="text-[10px] text-gray-500">FPS %</p>
              <p className="text-sm font-bold text-blue-600">{Math.round(stats.fpsPercent)}%</p>
            </div>
            <div className="bg-gray-50 rounded p-2 text-center">
              <p className="text-[10px] text-gray-500">Walk %</p>
              <p className="text-sm font-bold text-red-600">{Math.round(stats.walkPercent)}%</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
