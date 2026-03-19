import React, { useState, useEffect } from 'react';
import Modal from '../shared/Modal';
import StrikeBadge from '../shared/StrikeBadge';
import { useData } from '../../App';
import {
  calculateAge, getOutingsForPitcher, getLastNSessions,
  getTeamsForPitcher,
} from '../../storage';

export default function PitcherDetailCard({ pitcher, onClose }) {
  const { settings } = useData();
  const [outings, setOutings]           = useState([]);
  const [sessions, setSessions]         = useState([]);
  const [pitcherTeams, setPitcherTeams] = useState([]);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const seasonStart  = settings?.seasonStartDate || `${new Date().getFullYear()}-01-01`;
        const allOutings   = await getOutingsForPitcher(pitcher.id);
        const seasonOutings = allOutings.filter((o) => o.date >= seasonStart);
        const recentSessions = await getLastNSessions(
          pitcher.id,
          settings?.trainingHistoryCount || 5,
        );
        const teams = await getTeamsForPitcher(pitcher.id);
        setOutings(seasonOutings);
        setSessions(recentSessions);
        setPitcherTeams(teams);
      } catch (e) {
        console.error('Failed to load pitcher stats:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [pitcher.id, settings]);

  const age = calculateAge(pitcher.birthday);

  // Aggregate season stats directly from summary fields
  const seasonStats = outings.reduce(
    (acc, o) => {
      const s = o.summary;
      acc.totalPitches     += s.totalPitches     || 0;
      acc.strikes          += s.strikes          || 0;
      acc.balls            += s.balls            || 0;
      acc.battersFaced     += s.battersFaced     || 0;
      acc.atBats           += s.atBats           || 0;
      acc.walks            += s.walks            || 0;
      acc.hitByPitch       += s.hitByPitch       || 0;
      acc.firstPitchStrikes += s.firstPitchStrikes || 0;
      acc.threeBallCounts  += s.threeBallCounts  || 0;
      acc.hitIntoPlay      += s.hitIntoPlay      || 0;
      acc.swingingStrikes  += s.swingingStrikes  || 0;
      acc.calledStrikes    += s.calledStrikes    || 0;
      acc.pitchesVsR       += s.pitchesVsR       || 0;
      acc.strikesVsR       += s.strikesVsR       || 0;
      acc.pitchesVsL       += s.pitchesVsL       || 0;
      acc.strikesVsL       += s.strikesVsL       || 0;
      acc.outs             += s.outs             || 0;
      acc.fastballCount    += s.fastballCount    || 0;
      acc.fastballStrikes  += s.fastballStrikes  || 0;
      acc.breakingCount    += s.breakingCount    || 0;
      acc.breakingStrikes  += s.breakingStrikes  || 0;
      return acc;
    },
    {
      totalPitches: 0, strikes: 0, balls: 0,
      battersFaced: 0, atBats: 0, walks: 0, hitByPitch: 0,
      firstPitchStrikes: 0, threeBallCounts: 0, hitIntoPlay: 0,
      swingingStrikes: 0, calledStrikes: 0,
      pitchesVsR: 0, strikesVsR: 0,
      pitchesVsL: 0, strikesVsL: 0,
      outs: 0,
      fastballCount: 0, fastballStrikes: 0,
      breakingCount: 0, breakingStrikes: 0,
    }
  );

  const pct = (num, den) => (den > 0 ? Math.round((num / den) * 100) : 0);
  const inningsStr = (outs) => {
    const full    = Math.floor(outs / 3);
    const partial = outs % 3;
    return `${full}.${partial}`;
  };

  const lastOuting = outings.length > 0 ? outings[0] : null;

  return (
    <Modal title={`${pitcher.fullName} — Stats`} onClose={onClose}>
      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading stats...</div>
      ) : (
        <div className="space-y-5">

          {/* Player info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
              {pitcher.throwingHand}HP
            </div>
            <div>
              <p className="font-semibold">{pitcher.fullName}, Age {age}</p>
              <p className="text-xs text-gray-500">
                {pitcherTeams.length > 0
                  ? pitcherTeams.map((t) => t.name).join(', ')
                  : 'Unassigned'}
              </p>
              {pitcher.pitchArsenal?.length > 0 && (
                <p className="text-xs text-gray-400 mt-0.5">
                  Arsenal: {pitcher.pitchArsenal.join(', ')}
                </p>
              )}
            </div>
          </div>

          {/* Season stats */}
          <div className="bg-blue-50 rounded-lg p-3">
            <h3 className="text-sm font-semibold text-blue-900 mb-3">
              Season stats ({outings.length} game{outings.length !== 1 ? 's' : ''})
            </h3>
            {outings.length === 0 ? (
              <p className="text-sm text-blue-700">No game outings this season.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <StatBox label="Pitches" value={seasonStats.totalPitches} />
                <StatBox label="IP"      value={inningsStr(seasonStats.outs)} />
                <StatBox label="Strike %" value={
                  <StrikeBadge percentage={pct(seasonStats.strikes, seasonStats.totalPitches)} />
                } />
                <StatBox label="Ball %"  value={`${pct(seasonStats.balls, seasonStats.totalPitches)}%`} />
                <StatBox label="BF"      value={seasonStats.battersFaced} />
                <StatBox label="FPS %"   value={`${pct(seasonStats.firstPitchStrikes, seasonStats.atBats)}%`} />
                <StatBox label="Walks"   value={seasonStats.walks} />
                <StatBox label="Walk %"  value={`${pct(seasonStats.walks, seasonStats.battersFaced)}%`} />
                <StatBox label="HBP"     value={seasonStats.hitByPitch} />
                <StatBox label="3-Ball"  value={seasonStats.threeBallCounts} />
                <StatBox label="BIP"     value={seasonStats.hitIntoPlay} />
                <StatBox label="Swing K" value={seasonStats.swingingStrikes} />
                <StatBox label="Called K" value={seasonStats.calledStrikes} />
                <StatBox label="vs RHB" value={
                  <StrikeBadge percentage={pct(seasonStats.strikesVsR, seasonStats.pitchesVsR)} />
                } />
                <StatBox label="vs LHB" value={
                  <StrikeBadge percentage={pct(seasonStats.strikesVsL, seasonStats.pitchesVsL)} />
                } />
                {seasonStats.fastballCount > 0 && (
                  <StatBox label="FB K%"  value={`${pct(seasonStats.fastballStrikes, seasonStats.fastballCount)}%`} />
                )}
                {seasonStats.breakingCount > 0 && (
                  <StatBox label="BRK K%" value={`${pct(seasonStats.breakingStrikes, seasonStats.breakingCount)}%`} />
                )}
              </div>
            )}
          </div>

          {/* Last outing */}
          {lastOuting && (
            <div className="bg-green-50 rounded-lg p-3">
              <h3 className="text-sm font-semibold text-green-900 mb-3">
                Last outing ({new Date(lastOuting.date + 'T00:00:00').toLocaleDateString()})
                {lastOuting.opponent ? ` — vs ${lastOuting.opponent}` : ''}
              </h3>
              <div className="grid grid-cols-3 gap-2">
                <StatBox label="Pitches"  value={lastOuting.summary.totalPitches} />
                <StatBox label="IP"       value={lastOuting.summary.innings} />
                <StatBox label="Strike %" value={
                  <StrikeBadge percentage={lastOuting.summary.strikePercent} />
                } />
                <StatBox label="Ball %"   value={`${lastOuting.summary.ballPercent}%`} />
                <StatBox label="BF"       value={lastOuting.summary.battersFaced} />
                <StatBox label="Walks"    value={lastOuting.summary.walks} />
                <StatBox label="HBP"      value={lastOuting.summary.hitByPitch} />
                <StatBox label="BIP"      value={lastOuting.summary.hitIntoPlay} />
                <StatBox label="Rest"     value={`${lastOuting.summary.mandatoryRestDays}d`} />
              </div>
            </div>
          )}

          {/* Training summary */}
          {sessions.length > 0 && (
            <div className="bg-purple-50 rounded-lg p-3">
              <h3 className="text-sm font-semibold text-purple-900 mb-3">
                Recent training ({sessions.length} session{sessions.length !== 1 ? 's' : ''})
              </h3>
              <div className="space-y-2">
                {sessions.map((s) => (
                  <div key={s.id} className="bg-white rounded p-2">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-gray-500">
                        {new Date(s.date + 'T00:00:00').toLocaleDateString()}
                      </span>
                      <span className="text-xs">
                        {s.summary.totalPitches}/{s.targetPitches} pitches — <StrikeBadge percentage={s.summary.strikePercent} />
                      </span>
                    </div>
                    {s.summary.byPitchType && (
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(s.summary.byPitchType)
                          .filter(([, d]) => d.count > 0)
                          .sort((a, b) => b[1].strikePercent - a[1].strikePercent)
                          .map(([type, data]) => (
                            <span
                              key={type}
                              className="text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded"
                            >
                              {type}: {data.count}p {data.strikePercent}%
                            </span>
                          ))}
                      </div>
                    )}
                    {s.coachNotes && (
                      <p className="text-[10px] text-gray-400 mt-1 line-clamp-2">{s.coachNotes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {pitcher.notes && (
            <div className="bg-gray-50 rounded-lg p-3">
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Notes</h3>
              <p className="text-sm text-gray-600">{pitcher.notes}</p>
            </div>
          )}

        </div>
      )}
    </Modal>
  );
}

function StatBox({ label, value }) {
  return (
    <div className="bg-white rounded p-2 text-center">
      <p className="text-[10px] text-gray-500 leading-tight">{label}</p>
      <div className="text-sm font-semibold mt-0.5">{value}</div>
    </div>
  );
}
