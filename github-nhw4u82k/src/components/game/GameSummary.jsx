import React, { useState, useEffect } from 'react';
import StrikeBadge from '../shared/StrikeBadge';
import { getTeam, getPitcher, calculateAvailability } from '../../storage';

export default function GameSummary({ game, onDone }) {
  const [team, setTeam] = useState(null);
  const [pitcherNames, setPitcherNames] = useState({});
  const [availabilityMap, setAvailabilityMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const t = await getTeam(game.teamId);
        setTeam(t);

        const names = {};
        const avails = {};
        for (const outing of game.completedOutings) {
          if (!names[outing.pitcherId]) {
            const p = await getPitcher(outing.pitcherId);
            if (p) {
              names[outing.pitcherId] = p.fullName;
              avails[outing.pitcherId] = await calculateAvailability(p.id, p.birthday, t.organization);
            }
          }
        }
        setPitcherNames(names);
        setAvailabilityMap(avails);
      } catch (e) {
        console.error('Failed to load game summary:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [game]);

  // Aggregate team totals
  const teamTotals = game.completedOutings.reduce(
    (acc, o) => {
      const s = o.summary;
      acc.totalPitches += s.totalPitches;
      acc.strikes += s.strikes;
      acc.balls += s.balls;
      acc.battersFaced += s.battersFaced;
      acc.outs += s.outs;
      acc.walks += s.walks;
      acc.hitBatters += s.hitBatters;
      acc.rhbPitches += s.rhbPitches;
      acc.rhbStrikes += s.rhbStrikes;
      acc.lhbPitches += s.lhbPitches;
      acc.lhbStrikes += s.lhbStrikes;
      acc.runsAllowed += s.runsAllowed;
      return acc;
    },
    { totalPitches: 0, strikes: 0, balls: 0, battersFaced: 0, outs: 0, walks: 0, hitBatters: 0, rhbPitches: 0, rhbStrikes: 0, lhbPitches: 0, lhbStrikes: 0, runsAllowed: 0 }
  );

  const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);
  const teamStrike = pct(teamTotals.strikes, teamTotals.totalPitches);
  const teamBall = pct(teamTotals.balls, teamTotals.totalPitches);

  const generateReport = () => {
    let r = `GAME SUMMARY\nTeam: ${team?.name || 'Unknown'}\nDate: ${game.gameDate}\n\n`;
    r += `TEAM TOTALS:\nPitches: ${teamTotals.totalPitches}\nStrike %: ${teamStrike}% | Ball %: ${teamBall}%\n`;
    r += `BF: ${teamTotals.battersFaced} | Outs: ${teamTotals.outs}\n`;
    r += `Walks: ${teamTotals.walks} | HBP: ${teamTotals.hitBatters}\n`;
    r += `Runs: ${game.runsScored}\n\n`;
    r += `PITCHER LINES:\n`;
    for (const o of game.completedOutings) {
      const name = pitcherNames[o.pitcherId] || 'Unknown';
      const s = o.summary;
      r += `${name}: ${s.totalPitches}p | ${s.innings} IP | ${s.strikePercent}% K | ${s.walks} BB | ${s.hitBatters} HBP | Rest: ${s.mandatoryRestDays}d\n`;
    }
    r += `\nAVAILABILITY:\n`;
    for (const [pid, avail] of Object.entries(availabilityMap)) {
      const name = pitcherNames[pid] || 'Unknown';
      if (avail.available) {
        r += `${name}: ${avail.availablePitches} pitches available\n`;
      } else {
        r += `${name}: REST - ${avail.reason}\n`;
      }
    }
    return r;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generateReport()).then(() => alert('Report copied!')).catch(() => alert('Copy failed'));
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: 'Game Summary', text: generateReport() }).catch(() => {});
    } else {
      handleCopy();
    }
  };

  const handleTextCoach = (phone, name) => {
    if (!phone) { alert(`No phone number for ${name}`); return; }
    const report = generateReport();
    const sep = /iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?';
    window.location.href = `sms:${phone}${sep}body=${encodeURIComponent(report)}`;
  };

  if (loading) {
    return <div className="h-full flex items-center justify-center text-gray-400">Loading summary...</div>;
  }

  return (
    <div className="h-full overflow-y-auto p-4 pb-8">
      <h1 className="text-xl font-bold mb-1">Game Summary</h1>
      <p className="text-xs text-gray-500 mb-4">{team?.name} · {game.gameDate}</p>

      {/* Team totals */}
      <div className="bg-white rounded-xl p-4 border border-gray-100 mb-3">
        <h2 className="font-semibold text-sm mb-3">Team pitching totals</h2>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <StatCell label="Pitches" value={teamTotals.totalPitches} />
          <StatCell label="Strike %" value={<StrikeBadge percentage={teamStrike} />} />
          <StatCell label="Ball %" value={`${teamBall}%`} />
          <StatCell label="BF" value={teamTotals.battersFaced} />
          <StatCell label="Outs" value={teamTotals.outs} />
          <StatCell label="Runs" value={game.runsScored} />
          <StatCell label="Walks" value={teamTotals.walks} />
          <StatCell label="HBP" value={teamTotals.hitBatters} />
          <StatCell label="vs RHB" value={<StrikeBadge percentage={pct(teamTotals.rhbStrikes, teamTotals.rhbPitches)} />} />
          <StatCell label="vs LHB" value={<StrikeBadge percentage={pct(teamTotals.lhbStrikes, teamTotals.lhbPitches)} />} />
        </div>
      </div>

      {/* Individual pitcher lines */}
      <div className="bg-white rounded-xl p-4 border border-gray-100 mb-3">
        <h2 className="font-semibold text-sm mb-3">Pitcher lines</h2>
        <div className="space-y-3">
          {game.completedOutings.map((o, i) => {
            const s = o.summary;
            const name = pitcherNames[o.pitcherId] || 'Unknown';
            return (
              <div key={i} className="border-b border-gray-50 pb-2 last:border-0">
                <p className="font-medium text-sm mb-1">{name}</p>
                <div className="grid grid-cols-4 gap-1 text-[10px]">
                  <StatMini label="P" value={s.totalPitches} />
                  <StatMini label="IP" value={s.innings} />
                  <StatMini label="K%" value={<StrikeBadge percentage={s.strikePercent} />} />
                  <StatMini label="B%" value={`${s.ballPercent}%`} />
                  <StatMini label="BF" value={s.battersFaced} />
                  <StatMini label="BB" value={s.walks} />
                  <StatMini label="HBP" value={s.hitBatters} />
                  <StatMini label="FPS" value={`${s.firstPitchStrikePercent}%`} />
                  <StatMini label="3BC" value={s.threeBallCounts} />
                  <StatMini label="BIP" value={s.ballsInPlay} />
                  <StatMini label="SwK" value={s.swingingStrikes} />
                  <StatMini label="CK" value={s.calledStrikes} />
                </div>
                <div className="mt-1">
                  <span className={`text-[10px] font-semibold ${
                    s.mandatoryRestDays === 0 ? 'text-green-600'
                    : s.mandatoryRestDays >= 4 ? 'text-red-600'
                    : 'text-orange-500'
                  }`}>
                    Rest: {s.mandatoryRestDays} day{s.mandatoryRestDays !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Availability */}
      <div className="bg-white rounded-xl p-4 border border-gray-100 mb-4">
        <h2 className="font-semibold text-sm mb-3">Pitcher availability</h2>
        <div className="space-y-2">
          {Object.entries(availabilityMap).map(([pid, avail]) => (
            <div key={pid} className={`text-xs p-2 rounded-lg ${avail.available ? 'bg-green-50' : 'bg-red-50'}`}>
              <span className="font-medium">{pitcherNames[pid]}</span>
              {avail.available ? (
                <span className="text-green-600 ml-2">{avail.availablePitches} pitches available</span>
              ) : (
                <span className="text-red-600 ml-2">{avail.reason}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Share actions */}
      <div className="space-y-2">
        <button onClick={handleCopy} className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold text-sm">
          Copy report
        </button>
        <button onClick={handleShare} className="w-full bg-purple-600 text-white py-3 rounded-xl font-semibold text-sm">
          Share report
        </button>
        {team?.coach1Phone && (
          <button
            onClick={() => handleTextCoach(team.coach1Phone, team.coach1Name || 'Coach 1')}
            className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold text-sm"
          >
            Text {team.coach1Name || 'Coach 1'}
          </button>
        )}
        {team?.coach2Phone && (
          <button
            onClick={() => handleTextCoach(team.coach2Phone, team.coach2Name || 'Coach 2')}
            className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold text-sm"
          >
            Text {team.coach2Name || 'Coach 2'}
          </button>
        )}
        <button onClick={onDone} className="w-full bg-gray-600 text-white py-3 rounded-xl font-semibold text-sm">
          Done
        </button>
      </div>
    </div>
  );
}

function StatCell({ label, value }) {
  return (
    <div className="bg-gray-50 rounded p-2 text-center">
      <p className="text-[10px] text-gray-500">{label}</p>
      <div className="text-sm font-semibold mt-0.5">{value}</div>
    </div>
  );
}

function StatMini({ label, value }) {
  return (
    <div className="text-center">
      <p className="text-gray-400">{label}</p>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
