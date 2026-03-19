import React, { useState, useEffect, useCallback } from 'react';
import { useNav, useData } from '../App';
import { getAllTeams, getAllPitchers } from '../storage';
import TeamList from '../components/teams/TeamList';
import TeamDetail from '../components/teams/TeamDetail';
import AllPitchers from '../components/shared/AllPitchers';

export default function TeamsPage() {
  const { currentSubView } = useNav();
  const { refreshKey } = useData();
  const [tab, setTab] = useState('teams'); // 'teams' or 'pitchers'
  const [teams, setTeams] = useState([]);
  const [pitchers, setPitchers] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [t, p] = await Promise.all([getAllTeams(), getAllPitchers()]);
      setTeams(t);
      setPitchers(p);
    } catch (e) {
      console.error('Failed to load data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, refreshKey]);

  // Sub-navigation: if we've navigated into a team detail, show that instead
  if (currentSubView?.view === 'teamDetail') {
    return (
      <TeamDetail
        teamId={currentSubView.props.teamId}
        onDataChange={loadData}
      />
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="text-gray-400">Loading...</span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Tab toggle */}
      <div className="bg-white px-4 pt-3 pb-2 border-b border-gray-100">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setTab('teams')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors
              ${tab === 'teams' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
          >
            Teams ({teams.length})
          </button>
          <button
            onClick={() => setTab('pitchers')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors
              ${tab === 'pitchers' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
          >
            All Pitchers ({pitchers.length})
          </button>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'teams' && (
          <TeamList teams={teams} pitchers={pitchers} onDataChange={loadData} />
        )}
        {tab === 'pitchers' && (
          <AllPitchers pitchers={pitchers} teams={teams} onDataChange={loadData} />
        )}
      </div>
    </div>
  );
}
