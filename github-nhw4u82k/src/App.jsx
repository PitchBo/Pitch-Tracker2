import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import BottomNav from './components/layout/BottomNav';
import TeamsPage from './pages/TeamsPage';
import GamePage from './pages/GamePage';
import TrainingPage from './pages/TrainingPage';
import SettingsPage from './pages/SettingsPage';
import { openDatabase, getSettings, getAllDrafts } from './storage';

// ─── Navigation Context ─────────────────────────────────────────
// Simple stack-based navigation within tabs

const NavContext = createContext();

export function useNav() {
  return useContext(NavContext);
}

// ─── Data Context ────────────────────────────────────────────────
// Shared data that multiple components need (settings, drafts)

const DataContext = createContext();

export function useData() {
  return useContext(DataContext);
}

export default function App() {
  const [activeTab, setActiveTab] = useState('teams');
  const [navStack, setNavStack] = useState([]); // Stack of { view, props } for sub-navigation
  const [storageReady, setStorageReady] = useState(false);
  const [settings, setSettings] = useState(null);
  const [drafts, setDrafts] = useState({ game: null, training: null });
  const [refreshKey, setRefreshKey] = useState(0); // Increment to trigger data reload in child components
  const [pendingGameTeamId, setPendingGameTeamId] = useState(null); // Set by Teams to launch game

  // Initialize storage on mount
  useEffect(() => {
    const init = async () => {
      try {
        await openDatabase();
        const loadedSettings = await getSettings();
        const loadedDrafts = await getAllDrafts();
        setSettings(loadedSettings);
        setDrafts(loadedDrafts);
        setStorageReady(true);
      } catch (error) {
        console.error('Storage init failed:', error);
        setStorageReady(true); // Continue without — will use defaults
      }
    };
    init();
  }, []);

  // Navigation helpers
  const navigate = useCallback((view, props = {}) => {
    setNavStack((prev) => [...prev, { view, props }]);
  }, []);

  const goBack = useCallback(() => {
    setNavStack((prev) => prev.slice(0, -1));
  }, []);

  const resetNav = useCallback(() => {
    setNavStack([]);
  }, []);

  // When switching tabs, reset sub-navigation
  const switchTab = useCallback((tab) => {
    setActiveTab(tab);
    setNavStack([]);
  }, []);

  // Trigger data refresh in children (call after any write operation)
  const refreshData = useCallback(async () => {
    setRefreshKey((k) => k + 1);
    try {
      const loadedSettings = await getSettings();
      const loadedDrafts = await getAllDrafts();
      setSettings(loadedSettings);
      setDrafts(loadedDrafts);
    } catch (e) {
      console.error('Refresh failed:', e);
    }
  }, []);

  const currentSubView = navStack.length > 0 ? navStack[navStack.length - 1] : null;

  // Launch game mode from Teams tab
  const startGameForTeam = useCallback((teamId) => {
    setPendingGameTeamId(teamId);
    setActiveTab('game');
    setNavStack([]);
  }, []);

  const navValue = { navigate, goBack, resetNav, currentSubView, navStack };
  const dataValue = { settings, drafts, storageReady, refreshKey, refreshData, setSettings, pendingGameTeamId, setPendingGameTeamId, startGameForTeam };

  // Loading screen
  if (!storageReady) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-2xl font-bold mb-2">Pitch Tracker</div>
          <div className="text-gray-500 text-sm">Loading...</div>
        </div>
      </div>
    );
  }

  // Determine if bottom nav should be hidden (during active game/training)
  const hideNav = false; // Will be set by game/training modules later

  return (
    <DataContext.Provider value={dataValue}>
      <NavContext.Provider value={navValue}>
        <div className="h-screen flex flex-col bg-gray-50">
          {/* Page content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'teams' && <TeamsPage />}
            {activeTab === 'game' && <GamePage />}
            {activeTab === 'training' && <TrainingPage />}
            {activeTab === 'settings' && <SettingsPage />}
          </div>

          {/* Bottom navigation */}
          {!hideNav && (
            <BottomNav activeTab={activeTab} onTabChange={switchTab} />
          )}
        </div>
      </NavContext.Provider>
    </DataContext.Provider>
  );
}
