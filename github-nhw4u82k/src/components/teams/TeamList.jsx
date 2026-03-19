import React, { useState } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useNav } from '../../App';
import { deleteTeam, MAX_TEAMS } from '../../storage';
import TeamForm from './TeamForm';

export default function TeamList({ teams, pitchers, onDataChange }) {
  const { navigate } = useNav();
  const [showForm, setShowForm] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);

  const handleDelete = async (team, e) => {
    e.stopPropagation();
    if (window.confirm(`Delete "${team.name}"?\n\nPitchers will not be deleted — they'll become unassigned.`)) {
      await deleteTeam(team.id);
      onDataChange();
    }
  };

  const handleEdit = (team, e) => {
    e.stopPropagation();
    setEditingTeam(team);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingTeam(null);
  };

  const handleFormSave = () => {
    handleFormClose();
    onDataChange();
  };

  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">My Teams ({teams.length}/{MAX_TEAMS})</h1>
        {teams.length < MAX_TEAMS && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 active:scale-[0.98]"
          >
            <Plus size={18} /> Add Team
          </button>
        )}
      </div>

      {/* Team cards */}
      {teams.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center">
          <p className="text-gray-500 mb-4">No teams yet. Add your first team to get started.</p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Add Team
          </button>
        </div>
      ) : (
        teams.map((team) => {
          const teamPitchers = pitchers.filter((p) => team.pitcherIds.includes(p.id));
          return (
            <div
              key={team.id}
              onClick={() => navigate('teamDetail', { teamId: team.id })}
              className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 active:bg-gray-50 relative"
            >
              <div className="pr-16">
                <h3 className="font-semibold text-base">{team.name}</h3>
                <p className="text-gray-500 text-sm">{team.organization}</p>
                <p className="text-gray-400 text-xs mt-0.5">{team.ageGroup}</p>
                <p className="text-gray-500 text-sm mt-2">
                  {teamPitchers.length} pitcher{teamPitchers.length !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Status dot */}
              <div className={`absolute top-4 right-4 w-2.5 h-2.5 rounded-full
                ${teamPitchers.length > 0 ? 'bg-green-500' : 'bg-gray-300'}`} />

              {/* Action buttons */}
              <div className="absolute bottom-4 right-4 flex gap-3">
                <button
                  onClick={(e) => handleEdit(team, e)}
                  className="text-blue-500 hover:text-blue-700 p-1"
                >
                  <Edit size={18} />
                </button>
                <button
                  onClick={(e) => handleDelete(team, e)}
                  className="text-red-400 hover:text-red-600 p-1"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          );
        })
      )}

      {/* Team form modal */}
      {showForm && (
        <TeamForm
          team={editingTeam}
          pitchers={pitchers}
          teams={teams}
          onSave={handleFormSave}
          onClose={handleFormClose}
        />
      )}
    </div>
  );
}
