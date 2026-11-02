/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ArrowUp, CornerUpRight, Flag, TrafficCone, CreditCard, Navigation, Compass } from 'lucide-react';
import { NavManeuver } from '../types/navigation';

interface NavigationInstructionsProps {
  maneuvers: NavManeuver[];
  activeManeuverIndex: number;
  totalDistanceRemainingKm: number;
}

export const NavigationInstructions: React.FC<NavigationInstructionsProps> = ({
  maneuvers,
  activeManeuverIndex,
  totalDistanceRemainingKm
}) => {
  return (
    <div className="w-full h-full glass-panel rounded-2xl p-4 flex flex-col justify-between overflow-hidden shadow-2xl">
      {/* Header matching reference image */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-400">
            <Compass className="w-4 h-4 stroke-[2.5]" />
          </div>
          <h3 className="text-sm font-bold text-slate-100 font-display tracking-wide">
            Navigation Instructions
          </h3>
        </div>
        <span className="text-[11px] font-mono text-cyan-400 font-semibold tabular-nums">
          {totalDistanceRemainingKm} km to dest
        </span>
      </div>

      {/* Instruction List matching reference image styling */}
      <div className="mt-2.5 space-y-1.5 flex-1 overflow-y-auto pr-1">
        {maneuvers.map((item, idx) => {
          const isActive = idx === activeManeuverIndex;
          const isPassed = idx < activeManeuverIndex;

          return (
            <div
              key={item.id}
              className={`px-3 py-2.5 rounded-xl transition-all flex items-center justify-between gap-3 text-xs ${
                isActive
                  ? 'bg-gradient-to-r from-emerald-950/80 via-teal-950/60 to-slate-900 border border-emerald-500/40 text-emerald-300 shadow-md shadow-emerald-500/10'
                  : isPassed
                  ? 'bg-slate-900/30 border border-slate-800/40 text-slate-500'
                  : 'bg-slate-900/60 border border-slate-800/70 text-slate-300 hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Maneuver Icon */}
                <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                  isActive ? 'text-emerald-400' : 'text-slate-400'
                }`}>
                  {item.type === 'straight' && <ArrowUp className="w-4 h-4 stroke-[2.5]" />}
                  {item.type === 'fork' && <CornerUpRight className="w-4 h-4 stroke-[2.5]" />}
                  {item.type === 'right' && <CornerUpRight className="w-4 h-4 stroke-[2.5]" />}
                  {item.type === 'signal' && (
                    <div className="w-4 h-4 rounded bg-slate-950 border border-slate-700 flex flex-col items-center justify-around py-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    </div>
                  )}
                  {item.type === 'toll' && (
                    <div className="w-4 h-4 rounded bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-[9px]">
                      ₹
                    </div>
                  )}
                  {item.type === 'destination' && <Flag className="w-4 h-4 text-cyan-400 stroke-[2.5]" />}
                </div>

                <div className="min-w-0">
                  <div className={`font-semibold line-clamp-1 ${isActive ? 'text-emerald-200' : 'text-slate-200'}`}>
                    {item.instruction}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono truncate">
                    {item.roadName}
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className={`font-mono font-bold text-xs tabular-nums ${
                  isActive ? 'text-emerald-400' : 'text-slate-300'
                }`}>
                  {item.distanceKm} km
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
