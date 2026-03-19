import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import StrikeBadge from '../shared/StrikeBadge';
import { useData } from '../../App';
import { getLastNSessions, getSessionsForPitcher } from '../../storage';

const PITCH_COLORS = {
  '4-Seam': '#2563eb',
  '2-Seam': '#0891b2',
  'Curve': '#7c3aed',
  'Slider': '#dc2626',
  'Change': '#16a34a',
  'Splitter': '#ea580c',
  'Cutter': '#0d9488',
  'Knuckle': '#a16207',
};

export default function TrainingHistory({ pitcher, onClose }) {
  const { settings } = useData();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const historyCount = settings?.trainingHistoryCount || 5;

  useEffect(() => {
    const load = async () => {
      try {
        let loaded;
        if (historyCount >= 100) {
          // "All" — use season start date
          loaded = await getSessionsForPitcher(pitcher.id);
          const seasonStart = settings?.seasonStartDate || `${new Date().getFullYear()}-01-01`;
          loaded = loaded.filter((s) => s.date >= seasonStart);
        } else {
          loaded = await getLastNSessions(pitcher.id, historyCount);
        }
        setSessions(loaded);
      } catch (e) {
        console.error('Failed to load training history:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [pitcher.id, historyCount, settings]);

  // ─── Trend chart data ─────────────────────────────────
  const trendData = useMemo(() => {
    if (sessions.length < 2) return [];

    // Reverse to chronological order (oldest first)
    const chronological = [...sessions].reverse();

    return chronological.map((s, i) => {
      const point = {
        session: i + 1,
        date: new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        overall: s.summary.strikePercent || 0,
      };

      // Add each pitch type
      if (s.summary.byPitchType) {
        for (const [type, data] of Object.entries(s.summary.byPitchType)) {
          if (data.count > 0) {
            point[type] = data.strikePercent;
          }
        }
      }

      return point;
    });
  }, [sessions]);

  // Find all pitch types across all sessions for chart lines
  const allPitchTypes = useMemo(() => {
    const types = new Set();
    for (const s of sessions) {
      if (s.summary.byPitchType) {
        for (const [type, data] of Object.entries(s.summary.byPitchType)) {
          if (data.count > 0) types.add(type);
        }
      }
    }
    return [...types];
  }, [sessions]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        Loading history...
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto pb-4">
      {/* Header */}
      <div className="bg-white px-4 py-3 border-b border-gray-100 flex items-center gap-3">
        <button onClick={onClose} className="text-blue-600 p-1">
          <ArrowLeft size={22} />
        </button>
        <div>
          <h1 className="text-lg font-bold">Training History</h1>
          <p className="text-xs text-gray-500">{pitcher.fullName} · Last {sessions.length} sessions</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Trend chart */}
        {trendData.length >= 2 && (
          <div className="bg-white rounded-xl p-3 border border-gray-100">
            <p className="text-xs font-medium mb-2">Strike % trend by pitch type</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(value, name) => [`${value}%`, name]}
                  labelFormatter={(label) => label}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {/* Overall line */}
                <Line
                  type="monotone"
                  dataKey="overall"
                  name="Overall"
                  stroke="#333"
                  strokeWidth={2}
                  strokeDasharray="4 2"
                  dot={{ r: 3 }}
                  connectNulls
                />
                {/* Per pitch type lines */}
                {allPitchTypes.map((type) => (
                  <Line
                    key={type}
                    type="monotone"
                    dataKey={type}
                    name={type}
                    stroke={PITCH_COLORS[type] || '#999'}
                    strokeWidth={1.5}
                    dot={{ r: 2 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Session cards */}
        {sessions.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center">
            <p className="text-gray-500 text-sm">No training sessions yet.</p>
          </div>
        ) : (
          sessions.map((s) => (
            <div key={s.id} className="bg-white rounded-xl p-4 border border-gray-100">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">
                  {new Date(s.date).toLocaleDateString()}
                </span>
                <span className="text-xs text-gray-500">
                  {s.summary.totalPitches}/{s.targetPitches} pitches
                </span>
              </div>

              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs">Overall:</span>
                <StrikeBadge percentage={s.summary.strikePercent} />
              </div>

              {/* Pitch type breakdown */}
              {s.summary.byPitchType && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {Object.entries(s.summary.byPitchType)
                    .filter(([_, d]) => d.count > 0)
                    .sort((a, b) => b[1].strikePercent - a[1].strikePercent)
                    .map(([type, data]) => (
                      <span
                        key={type}
                        className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: (PITCH_COLORS[type] || '#999') + '20',
                          color: PITCH_COLORS[type] || '#666',
                        }}
                      >
                        {type}: {data.count}p {data.strikePercent}%
                      </span>
                    ))
                  }
                </div>
              )}

              {/* Coach notes */}
              {s.coachNotes && (
                <p className="text-xs text-gray-500 italic mt-1 line-clamp-2">
                  {s.coachNotes}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
