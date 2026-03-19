import React, { useState, useEffect } from 'react';
import { useData } from '../App';
import {
  getSettings, updateSettings, resetSettings,
  getStrikeColor, deleteDatabase, openDatabase,
  getAllTeams, getAllPitchers, getOutingsForPitcher, getSessionsForPitcher,
} from '../storage';

const APP_VERSION = '1.0.0';
const BUILD_DATE = '2026-03-17';

export default function SettingsPage() {
  const { settings, refreshData, setSettings: setAppSettings } = useData();
  const [localSettings, setLocalSettings] = useState(null);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [showRulesEditor, setShowRulesEditor] = useState(false);
  const [editingRules, setEditingRules] = useState(null);

  useEffect(() => {
    if (settings) {
      setLocalSettings({ ...settings });
    }
  }, [settings]);

  if (!localSettings) {
    return <div className="h-full flex items-center justify-center text-gray-400">Loading...</div>;
  }

  // ─── Save helper ──────────────────────────────────────
  const saveField = async (updates) => {
    setError(null);
    setSaved(false);
    try {
      const merged = { ...localSettings, ...updates };
      setLocalSettings(merged);
      const result = await updateSettings(updates);
      setAppSettings(result);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e.message);
    }
  };

  // ─── Strike color preview using actual boundary values ──
  const redExample = Math.max(0, localSettings.redThreshold - 1);
  const yellowExample = Math.min(localSettings.yellowThreshold - 1, Math.max(localSettings.redThreshold, localSettings.redThreshold + Math.floor((localSettings.yellowThreshold - localSettings.redThreshold) / 2)));
  const greenExample = localSettings.yellowThreshold;
  const redColor = getStrikeColor(redExample, localSettings);
  const yellowColor = getStrikeColor(yellowExample, localSettings);
  const greenColor = getStrikeColor(greenExample, localSettings);

  return (
    <div className="h-full overflow-y-auto p-4 pb-8">
      <h1 className="text-2xl font-bold mb-4">Settings</h1>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm p-3 rounded-xl mb-4">{error}</div>
      )}
      {saved && (
        <div className="bg-green-50 text-green-700 text-sm p-3 rounded-xl mb-4">Settings saved</div>
      )}

      {/* ── Section 1: Strike % Color Thresholds ─────────── */}
      <Section title="Strike % colors">
        <p className="text-xs text-gray-500 mb-4">
          Controls the color badges throughout the app for strike percentages.
        </p>

        {/* Red threshold */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <label className="text-sm font-medium">Red threshold (poor)</label>
            <span className="text-sm font-bold">{localSettings.redThreshold}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={localSettings.redThreshold}
            onChange={(e) => setLocalSettings({ ...localSettings, redThreshold: parseInt(e.target.value) })}
            onMouseUp={(e) => saveField({ redThreshold: parseInt(e.target.value) })}
            onTouchEnd={(e) => saveField({ redThreshold: parseInt(e.target.value) })}
            className="w-full"
          />
          <p className="text-[10px] text-gray-400">Below {localSettings.redThreshold}% = red</p>
        </div>

        {/* Yellow threshold */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <label className="text-sm font-medium">Yellow threshold (good)</label>
            <span className="text-sm font-bold">{localSettings.yellowThreshold}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={localSettings.yellowThreshold}
            onChange={(e) => setLocalSettings({ ...localSettings, yellowThreshold: parseInt(e.target.value) })}
            onMouseUp={(e) => saveField({ yellowThreshold: parseInt(e.target.value) })}
            onTouchEnd={(e) => saveField({ yellowThreshold: parseInt(e.target.value) })}
            className="w-full"
          />
          <p className="text-[10px] text-gray-400">{localSettings.redThreshold}%–{localSettings.yellowThreshold - 1}% = yellow · {localSettings.yellowThreshold}%+ = green</p>
        </div>

        {/* Preview */}
        <div className="flex gap-2 mb-3">
          <PreviewBadge label={`${redExample}%`} bg={redColor.bg} text={redColor.text} />
          <PreviewBadge label={`${yellowExample}%`} bg={yellowColor.bg} text={yellowColor.text} />
          <PreviewBadge label={`${greenExample}%`} bg={greenColor.bg} text={greenColor.text} />
        </div>
      </Section>

      {/* ── Section 2: Pitch Count Rules ─────────────────── */}
      <Section title="Pitch count rules">
        <div className="bg-blue-50 rounded-lg p-3 mb-3">
          <p className="text-xs text-blue-900 font-medium">
            Current mode: {localSettings.customPitchRules ? 'Custom rules' : 'Organization-based (default)'}
          </p>
          <p className="text-[10px] text-blue-700 mt-1">
            {localSettings.customPitchRules
              ? 'Your custom rules apply to all teams.'
              : "Each team uses its organization's rules (Pitch Smart, Little League, etc.)."
            }
          </p>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => {
              const current = localSettings.customPitchRules || {
                dailyLimits: [
                  { maxAge: 8, pitches: 50 },
                  { maxAge: 10, pitches: 75 },
                  { maxAge: 12, pitches: 85 },
                  { maxAge: 14, pitches: 95 },
                  { maxAge: 18, pitches: 105 },
                  { maxAge: 99, pitches: 120 },
                ],
                restDays: [
                  { maxPitches: 20, days: 0 },
                  { maxPitches: 35, days: 1 },
                  { maxPitches: 50, days: 2 },
                  { maxPitches: 65, days: 3 },
                  { maxPitches: 999, days: 4 },
                ],
              };
              setEditingRules(JSON.parse(JSON.stringify(current)));
              setShowRulesEditor(true);
            }}
            className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold"
          >
            {localSettings.customPitchRules ? 'Edit custom rules' : 'Create custom rules'}
          </button>

          {localSettings.customPitchRules && (
            <button
              onClick={async () => {
                if (window.confirm('Remove custom rules and use organization-based defaults?')) {
                  await saveField({ customPitchRules: null });
                }
              }}
              className="w-full bg-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium"
            >
              Use organization defaults
            </button>
          )}
        </div>
      </Section>

      {/* ── Section 3: Season Configuration ──────────────── */}
      <Section title="Season dates">
        <p className="text-xs text-gray-500 mb-3">
          "Season stats" in pitcher detail cards show data from this date forward.
        </p>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium shrink-0">Season start</label>
          <input
            type="date"
            value={localSettings.seasonStartDate}
            onChange={(e) => {
              const val = e.target.value;
              setLocalSettings({ ...localSettings, seasonStartDate: val });
              saveField({ seasonStartDate: val });
            }}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </Section>

      {/* ── Section 4: Training History ──────────────────── */}
      <Section title="Training history">
        <p className="text-xs text-gray-500 mb-3">
          How many past sessions to show in training history and the trend chart.
        </p>
        <div className="flex gap-2">
          {[5, 10, 15, 20].map((n) => (
            <button
              key={n}
              onClick={() => saveField({ trainingHistoryCount: n })}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                localSettings.trainingHistoryCount === n
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              {n}
            </button>
          ))}
          <button
            onClick={() => saveField({ trainingHistoryCount: 999 })}
            className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
              localSettings.trainingHistoryCount >= 100
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200'
            }`}
          >
            All
          </button>
        </div>
      </Section>

      {/* ── Section 5: Data Management ───────────────────── */}
      <Section title="Data management">
        <ExportSection localSettings={localSettings} />

        <div className="mt-3">
          <button
            onClick={handleClearAll}
            className="w-full bg-red-600 text-white py-2.5 rounded-xl text-sm font-semibold"
          >
            Clear all data
          </button>
          <p className="text-[10px] text-gray-400 mt-1">
            Permanently deletes everything. Cannot be undone.
          </p>
        </div>
      </Section>

      {/* ── Section 6: App Info ───────────────────────────── */}
      <Section title="About">
        <div className="text-sm text-gray-600 space-y-1">
          <p>Pitch Tracker v{APP_VERSION}</p>
          <p className="text-xs text-gray-400">Built {BUILD_DATE}</p>
          <p className="text-xs text-gray-400 mt-2">
            Statistical pitching assistant for baseball coaches. Tracks pitch counts,
            enforces rest day rules, and provides performance analytics across teams.
          </p>
        </div>
      </Section>

      {/* ── Reset to defaults ────────────────────────────── */}
      <button
        onClick={async () => {
          if (window.confirm('Reset all settings to defaults?\n\nThis does NOT delete your teams, pitchers, or game data — only settings.')) {
            const defaults = await resetSettings();
            setLocalSettings(defaults);
            setAppSettings(defaults);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          }
        }}
        className="w-full bg-gray-100 text-gray-500 py-2.5 rounded-xl text-xs font-medium mt-4"
      >
        Reset settings to defaults
      </button>

      {/* ── Custom Rules Editor Modal ────────────────────── */}
      {showRulesEditor && editingRules && (
        <RulesEditor
          rules={editingRules}
          onSave={async (rules) => {
            await saveField({ customPitchRules: rules });
            setShowRulesEditor(false);
            setEditingRules(null);
          }}
          onClose={() => {
            setShowRulesEditor(false);
            setEditingRules(null);
          }}
        />
      )}
    </div>
  );

  // ─── Clear all handler ────────────────────────────────
  async function handleClearAll() {
    const first = window.confirm(
      'This will PERMANENTLY DELETE all teams, pitchers, game history, and training history.\n\nThis cannot be undone.'
    );
    if (!first) return;

    const typed = window.prompt('Type DELETE to confirm:');
    if (typed !== 'DELETE') {
      alert('Cancelled. Nothing was deleted.');
      return;
    }

    try {
      await deleteDatabase();
      await openDatabase();
      await resetSettings();
      await refreshData();
      setLocalSettings(await getSettings());
      alert('All data cleared. App reset to fresh state.');
    } catch (e) {
      console.error('Clear failed:', e);
      alert('Error clearing data: ' + e.message);
    }
  }
}

// ─── Section wrapper ────────────────────────────────────────

function ExportSection({ localSettings }) {
  const [report, setReport] = useState(null);
  const [building, setBuilding] = useState(false);

  const buildReport = async () => {
    setBuilding(true);
    try {
      const teams = await getAllTeams();
      const pitchers = await getAllPitchers();

      let r = `PITCH TRACKER DATA EXPORT\nDate: ${new Date().toLocaleString()}\n\n`;

      r += `═══ TEAMS (${teams.length}) ═══\n\n`;
      for (const t of teams) {
        r += `${t.name}\n`;
        r += `  Organization: ${t.organization}\n`;
        r += `  Age Group: ${t.ageGroup}\n`;
        if (t.coach1Name) r += `  Coach 1: ${t.coach1Name} ${t.coach1Phone || ''}\n`;
        if (t.coach2Name) r += `  Coach 2: ${t.coach2Name} ${t.coach2Phone || ''}\n`;
        r += `  Pitchers: ${t.pitcherIds.length}\n\n`;
      }

      r += `═══ PITCHERS (${pitchers.length}) ═══\n\n`;
      for (const p of pitchers) {
        const pTeams = teams.filter((t) => t.pitcherIds.includes(p.id));
        r += `${p.fullName} (${p.throwingHand}HP)\n`;
        r += `  Birthday: ${p.birthday}\n`;
        r += `  Arsenal: ${p.pitchArsenal?.join(', ') || 'None'}\n`;
        r += `  Teams: ${pTeams.map((t) => t.name).join(', ') || 'Unassigned'}\n`;
        if (p.notes) r += `  Notes: ${p.notes}\n`;

        const outings = await getOutingsForPitcher(p.id);
        if (outings.length > 0) {
          r += `  Game Outings (${outings.length}):\n`;
          for (const o of outings) {
            const s = o.summary;
            const team = teams.find((t) => t.id === o.teamId);
            r += `    ${o.date} [${team?.name || 'Unknown'}]: ${s.totalPitches}p | ${s.innings} IP | ${s.strikePercent}% K | ${s.walks} BB | ${s.hitBatters} HBP | Rest: ${s.mandatoryRestDays}d\n`;
          }
        }

        const sessions = await getSessionsForPitcher(p.id);
        if (sessions.length > 0) {
          r += `  Training Sessions (${sessions.length}):\n`;
          for (const s of sessions) {
            const types = s.summary.byPitchType
              ? Object.entries(s.summary.byPitchType)
                  .filter(([_, d]) => d.count > 0)
                  .map(([type, d]) => `${type}: ${d.count}p ${d.strikePercent}%`)
                  .join(', ')
              : '';
            r += `    ${s.date}: ${s.summary.totalPitches}/${s.targetPitches}p | ${s.summary.strikePercent}% K | ${types}\n`;
            if (s.coachNotes) r += `      Notes: ${s.coachNotes}\n`;
          }
        }
        r += '\n';
      }

      r += `═══ SETTINGS ═══\n`;
      r += `Red threshold: ${localSettings.redThreshold}%\n`;
      r += `Yellow threshold: ${localSettings.yellowThreshold}%\n`;
      r += `Season start: ${localSettings.seasonStartDate}\n`;
      r += `Custom rules: ${localSettings.customPitchRules ? 'Yes' : 'No (org defaults)'}\n`;

      setReport(r);
    } catch (e) {
      console.error('Export build failed:', e);
      alert('Failed to build export: ' + e.message);
    } finally {
      setBuilding(false);
    }
  };

  if (report) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-green-700 font-medium">Report ready ({report.length} characters)</p>
        <button
          onClick={() => {
            navigator.clipboard.writeText(report)
              .then(() => alert('Report copied to clipboard!'))
              .catch(() => alert('Copy failed — try Share instead.'));
          }}
          className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold"
        >
          Copy to clipboard
        </button>
        {navigator.share && (
          <button
            onClick={() => {
              navigator.share({ title: 'Pitch Tracker Export', text: report }).catch(() => {});
            }}
            className="w-full bg-purple-600 text-white py-2.5 rounded-xl text-sm font-semibold"
          >
            Share report
          </button>
        )}
        <button
          onClick={() => setReport(null)}
          className="w-full bg-gray-200 text-gray-500 py-2 rounded-xl text-xs"
        >
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={buildReport}
        disabled={building}
        className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
      >
        {building ? 'Building report...' : 'Export all data'}
      </button>
      <p className="text-[10px] text-gray-400 mt-1">
        Builds a text report of all data, then lets you copy or share it.
      </p>
    </div>
  );
}

// ─── Section wrapper ────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 mb-3">
      <h2 className="text-sm font-semibold mb-3">{title}</h2>
      {children}
    </div>
  );
}

// ─── Preview badge ──────────────────────────────────────────

function PreviewBadge({ label, bg, text }) {
  return (
    <span
      className="flex-1 text-center py-1.5 rounded-lg text-xs font-bold"
      style={{ backgroundColor: bg, color: text }}
    >
      {label}
    </span>
  );
}

// ─── Custom Pitch Rules Editor ──────────────────────────────

function RulesEditor({ rules, onSave, onClose }) {
  const [dailyLimits, setDailyLimits] = useState([...rules.dailyLimits]);
  const [restDays, setRestDays] = useState([...rules.restDays]);
  const [error, setError] = useState(null);

  const updateLimit = (index, field, value) => {
    const updated = [...dailyLimits];
    updated[index] = { ...updated[index], [field]: parseInt(value) || 0 };
    setDailyLimits(updated);
    setError(null);
  };

  const updateRest = (index, field, value) => {
    const updated = [...restDays];
    updated[index] = { ...updated[index], [field]: parseInt(value) || 0 };
    setRestDays(updated);
    setError(null);
  };

  const handleSave = () => {
    for (const limit of dailyLimits) {
      if (limit.maxAge <= 0) { setError('All max ages must be positive'); return; }
      if (limit.pitches <= 0) { setError('All pitch limits must be positive'); return; }
    }
    for (const rest of restDays) {
      if (rest.maxPitches <= 0) { setError('All max pitches must be positive'); return; }
      if (rest.days < 0) { setError('Rest days cannot be negative'); return; }
    }

    const sortedLimits = [...dailyLimits].sort((a, b) => a.maxAge - b.maxAge);
    const sortedRest = [...restDays].sort((a, b) => a.maxPitches - b.maxPitches);

    for (let i = 1; i < sortedLimits.length; i++) {
      if (sortedLimits[i].maxAge === sortedLimits[i - 1].maxAge) {
        setError('Duplicate max age values found'); return;
      }
    }
    for (let i = 1; i < sortedRest.length; i++) {
      if (sortedRest[i].maxPitches === sortedRest[i - 1].maxPitches) {
        setError('Duplicate max pitches values found'); return;
      }
    }

    const highestAge = sortedLimits[sortedLimits.length - 1]?.maxAge || 0;
    if (highestAge < 18) {
      if (!window.confirm(`Highest age bracket is ${highestAge}. Pitchers older than this will use this bracket. Continue?`)) {
        return;
      }
    }

    onSave({ dailyLimits: sortedLimits, restDays: sortedRest });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-y-auto p-4">
      <div className="bg-white rounded-xl w-full max-w-md my-8 max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center shrink-0">
          <h2 className="text-lg font-semibold">Edit pitch count rules</h2>
          <button onClick={onClose} className="text-gray-400 text-xl">&times;</button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-5">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>
          )}

          {/* Daily limits */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Daily pitch limits by age</h3>
            <div className="space-y-2">
              {dailyLimits.map((limit, i) => (
                <div key={i} className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg">
                  <div className="flex-1">
                    <label className="text-[10px] text-gray-500">Max age</label>
                    <input
                      type="number"
                      value={limit.maxAge}
                      onChange={(e) => updateLimit(i, 'maxAge', e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      min="1"
                      max="99"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-gray-500">Pitch limit</label>
                    <input
                      type="number"
                      value={limit.pitches}
                      onChange={(e) => updateLimit(i, 'pitches', e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      min="1"
                      max="200"
                    />
                  </div>
                  <button
                    onClick={() => {
                      if (dailyLimits.length > 1) {
                        setDailyLimits(dailyLimits.filter((_, j) => j !== i));
                      }
                    }}
                    className="text-red-400 text-lg mt-3"
                  >
                    &times;
                  </button>
                </div>
              ))}
              <button
                onClick={() => setDailyLimits([...dailyLimits, { maxAge: 99, pitches: 105 }])}
                className="text-blue-600 text-xs font-medium"
              >
                + Add age bracket
              </button>
            </div>
          </div>

          {/* Rest days */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Rest days by pitch count</h3>
            <div className="space-y-2">
              {restDays.map((rest, i) => (
                <div key={i} className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg">
                  <div className="flex-1">
                    <label className="text-[10px] text-gray-500">Up to pitches</label>
                    <input
                      type="number"
                      value={rest.maxPitches}
                      onChange={(e) => updateRest(i, 'maxPitches', e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      min="1"
                      max="999"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-gray-500">Rest days</label>
                    <input
                      type="number"
                      value={rest.days}
                      onChange={(e) => updateRest(i, 'days', e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      min="0"
                      max="7"
                    />
                  </div>
                  <button
                    onClick={() => {
                      if (restDays.length > 1) {
                        setRestDays(restDays.filter((_, j) => j !== i));
                      }
                    }}
                    className="text-red-400 text-lg mt-3"
                  >
                    &times;
                  </button>
                </div>
              ))}
              <button
                onClick={() => setRestDays([...restDays, { maxPitches: 999, days: 4 }])}
                className="text-blue-600 text-xs font-medium"
              >
                + Add rest bracket
              </button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-gray-100 space-y-2 shrink-0">
          <button
            onClick={handleSave}
            className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold"
          >
            Save rules
          </button>
          <button
            onClick={onClose}
            className="w-full bg-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
