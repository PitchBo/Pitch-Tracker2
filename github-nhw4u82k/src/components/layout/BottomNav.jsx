import React from 'react';
import { Users, Crosshair, TrendingUp, Settings } from 'lucide-react';

const tabs = [
  { key: 'teams', label: 'Teams', Icon: Users },
  { key: 'game', label: 'Game', Icon: Crosshair },
  { key: 'training', label: 'Training', Icon: TrendingUp },
  { key: 'settings', label: 'Settings', Icon: Settings },
];

export default function BottomNav({ activeTab, onTabChange }) {
  return (
    <nav className="bg-white border-t border-gray-200 pb-safe">
      <div className="flex justify-around items-center h-14">
        {tabs.map(({ key, label, Icon }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => onTabChange(key)}
              className={`flex flex-col items-center justify-center gap-0.5 w-full h-full
                ${isActive ? 'text-blue-600' : 'text-gray-400'}`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
