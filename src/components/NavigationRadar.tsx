'use client';

import React from 'react';
import { HazardItem, AlertLevel } from '@/types/vision';
import { AlertTriangle, ShieldCheck, AlertOctagon, ArrowUp, ArrowLeft, ArrowRight } from 'lucide-react';

interface NavigationRadarProps {
  hazards: HazardItem[];
  alertLevel: AlertLevel;
  spokenGuidance: string;
}

export const NavigationRadar: React.FC<NavigationRadarProps> = ({
  hazards,
  alertLevel,
  spokenGuidance,
}) => {
  const leftHazards = hazards.filter((h) => h.direction === 'left');
  const centerHazards = hazards.filter((h) => h.direction === 'center');
  const rightHazards = hazards.filter((h) => h.direction === 'right');

  const getAlertBadge = () => {
    switch (alertLevel) {
      case 'critical':
        return (
          <div className="flex items-center gap-2 bg-red-950/80 border-2 border-red-500 text-red-300 px-4 py-2 rounded-xl text-lg font-bold tracking-wide animate-pulse">
            <AlertOctagon className="w-6 h-6 text-red-400 shrink-0" />
            <span>CRITICAL HAZARD DETECTED</span>
          </div>
        );
      case 'caution':
        return (
          <div className="flex items-center gap-2 bg-amber-950/80 border-2 border-amber-500 text-amber-300 px-4 py-2 rounded-xl text-lg font-bold tracking-wide">
            <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
            <span>CAUTION: OBSTACLE NEARBY</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 bg-emerald-950/80 border-2 border-emerald-500 text-emerald-300 px-4 py-2 rounded-xl text-lg font-bold tracking-wide">
            <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
            <span>PATH CLEAR</span>
          </div>
        );
    }
  };

  const renderHazardList = (items: HazardItem[]) => {
    if (items.length === 0) {
      return <div className="text-zinc-500 text-sm italic py-2">Clear</div>;
    }
    return (
      <div className="space-y-1.5 w-full">
        {items.map((item, idx) => {
          const isImmediate = item.distance === 'immediate';
          return (
            <div
              key={idx}
              className={`p-2 rounded-lg border text-sm font-semibold flex flex-col gap-1 ${
                isImmediate
                  ? 'bg-red-900/60 border-red-500 text-red-200 animate-pulse'
                  : 'bg-zinc-800/80 border-zinc-700 text-zinc-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="capitalize">{item.name}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded uppercase font-bold ${
                    isImmediate ? 'bg-red-500 text-black' : 'bg-zinc-700 text-zinc-300'
                  }`}
                >
                  {item.distance}
                </span>
              </div>
              {item.actionGuidance && (
                <div className="text-xs text-yellow-300 font-medium">➔ {item.actionGuidance}</div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Alert Status Banner */}
      <div className="flex justify-center">{getAlertBadge()}</div>

      {/* Spoken Guidance Box (Screen Reader Accessible) */}
      <div
        role="alert"
        aria-live="assertive"
        className="w-full p-4 rounded-2xl bg-zinc-900/90 border-2 border-zinc-700 shadow-xl backdrop-blur-md"
      >
        <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">
          Active Voice Guidance
        </div>
        <p className="text-xl sm:text-2xl font-extrabold text-white tracking-tight leading-snug">
          "{spokenGuidance}"
        </p>
      </div>

      {/* Spatial 3-Zone Navigation Radar */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full">
        {/* Left Corridor */}
        <div className="flex flex-col items-center bg-zinc-900/80 border-2 border-zinc-800 rounded-2xl p-3 text-center transition-all">
          <div className="flex items-center gap-1.5 text-zinc-400 font-bold mb-2 text-sm sm:text-base">
            <ArrowLeft className="w-4 h-4 text-cyan-400" />
            <span>LEFT</span>
          </div>
          {renderHazardList(leftHazards)}
        </div>

        {/* Center / Path Ahead */}
        <div
          className={`flex flex-col items-center border-2 rounded-2xl p-3 text-center transition-all ${
            centerHazards.length > 0
              ? 'bg-red-950/30 border-red-500/80 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
              : 'bg-zinc-900/80 border-zinc-800'
          }`}
        >
          <div className="flex items-center gap-1.5 text-white font-bold mb-2 text-sm sm:text-base">
            <ArrowUp className="w-4 h-4 text-emerald-400" />
            <span>FRONT</span>
          </div>
          {renderHazardList(centerHazards)}
        </div>

        {/* Right Corridor */}
        <div className="flex flex-col items-center bg-zinc-900/80 border-2 border-zinc-800 rounded-2xl p-3 text-center transition-all">
          <div className="flex items-center gap-1.5 text-zinc-400 font-bold mb-2 text-sm sm:text-base">
            <span>RIGHT</span>
            <ArrowRight className="w-4 h-4 text-cyan-400" />
          </div>
          {renderHazardList(rightHazards)}
        </div>
      </div>
    </div>
  );
};
