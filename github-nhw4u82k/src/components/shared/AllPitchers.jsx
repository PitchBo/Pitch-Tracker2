import React, { useState } from 'react';
import { Edit, Trash2, BarChart3 } from 'lucide-react';
import {
  calculateAge, deletePitcher, deletePitcherStats,
  getTeamsForPitcher, calculateAvailability,
  countOutingsForPitcher, countSessionsForPitcher,
} from '../../storage';
import PitcherForm from '../teams/PitcherForm';
import PitcherDetailCard from './PitcherDetailCard';

export default function AllPitchers({ pitchers, teams, onDataChange }) {
  const [editingPitcher, setEditingPitcher] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [viewingPitcher, setViewingPitcher] = useState(null);

  const handleDeletePitcher = async (pitcher) => {
    const outingCount = await countOutingsForPitcher(pitcher.id);
    const sessionCount = await countSessionsForPitcher(pitcher.id);
    const totalRecords = outingCount + sessionCount;

    const message = totalRecords > 0
      ? `Permanently delete ${pitcher.fullName}?\n\nThis will also remove:\n- ${outingCount} game outing(s)\n- ${sessionCount} training session(s)\n\nThis cannot be undone.`
      : `Permanently delete ${pitcher.fullName}?`;

    if (window.confirm(message)) {
      await deletePitcher(pitcher.id);
      onDataChange();
    }
  };

  const handleDeleteStats = async (pitcher) => {
    const outingCount = await countOutingsForPitcher(pitcher.id);
    const sessionCount = await countSessionsForPitcher(pitcher.id);

    if (outingCount === 0 && sessionCount === 0) {
      alert('No stats to delete for this pitcher.');
      return;
    }

    if (window.confirm(
      `Delete all stats for ${pitcher.fullName}?\n\n` +
      `This will remove:\n- ${outingCount} game outing(s)\n- ${sessionCount} training session(s)\n\n` +
      `Pitcher profile (name, birthday, arsenal) will be kept.`
    )) {
      await deletePitcherStats(pitcher.id);
      onDataChange();
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingPitcher(null);
  };

  const handleFormSave = () => {
    handleFormClose();
    onDataChange();
  };

  const getPitcherTeams = (pitcherId) => {
    return teams.filter((t) => t.pitcherIds.includes(pitcherId));
  };

  if (pitchers.length === 0) {
    return (
      <div className="p-4">
        <h1 className="text-xl font-bold mb-4">All Pitchers</h1>
        <div className="bg-white rounded-xl p-8 text-center">
          <p className="text-gray-500 text-sm mb-3">No pitchers in database.</p>
          <p className="text-gray-400 text-xs">Add pitchers through a team, or create one here.</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Add Pitcher
          </button>
        </div>

        {showForm && (
          <PitcherForm
            pitcher={null}
            teamId={null}
            onSave={handleFormSave}
            onClose={handleFormClose}
          />
        )}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">All Pitchers ({pitchers.length})</h1>
        <button
          onClick={() => setShowForm(true)}
          className="text-blue-600 text-sm font-medium"
        >
          + Add
        </button>
      </div>

      {pitchers.map((pitcher) => {
        const pitcherTeams = getPitcherTeams(pitcher.id);
        const age = calculateAge(pitcher.birthday);

        return (
          <div key={pitcher.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h3 className="font-semibold text-sm">
                  {pitcher.fullName}, {age}
                  <span className="text-gray-400 font-normal ml-1">({pitcher.throwingHand}HP)</span>
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(pitcher.birthday).toLocaleDateString()}
                </p>
                {pitcherTeams.length > 0 ? (
                  <p className="text-xs text-blue-600 mt-1">
                    {pitcherTeams.map((t) => t.name).join(', ')}
                  </p>
                ) : (
                  <p className="text-xs text-orange-500 mt-1">Not assigned to any team</p>
                )}
              </div>
              <div className="flex gap-2 shrink-0 ml-2">
                <button
                  onClick={() => { setEditingPitcher(pitcher); setShowForm(true); }}
                  className="text-blue-500 p-1"
                >
                  <Edit size={16} />
                </button>
                <button
                  onClick={() => handleDeletePitcher(pitcher)}
                  className="text-red-400 p-1"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Arsenal */}
            {pitcher.pitchArsenal?.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {pitcher.pitchArsenal.map((p) => (
                  <span key={p} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                    {p}
                  </span>
                ))}
              </div>
            )}

            {/* Notes preview */}
            {pitcher.notes && (
              <p className="text-xs text-gray-400 mb-2 line-clamp-2">{pitcher.notes}</p>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setViewingPitcher(pitcher)}
                className="flex-1 flex items-center justify-center gap-1 bg-blue-50 text-blue-700 py-2 rounded-lg text-xs font-medium hover:bg-blue-100"
              >
                <BarChart3 size={14} /> View Stats
              </button>
              <button
                onClick={() => handleDeleteStats(pitcher)}
                className="flex items-center justify-center gap-1 bg-orange-50 text-orange-600 py-2 px-3 rounded-lg text-xs font-medium hover:bg-orange-100"
              >
                <Trash2 size={14} /> Clear Stats
              </button>
            </div>
          </div>
        );
      })}

      {/* Modals */}
      {showForm && (
        <PitcherForm
          pitcher={editingPitcher}
          teamId={null}
          onSave={handleFormSave}
          onClose={handleFormClose}
        />
      )}
      {viewingPitcher && (
        <PitcherDetailCard
          pitcher={viewingPitcher}
          onClose={() => setViewingPitcher(null)}
        />
      )}
    </div>
  );
}
