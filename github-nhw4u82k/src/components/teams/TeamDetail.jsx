import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { useNav, useData } from '../../App';
import {
  getTeam, getAllPitchers, removePitcherFromTeam,
  MAX_PITCHERS_PER_TEAM,
} from '../../storage';
import PitcherRosterCard from './PitcherRosterCard';
import PitcherForm from './PitcherForm';
import PitcherDetailCard from '../shared/PitcherDetailCard';
import AvailablePitchersRanking from './AvailablePitchersRanking';

export default function TeamDetail({ teamId, onDataChange }) {
  const { goBack } = useNav();
  const { refreshKey, drafts, startGameForTeam } = useData();

  const [team, setTeam] = useState(null);
  const [allPitchers, setAllPitchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('roster'); // 'roster' or 'available'
  const [showPitcherForm, setShowPitcherForm] = useState(false);
  const [editingPitcher, setEditingPitcher] = useState(null);
  const [viewingPitcher, setViewingPitcher] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const [t, p] = await Promise.all([getTeam(teamId), getAllPitchers()]);
      setTeam(t);
      setAllPitchers(p);
    } catch (e) {
      console.error('Failed to load team detail:', e);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshKey]);

  const handleDataChange = () => {
    loadData();
    onDataChange();
  };

  const handleRemovePitcher = async (pitcherId) => {
    const pitcher = allPitchers.find((p) => p.id === pitcherId);
    if (window.confirm(`Remove ${pitcher?.fullName} from this team?\n\nThe pitcher and their stats will be kept.`)) {
      await removePitcherFromTeam(teamId, pitcherId);
      handleDataChange();
    }
  };

  const handleEditPitcher = (pitcher) => {
    setEditingPitcher(pitcher);
    setShowPitcherForm(true);
  };

  const handlePitcherFormClose = () => {
    setShowPitcherForm(false);
    setEditingPitcher(null);
  };

  const handlePitcherFormSave = () => {
    handlePitcherFormClose();
    handleDataChange();
  };

  if (loading || !team) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="text-gray-400">Loading...</span>
      </div>
    );
  }

  const teamPitchers = allPitchers.filter((p) => team.pitcherIds.includes(p.id));

  // Check for paused game on this team
  const hasPausedGame = drafts?.game?.teamId === team.id;
  const hasPausedGameOtherTeam = drafts?.game && drafts.game.teamId !== team.id;

  return (
    <div className="h-full flex flex-col">
      {/* Team header */}
      <div className="bg-white px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={goBack} className="text-blue-600 p-1">
            <ArrowLeft size={22} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold leading-tight">{team.name}</h1>
            <p className="text-xs text-gray-500">{team.organization} · {team.ageGroup}</p>
          </div>
        </div>

        {/* Paused game banner */}
        {hasPausedGame && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-2 mb-2">
            <p className="text-xs text-orange-800 font-medium">
              Game in progress — {drafts.game.pitcherName}, {drafts.game.pitchCount} pitches
            </p>
            <button className="text-xs text-orange-600 font-semibold mt-1 underline">
              Resume Game
            </button>
          </div>
        )}
        {hasPausedGameOtherTeam && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 mb-2">
            <p className="text-xs text-yellow-800">
              Game in progress with another team. End that game before starting a new one.
            </p>
          </div>
        )}

        {/* Sub-tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setTab('roster')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors
              ${tab === 'roster' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
          >
            Roster ({teamPitchers.length}/{MAX_PITCHERS_PER_TEAM})
          </button>
          <button
            onClick={() => setTab('available')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors
              ${tab === 'available' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
          >
            Available Ranking
          </button>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'roster' && (
          <div className="p-4 space-y-3">
            {/* Action bar */}
            <div className="flex gap-2">
              {teamPitchers.length < MAX_PITCHERS_PER_TEAM && (
                <button
                  onClick={() => setShowPitcherForm(true)}
                  className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-medium hover:bg-blue-700"
                >
                  <Plus size={16} /> Add Pitcher
                </button>
              )}
              {teamPitchers.length > 0 && !hasPausedGame && !hasPausedGameOtherTeam && (
                <button
                  className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-2 rounded-lg text-xs font-medium hover:bg-green-700"
                  onClick={() => startGameForTeam(team.id)}
                >
                  Start Game
                </button>
              )}
            </div>

            {/* Pitcher cards */}
            {teamPitchers.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center">
                <p className="text-gray-500 text-sm mb-3">No pitchers on this roster yet.</p>
                <button
                  onClick={() => setShowPitcherForm(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  Add First Pitcher
                </button>
              </div>
            ) : (
              teamPitchers.map((pitcher) => (
                <PitcherRosterCard
                  key={pitcher.id}
                  pitcher={pitcher}
                  organization={team.organization}
                  onEdit={() => handleEditPitcher(pitcher)}
                  onRemove={() => handleRemovePitcher(pitcher.id)}
                  onViewStats={() => setViewingPitcher(pitcher)}
                />
              ))
            )}
          </div>
        )}

        {tab === 'available' && (
          <AvailablePitchersRanking
            pitchers={teamPitchers}
            organization={team.organization}
          />
        )}
      </div>

      {/* Pitcher form modal */}
      {showPitcherForm && (
        <PitcherForm
          pitcher={editingPitcher}
          teamId={team.id}
          onSave={handlePitcherFormSave}
          onClose={handlePitcherFormClose}
        />
      )}

      {/* Pitcher detail modal */}
      {viewingPitcher && (
        <PitcherDetailCard
          pitcher={viewingPitcher}
          onClose={() => setViewingPitcher(null)}
        />
      )}
    </div>
  );
}
