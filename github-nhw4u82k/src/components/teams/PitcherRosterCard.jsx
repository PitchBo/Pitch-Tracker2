import React, { useState, useEffect } from 'react';
import { Edit, Trash2 } from 'lucide-react';
import StrikeBadge from '../shared/StrikeBadge';
import {
  calculateAge, calculateAvailability,
  getLastNOutings, getTrainingPitchesInLastDays,
  getOutingsForPitcher,
} from '../../storage';

export default function PitcherRosterCard({ pitcher, organization, onEdit, onRemove, onViewStats }) {
  const [availability, setAvailability] = useState(null);
  const [lastOutings, setLastOutings] = useState([]);
  const [trainingPitches, setTrainingPitches] = useState(0);
  const [seasonStats, setSeasonStats] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const avail = await calculateAvailability(pitcher.id, pitcher.birthday, organization);
        const last3 = await getLastNOutings(pitcher.id, 3);
        const training3d = await getTrainingPitchesInLastDays(pitcher.id, 3);
        
        // Season stats (simple aggregate)
        const allOutings = await getOutingsForPitcher(pitcher.id);
        if (allOutings.length > 0) {
          const totalP = allOutings.reduce((s, o) => s + o.summary.totalPitches, 0);
          const totalS = allOutings.reduce((s, o) => s + o.summary.strikes, 0);
          const rhbP = allOutings.reduce((s, o) => s + o.summary.rhbPitches, 0);
          const rhbS = allOutings.reduce((s, o) => s + o.summary.rhbStrikes, 0);
          const lhbP = allOutings.reduce((s, o) => s + o.summary.lhbPitches, 0);
          const lhbS = allOutings.reduce((s, o) => s + o.summary.lhbStrikes, 0);
          setSeasonStats({
            strikePercent: totalP > 0 ? Math.round((totalS / totalP) * 100) : 0,
            vsRHB: rhbP > 0 ? Math.round((rhbS / rhbP) * 100) : 0,
            vsLHB: lhbP > 0 ? Math.round((lhbS / lhbP) * 100) : 0,
          });
        }

        setAvailability(avail);
        setLastOutings(last3);
        setTrainingPitches(training3d);
      } catch (e) {
        console.error('Failed to load pitcher card data:', e);
      }
    };
    load();
  }, [pitcher.id, pitcher.birthday, organization]);

  const age = calculateAge(pitcher.birthday);
  const lastOuting = lastOutings.length > 0 ? lastOutings[0] : null;
  const last3Pitches = lastOutings.map((o) => o.summary.totalPitches);

  return (
    <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
      {/* Header row */}
      <div className="flex items-start justify-between mb-2">
        <div
          className="flex-1 cursor-pointer"
          onClick={onViewStats}
        >
          <h3 className="font-semibold text-sm">
            {pitcher.fullName}, {age}
            <span className="text-gray-400 font-normal ml-1">({pitcher.throwingHand}HP)</span>
          </h3>
        </div>
        <div className="flex gap-2 shrink-0 ml-2">
          <button onClick={onEdit} className="text-blue-500 p-1"><Edit size={16} /></button>
          <button onClick={onRemove} className="text-red-400 p-1"><Trash2 size={16} /></button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="space-y-1 text-xs text-gray-600">
        {/* Availability line */}
        {availability && (
          <div className="flex items-center gap-2">
            <span className="font-medium">Available:</span>
            <span className={availability.available ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
              {availability.available ? `${availability.availablePitches} pitches` : 'Unavailable'}
            </span>
            {!availability.available && (
              <span className="text-red-500">— {availability.reason}</span>
            )}
          </div>
        )}

        {/* Today / rest */}
        {availability && (
          <div className="flex gap-3">
            <span>Today: <span className="text-blue-600 font-medium">{availability.pitchesToday}</span></span>
            <span>Rest: <span className={`font-medium ${availability.mandatoryRestDays === 0 ? 'text-green-600' : availability.mandatoryRestDays >= 4 ? 'text-red-600' : 'text-orange-500'}`}>
              {availability.mandatoryRestDays}d
            </span></span>
            {availability.warning && (
              <span className="text-orange-500">{availability.warning}</span>
            )}
          </div>
        )}

        {/* Training */}
        <div>Training (3d): <span className="text-blue-600 font-medium">{trainingPitches} pitches</span></div>

        {/* Last 3 outings */}
        <div>Last 3: {last3Pitches.length > 0 ? last3Pitches.join(', ') : 'None'}</div>

        {/* Last outing line */}
        {lastOuting && (
          <div>
            Last: {lastOuting.summary.battersFaced} BF | {lastOuting.summary.innings} IP | <StrikeBadge percentage={lastOuting.summary.strikePercent} />
          </div>
        )}

        {/* Season stats */}
        {seasonStats && (
          <div className="flex items-center gap-1 flex-wrap">
            Season: <StrikeBadge percentage={seasonStats.strikePercent} />
            <span className="text-gray-400">|</span>
            vs L: <StrikeBadge percentage={seasonStats.vsLHB} />
            <span className="text-gray-400">|</span>
            vs R: <StrikeBadge percentage={seasonStats.vsRHB} />
          </div>
        )}
      </div>
    </div>
  );
}
