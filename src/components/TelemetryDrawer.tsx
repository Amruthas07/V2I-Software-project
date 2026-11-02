/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Gauge, Radio, TrafficCone, CreditCard, Clock, Activity, CheckCircle2 } from 'lucide-react';
import { VehicleTelemetry, RSUData, TrafficSignalData, TollPlazaData, EventLogItem } from '../types/navigation';

interface TelemetryDrawerProps {
  telemetry: VehicleTelemetry;
  activeRsu: RSUData | null;
  activeSignal: TrafficSignalData | null;
  activeToll: TollPlazaData | null;
  events: EventLogItem[];
  hasToll: boolean;
}

export const TelemetryDrawer: React.FC<TelemetryDrawerProps> = ({
  telemetry,
  activeRsu,
  activeSignal,
  activeToll,
  events,
  hasToll
}) => {
  const [activeFilter, setActiveFilter] = useState<string>('ALL');

  const filteredEvents = activeFilter === 'ALL'
    ? events
    : events.filter((e) => e.category === activeFilter);

  return (
    <div className="space-y-4">
      {/* 4 Telemetry & V2I Live Control Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CARD 1: SPEEDOMETER */}
        <div className="glass-panel rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 font-display">
                Speed Telemetry
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/30 text-cyan-400">
              {telemetry.isStoppedAtSignal ? 'STOPPED' : 'CRUISE 80'}
            </span>
          </div>

          <div className="relative flex items-center justify-center my-1">
            <svg className="w-36 h-28" viewBox="0 0 160 120">
              <path d="M 25 105 A 60 60 0 1 1 135 105" fill="none" stroke="#1e293b" strokeWidth="10" strokeLinecap="round" />
              <path
                d="M 25 105 A 60 60 0 1 1 135 105"
                fill="none"
                stroke="url(#speedDrawerGrad)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray="260"
                strokeDashoffset={260 - (Math.min(telemetry.speedKmH, 140) / 140) * 260}
                className="transition-all duration-300"
              />
              <defs>
                <linearGradient id="speedDrawerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#06b6d4" />
                  <stop offset="60%" stopColor="#2dd4bf" />
                  <stop offset="100%" stopColor="#ef4444" />
                </linearGradient>
              </defs>
              <text x="80" y="78" textAnchor="middle" fill="#f8fafc" fontSize="30" fontWeight="bold" fontFamily="monospace">
                {telemetry.speedKmH}
              </text>
              <text x="80" y="96" textAnchor="middle" fill="#94a3b8" fontSize="10" fontFamily="sans-serif">
                KM/H
              </text>
            </svg>
          </div>

          <div className="flex items-center justify-between text-xs font-mono pt-2 border-t border-slate-800">
            <span className="text-slate-400">Target Speed:</span>
            <span className="text-amber-400 font-bold">{telemetry.targetSpeedKmH} km/h</span>
          </div>
        </div>

        {/* CARD 2: RSU INFRASTRUCTURE STATUS */}
        <div className="glass-panel rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 font-display">
                RSU Infrastructure
              </span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              CONNECTED
            </span>
          </div>

          <div className="my-2 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-mono text-[11px]">Active Unit:</span>
              <span className="font-bold text-cyan-300 font-mono">{activeRsu?.name || 'RSU-KAD-01'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-mono text-[11px]">Range:</span>
              <span className="text-slate-200 font-mono">{activeRsu?.rangeM || 300} m</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-mono text-[11px]">Frequency:</span>
              <span className="text-purple-300 font-mono">5.890 GHz C-V2X</span>
            </div>
            <div className="p-2 rounded-lg bg-cyan-950/40 border border-cyan-500/20 text-[11px] text-cyan-200 mt-1">
              <span className="font-semibold block text-cyan-300">Active Advisory:</span>
              {activeRsu?.lastMessage || 'GLOSA Synchronized Corridor · Speed Advisory: 80 km/h'}
            </div>
          </div>

          <div className="text-[10px] text-slate-500 font-mono pt-2 border-t border-slate-800 flex justify-between">
            <span>DSRC 5.9 GHz</span>
            <span>Packet Rate: 10 Hz BSM</span>
          </div>
        </div>

        {/* CARD 3: TRAFFIC SIGNAL STATUS (GLOSA) */}
        <div className="glass-panel rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrafficCone className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 font-display">
                Traffic Signal (GLOSA)
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              SPAT v2
            </span>
          </div>

          <div className="my-2 space-y-2">
            <div className="text-xs text-slate-300 truncate">
              Upcoming: <span className="font-semibold text-slate-100">{activeSignal?.name || 'Mysuru Ring Road Signal'}</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                    activeSignal?.currentPhase === 'green'
                      ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30'
                      : activeSignal?.currentPhase === 'amber'
                      ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30'
                      : 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                  }`}
                >
                  {activeSignal?.currentPhase === 'green' ? 'G' : activeSignal?.currentPhase === 'amber' ? 'A' : 'R'}
                </div>
                <div>
                  <div className="text-xs font-bold capitalize text-slate-100 font-display">
                    {activeSignal?.currentPhase || 'green'} Phase
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Countdown Timer
                  </div>
                </div>
              </div>

              <div className="text-right">
                <span className="text-2xl font-black font-mono text-cyan-400 tabular-nums">
                  {activeSignal?.countdownSeconds || 24}s
                </span>
              </div>
            </div>

            <div className="text-[11px] text-emerald-400 font-mono flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              GLOSA Target: Maintain 75 km/h
            </div>
          </div>

          <div className="text-[10px] text-slate-500 font-mono pt-2 border-t border-slate-800">
            Signal Link: C-V2X Direct Sync
          </div>
        </div>

        {/* CARD 4: TOLL & FASTag CARD */}
        <div className="glass-panel rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 font-display">
                Toll & FASTag
              </span>
            </div>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
              hasToll
                ? 'bg-amber-950 border border-amber-500/30 text-amber-400'
                : 'bg-emerald-950 border border-emerald-500/30 text-emerald-400'
            }`}>
              {hasToll ? 'HIGHWAY TOLL' : 'TOLL-FREE'}
            </span>
          </div>

          <div className="my-2 space-y-2">
            <div>
              <div className="text-xs text-slate-400 font-medium">Plaza Name:</div>
              <div className="text-xs font-bold text-slate-100 truncate">
                {hasToll ? (activeToll?.name || 'Kadakola Toll Plaza (NH 766)') : 'Urban City Route (No Toll)'}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-mono text-[11px]">Toll Amount:</span>
                <span className={`font-bold font-mono ${hasToll ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {hasToll ? `₹${activeToll?.fee || 55}.00` : '₹0.00 (Free)'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-mono text-[11px]">Payment Status:</span>
                <span className="text-emerald-400 font-bold font-mono flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {hasToll ? 'Payment Successful' : 'Toll-Free Corridor'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span>Txn ID:</span>
                <span className="text-slate-300">{hasToll ? (activeToll?.txId || 'FTG7843921') : 'N/A'}</span>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-slate-400 font-mono pt-2 border-t border-slate-800 flex justify-between">
            <span>FASTag Wallet: ₹1,420.00</span>
            <span className="text-cyan-400">{hasToll ? 'Lane 03 Express' : 'City Lane'}</span>
          </div>
        </div>
      </div>

      {/* Real-Time Event Log */}
      <div className="glass-panel rounded-2xl p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-display">
              Live Event Log · Telemetry & V2I Incident Stream
            </h3>
          </div>

          {/* Event Filters */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-[10px]">
            {['ALL', 'V2I', 'SIGNAL', 'TOLL', 'SAFETY'].map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveFilter(cat)}
                className={`px-2 py-1 rounded font-medium transition-colors ${
                  activeFilter === cat
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
          {filteredEvents.map((evt) => (
            <div
              key={evt.id}
              className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-colors flex items-start justify-between gap-4 text-xs"
            >
              <div className="flex items-start gap-3">
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase mt-0.5 shrink-0 ${
                    evt.category === 'V2I'
                      ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/30'
                      : evt.category === 'SIGNAL'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                      : evt.category === 'TOLL'
                      ? 'bg-amber-950 text-amber-300 border border-amber-500/30'
                      : 'bg-rose-950 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {evt.category}
                </span>

                <div>
                  <div className="font-semibold text-slate-200">{evt.title}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{evt.description}</div>
                </div>
              </div>

              <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap shrink-0">
                {evt.timestamp}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
