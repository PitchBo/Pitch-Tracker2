import React, { useState } from 'react';
import Modal from '../shared/Modal';
import {
  createPitcher, updatePitcher, addPitcherToTeam,
  VALID_PITCH_TYPES, VALID_THROWING_HANDS, calculateAge,
} from '../../storage';

export default function PitcherForm({ pitcher, teamId, onSave, onClose }) {
  const isEditing = !!pitcher;

  const [form, setForm] = useState({
    fullName: pitcher?.fullName || '',
    birthday: pitcher?.birthday || '',
    throwingHand: pitcher?.throwingHand || '',
    pitchArsenal: pitcher?.pitchArsenal || [],
    playerPhone: pitcher?.playerPhone || '',
    notes: pitcher?.notes || '',
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const togglePitch = (pitch) => {
    setForm((prev) => ({
      ...prev,
      pitchArsenal: prev.pitchArsenal.includes(pitch)
        ? prev.pitchArsenal.filter((p) => p !== pitch)
        : [...prev.pitchArsenal, pitch],
    }));
  };

  const derivedAge = form.birthday ? calculateAge(form.birthday) : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (isEditing) {
        await updatePitcher(pitcher.id, {
          fullName: form.fullName,
          birthday: form.birthday,
          throwingHand: form.throwingHand,
          pitchArsenal: form.pitchArsenal,
          playerPhone: form.playerPhone || null,
          notes: form.notes || null,
        });
      } else {
        const newPitcher = await createPitcher({
          fullName: form.fullName,
          birthday: form.birthday,
          throwingHand: form.throwingHand,
          pitchArsenal: form.pitchArsenal,
          playerPhone: form.playerPhone || null,
          notes: form.notes || null,
        });
        // If creating from a team context, assign to that team
        if (teamId) {
          await addPitcherToTeam(teamId, newPitcher.id);
        }
      }
      onSave();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <Modal title={isEditing ? 'Edit Pitcher' : 'Add Pitcher'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Full Name</label>
          <input
            type="text"
            required
            value={form.fullName}
            onChange={(e) => handleChange('fullName', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Birthday
            {derivedAge !== null && (
              <span className="text-gray-400 font-normal ml-2">(Age: {derivedAge})</span>
            )}
          </label>
          <input
            type="date"
            required
            value={form.birthday}
            onChange={(e) => handleChange('birthday', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Throwing Hand</label>
          <div className="flex gap-3">
            {VALID_THROWING_HANDS.map((hand) => (
              <button
                key={hand}
                type="button"
                onClick={() => handleChange('throwingHand', hand)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-colors
                  ${form.throwingHand === hand
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
              >
                {hand === 'L' ? 'Left' : 'Right'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Pitch Arsenal</label>
          <div className="grid grid-cols-2 gap-2">
            {VALID_PITCH_TYPES.map((pitch) => (
              <label
                key={pitch}
                className={`flex items-center gap-2 p-2 rounded-lg border text-sm cursor-pointer transition-colors
                  ${form.pitchArsenal.includes(pitch)
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'border-gray-200 hover:bg-gray-50'
                  }`}
              >
                <input
                  type="checkbox"
                  checked={form.pitchArsenal.includes(pitch)}
                  onChange={() => togglePitch(pitch)}
                  className="rounded border-gray-300"
                />
                {pitch}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Player Phone (optional)</label>
          <input
            type="tel"
            value={form.playerPhone}
            onChange={(e) => handleChange('playerPhone', e.target.value)}
            placeholder="555-123-4567"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">For texting training reports</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Notes (optional)
            <span className="text-gray-400 font-normal ml-2">{form.notes.length}/500</span>
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => handleChange('notes', e.target.value.slice(0, 500))}
            placeholder="Mechanics observations, development goals..."
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          />
        </div>

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
            disabled={saving || !form.throwingHand}
            className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Pitcher'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
