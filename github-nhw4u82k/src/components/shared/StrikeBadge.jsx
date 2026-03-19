import React from 'react';
import { useData } from '../../App';
import { getStrikeColor } from '../../storage';

export default function StrikeBadge({ percentage }) {
  const { settings } = useData();
  const colors = getStrikeColor(percentage, settings);

  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-bold min-w-[42px] text-center"
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      {percentage}%
    </span>
  );
}
