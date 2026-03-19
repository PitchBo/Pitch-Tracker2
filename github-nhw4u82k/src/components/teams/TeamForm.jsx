import React, { useState } from 'react';
import Modal from '../shared/Modal';
import { createTeam, updateTeam, VALID_ORGANIZATIONS } from '../../storage';

export default function TeamForm({ team, pitchers, teams, onSave, onClose }) {
  const isEditing = !!team;

  const [form, setForm] = useState({
    name: team?.name || '',
    organization: team?.organization || '',
    ageGroup: team?.ageGroup || '',
    coach1Name: team?.coach1Name || '',
    coach1Phone: team?.coach1Phone || '',
    coach2Name: team?.coach2Name || '',
    coach2Phone: team?.coach2Phone || '',
  });

  // Show pitchers not already on THIS team (pitchers can be on multiple teams)
  const alreadyOnThisTeam = team ? team.pitcherIds : [];
  const assignable = pitchers.filter((p) => !alreadyOnThisTeam.includes(p.id));

  const [selectedIds, setSelectedIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const togglePitcher = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (isEditing) {
        const newPitcherIds = [
          ...new Set([...team.pitcherIds, ...selectedIds]),
        ];
        await updateTeam(team.id, { ...form, pitcherIds: newPitcherIds });
      } else {
        await createTeam({ ...form, pitcherIds: selectedIds });
      }
      onSave();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <Modal title={isEditing ? 'Edit Team' : 'Add Team'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Team Name</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="Hawks 12U Travel"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Organization / Rules
          </label>
          <select
            required
            value={form.organization}
            onChange={(e) => handleChange('organization', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select organization...</option>
            {VALID_ORGANIZATIONS.map((org) => (
              <option key={org.value} value={org.value}>
                {org.label}
              </option>
            ))}
          </select>
          {form.organization === 'pitchSmart' && (
            <p className="text-[10px] text-gray-400 mt-1">
              Covers Little League, USSSA, Perfect Game, AAU, NABF, AABC,
              American Legion, Babe Ruth / Cal Ripken, PONY, Dixie Youth, Game
              Day USA
            </p>
          )}
          {form.organization === 'nfhs' && (
            <p className="text-[10px] text-gray-400 mt-1">
              NFHS high school rules — 110 pitch max, NFHS rest day thresholds,
              50-pitch cap if pitched the prior day
            </p>
          )}
          {form.organization === 'custom' && (
            <p className="text-[10px] text-gray-400 mt-1">
              Uses custom pitch count rules configured in Settings
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Age Group</label>
          <input
            type="text"
            required
            value={form.ageGroup}
            onChange={(e) => handleChange('ageGroup', e.target.value)}
            placeholder="12U, 14U, Varsity, etc."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Coaches */}
        <div className="border-t pt-4">
          <p className="text-sm font-medium mb-3">Coaches (optional)</p>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={form.coach1Name}
                onChange={(e) => handleChange('coach1Name', e.target.value)}
                placeholder="Coach 1 name"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="tel"
                value={form.coach1Phone}
                onChange={(e) => handleChange('coach1Phone', e.target.value)}
                placeholder="Phone"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={form.coach2Name}
                onChange={(e) => handleChange('coach2Name', e.target.value)}
                placeholder="Coach 2 name"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="tel"
                value={form.coach2Phone}
                onChange={(e) => handleChange('coach2Phone', e.target.value)}
                placeholder="Phone"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Assign pitchers */}
        {assignable.length > 0 && (
          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-2">Assign existing pitchers</p>
            <p className="text-xs text-gray-500 mb-3">
              Pitchers can be on multiple teams.
            </p>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {assignable.map((p) => {
                const onTeams = teams.filter((t) =>
                  t.pitcherIds.includes(p.id)
                );
                return (
                  <label
                    key={p.id}
                    className="flex items-center gap-2 p-2 rounded hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(p.id)}
                      onChange={() => togglePitcher(p.id)}
                      className="rounded border-gray-300"
                    />
                    <div>
                      <span className="text-sm">{p.fullName}</span>
                      {onTeams.length > 0 && (
                        <span className="text-xs text-gray-400 ml-1">
                          ({onTeams.map((t) => t.name).join(', ')})
                        </span>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Team'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
