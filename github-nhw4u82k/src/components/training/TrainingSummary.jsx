import React, { useState } from 'react';
import StrikeBadge from '../shared/StrikeBadge';

export default function TrainingSummary({
  pitcher,
  team,
  targetPitches,
  pitches,
  onSave,
  onDiscard,
}) {
  const [coachNotes, setCoachNotes] = useState('');

  // ─── Compute stats ────────────────────────────────────
  const total = pitches.length;
  const strikes = pitches.filter((p) => p.outcome === 'strike').length;
  const balls = total - strikes;
  const strikePercent = total > 0 ? Math.round((strikes / total) * 100) : 0;

  const byPitchType = {};
  for (const pitch of pitches) {
    if (!byPitchType[pitch.pitchType]) {
      byPitchType[pitch.pitchType] = { count: 0, strikes: 0, strikePercent: 0 };
    }
    byPitchType[pitch.pitchType].count++;
    if (pitch.outcome === 'strike') byPitchType[pitch.pitchType].strikes++;
  }
  for (const type of Object.keys(byPitchType)) {
    const t = byPitchType[type];
    t.strikePercent = t.count > 0 ? Math.round((t.strikes / t.count) * 100) : 0;
  }

  const sortedTypes = Object.entries(byPitchType)
    .filter(([_, d]) => d.count > 0)
    .sort((a, b) => b[1].strikePercent - a[1].strikePercent);

  // ─── Report generation ────────────────────────────────
  const generateReport = () => {
    let r = `TRAINING SESSION REPORT\n`;
    r += `Date: ${new Date().toLocaleDateString()}\n`;
    if (team) r += `Team: ${team.name}\n`;
    r += `Pitcher: ${pitcher.fullName}\n\n`;
    r += `Total Pitches: ${total}/${targetPitches}\n`;
    r += `Overall Strike %: ${strikePercent}%\n\n`;
    r += `BY PITCH TYPE:\n`;
    for (const [type, data] of sortedTypes) {
      r += `${type}: ${data.count} pitches, ${data.strikePercent}% strikes\n`;
    }
    if (coachNotes) r += `\nCOACH NOTES:\n${coachNotes}`;
    return r;
  };

  const handleCopy = () => {
    navigator.clipboard
      .writeText(generateReport())
      .then(() => alert('Report copied!'))
      .catch(() => alert('Copy failed'));
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({ title: 'Training Report', text: generateReport() })
        .catch(() => {});
    } else {
      handleCopy();
    }
  };

  const handleText = (phone, name) => {
    if (!phone) {
      alert(`No phone number for ${name}`);
      return;
    }
    const report = generateReport();
    const sep = /iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?';
    window.location.href = `sms:${phone}${sep}body=${encodeURIComponent(
      report
    )}`;
  };

  const handleSave = () => {
    // Include all fields PitcherDetailCard and TrainingHistory expect
    const summary = {
      totalPitches: total,
      strikes,
      balls,
      strikePercent,
      byPitchType,
    };
    onSave({ summary, coachNotes: coachNotes || null });
  };

  return (
    <div className="h-full overflow-y-auto p-4 pb-8">
      <h1 className="text-xl font-bold mb-1">Training Summary</h1>
      <p className="text-xs text-gray-500 mb-4">
        {pitcher.fullName} · {new Date().toLocaleDateString()}
      </p>

      {/* Overall stats */}
      <div className="bg-white rounded-xl p-4 border border-gray-100 mb-3">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-medium">
            Total: {total}/{targetPitches}
          </span>
          <span className="text-sm">
            Overall: <StrikeBadge percentage={strikePercent} />
          </span>
        </div>

        {/* By pitch type */}
        <div className="space-y-2">
          {sortedTypes.map(([type, data]) => (
            <div key={type} className="flex justify-between items-center">
              <div className="text-sm">
                <span className="font-medium">{type}</span>
                <span className="text-gray-400 ml-2">{data.count} pitches</span>
              </div>
              <StrikeBadge percentage={data.strikePercent} />
            </div>
          ))}
        </div>
      </div>

      {/* Coach notes */}
      <div className="bg-white rounded-xl p-4 border border-gray-100 mb-4">
        <label className="block text-sm font-medium mb-2">
          Coach notes
          <span className="text-gray-400 font-normal ml-2">
            {coachNotes.length}/500
          </span>
        </label>
        <textarea
          value={coachNotes}
          onChange={(e) => setCoachNotes(e.target.value.slice(0, 500))}
          placeholder="Notes about this session..."
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <button
          onClick={handleCopy}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold text-sm"
        >
          Copy report
        </button>
        <button
          onClick={handleShare}
          className="w-full bg-purple-600 text-white py-3 rounded-xl font-semibold text-sm"
        >
          Share report
        </button>
        {team?.coach1Phone && (
          <button
            onClick={() =>
              handleText(team.coach1Phone, team.coach1Name || 'Coach 1')
            }
            className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold text-sm"
          >
            Text {team.coach1Name || 'Coach 1'}
          </button>
        )}
        {team?.coach2Phone && (
          <button
            onClick={() =>
              handleText(team.coach2Phone, team.coach2Name || 'Coach 2')
            }
            className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold text-sm"
          >
            Text {team.coach2Name || 'Coach 2'}
          </button>
        )}
        {pitcher.playerPhone && (
          <button
            onClick={() => handleText(pitcher.playerPhone, pitcher.fullName)}
            className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold text-sm"
          >
            Text {pitcher.fullName}
          </button>
        )}
        <button
          onClick={handleSave}
          className="w-full bg-gray-600 text-white py-3 rounded-xl font-semibold text-sm"
        >
          Save &amp; done
        </button>
        <button
          onClick={() => {
            if (window.confirm('Discard this session without saving?'))
              onDiscard();
          }}
          className="w-full bg-gray-200 text-gray-500 py-2 rounded-xl text-xs"
        >
          Discard
        </button>
      </div>
    </div>
  );
}
