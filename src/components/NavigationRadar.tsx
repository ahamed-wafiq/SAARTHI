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

  const getAlertBanner = () => {
    switch (alertLevel) {
      case 'critical':
        return (
          <div className="w-full flex items-center justify-center gap-2.5 bg-red-950/70 border-2 border-red-500/80 text-red-200 px-4 py-2.5 rounded-xl shadow-[0_0_20px_rgba(239,68,68,0.25)] animate-pulse">
            <AlertOctagon className="w-5 h-5 text-red-400 shrink-0" />
            <span className="text-sm sm:text-base font-black tracking-wider uppercase">
              CRITICAL: IMMEDIATE OBSTACLE
            </span>
          </div>
        );
      case 'caution':
        return (
          <div className="w-full flex items-center justify-center gap-2.5 bg-amber-950/60 border-2 border-amber-500/80 text-amber-200 px-4 py-2.5 rounded-xl shadow-[0_0_15px_rgba(245,158,11,0.15)]">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <span className="text-sm sm:text-base font-black tracking-wider uppercase">
              CAUTION: OBSTACLE NEARBY
            </span>
          </div>
        );
      default:
        return (
          <div className="w-full flex items-center justify-center gap-2.5 bg-emerald-950/50 border border-emerald-500/60 text-emerald-200 px-4 py-2 rounded-xl">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="text-sm sm:text-base font-bold tracking-wider uppercase">
              PATH CLEAR AHEAD
            </span>
          </div>
        );
    }
  };

  const renderHazardList = (items: HazardItem[]) => {
    if (items.length === 0) {
      return (
        <div className="text-zinc-600 text-xs italic py-2 flex items-center justify-center h-full">
          Clear
        </div>
      );
    }

    return (
      <div className="space-y-1.5 w-full">
        {items.map((item, idx) => {
          const isImmediate = item.distance === 'immediate';
          const isNear = item.distance === 'near';

          return (
            <div
              key={idx}
              className={`p-2 rounded-lg border text-left flex flex-col gap-1 overflow-hidden transition-all ${
                isImmediate
                  ? 'bg-red-950/60 border-red-500/80 text-red-100 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
                  : isNear
                  ? 'bg-amber-950/40 border-amber-600/60 text-amber-100'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-300'
              }`}
            >
              {/* Item Name (Truncated cleanly) */}
              <div className="text-xs font-bold capitalize truncate leading-tight">
                {item.name}
              </div>

              {/* Distance Tag (Stacked vertically to prevent horizontal clipping) */}
              <div>
                <span
                  className={`inline-block text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                    isImmediate
                      ? 'bg-red-500 text-black font-extrabold'
                      : isNear
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {item.distance}
                </span>
              </div>

              {/* Action guidance if provided */}
              {item.actionGuidance && (
                <div className="text-[10px] text-yellow-300 font-semibold truncate leading-tight pt-0.5">
                  ➔ {item.actionGuidance}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col gap-2.5">
      {/* Alert Status Banner */}
      {getAlertBanner()}

      {/* Spoken Guidance Box (Screen Reader Accessible) */}
      <div
        role="alert"
        aria-live="assertive"
        className="w-full p-3 sm:p-4 rounded-2xl bg-[#0e0e12] border border-zinc-800/90 shadow-xl"
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
            Active Voice Guidance
          </span>
          <span className="text-[10px] text-cyan-400 bg-cyan-950/50 border border-cyan-800/50 px-2 py-0.5 rounded-full font-medium">
            Sarvam AI Human Voice
          </span>
        </div>
        <p className="text-lg sm:text-xl font-extrabold text-white tracking-tight leading-snug">
          "{spokenGuidance}"
        </p>
      </div>

      {/* Spatial 3-Zone Navigation Radar */}
      <div className="grid grid-cols-3 gap-2 w-full">
        {/* Left Corridor */}
        <div className="flex flex-col bg-[#0e0e12] border border-zinc-800 rounded-2xl p-2.5 min-h-[90px] overflow-hidden">
          <div className="flex items-center justify-center gap-1 text-zinc-400 font-bold mb-1.5 text-xs">
            <ArrowLeft className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>LEFT</span>
          </div>
          {renderHazardList(leftHazards)}
        </div>

        {/* Center / Front Path */}
        <div
          className={`flex flex-col border rounded-2xl p-2.5 min-h-[90px] overflow-hidden transition-all ${
            centerHazards.some((h) => h.distance === 'immediate')
              ? 'bg-red-950/40 border-red-500/90 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
              : centerHazards.length > 0
              ? 'bg-amber-950/30 border-amber-500/70'
              : 'bg-[#0e0e12] border-zinc-800'
          }`}
        >
          <div className="flex items-center justify-center gap-1 text-white font-bold mb-1.5 text-xs">
            <ArrowUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>FRONT</span>
          </div>
          {renderHazardList(centerHazards)}
        </div>

        {/* Right Corridor */}
        <div className="flex flex-col bg-[#0e0e12] border border-zinc-800 rounded-2xl p-2.5 min-h-[90px] overflow-hidden">
          <div className="flex items-center justify-center gap-1 text-zinc-400 font-bold mb-1.5 text-xs">
            <span>RIGHT</span>
            <ArrowRight className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          </div>
          {renderHazardList(rightHazards)}
        </div>
      </div>
    </div>
  );
};
