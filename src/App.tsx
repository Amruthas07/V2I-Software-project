/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Car,
  Navigation,
  Compass,
  Zap,
  Radio,
  TrafficCone,
  CreditCard,
  Gauge,
  Clock,
  MapPin,
  Layers,
  Wifi,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Sliders,
  ChevronRight,
  Maximize2,
  Minimize2,
  Shield,
  Activity,
  Cpu,
  Search,
  Crosshair,
  Calendar,
  X,
  Camera,
  ArrowLeftRight,
  ArrowUpDown,
  FileText,
  Check,
  AlertCircle,
  Share2,
  Bell,
  Printer,
  Download,
  CornerUpRight,
  ArrowUp,
  Flag,
  RefreshCw,
  Square
} from 'lucide-react';

import { ActiveRoute, LatLng, VehicleTelemetry, EventLogItem, RSUData, TrafficSignalData, TollPlazaData, NavManeuver } from './types/navigation';
import { createNanjangudMysuruRoute, fetchRealRoadRoute, searchLocationInIndia } from './services/routingService';
import { NavigationMap } from './components/NavigationMap';
import { DrivingView3D } from './components/DrivingView3D';

export default function App() {
  // Navigation View Modes: Split View (Default as in reference image), 3D Driving, Full Map
  const [viewMode, setViewMode] = useState<'split' | '3d' | 'map'>('split');
  // Default to Vector Dark (OpenStreetMap with CSS dark filter) - Zero API Key Watermark!
  const [mapType, setMapType] = useState<'map' | 'satellite' | 'terrain'>('map');
  const [activeSidebarTab, setActiveSidebarTab] = useState<string>('dashboard');

  // Locations State (Matching reference image: Nanjangud Town, Karnataka -> Mysuru Palace (Amba Vilas))
  const [startName, setStartName] = useState<string>('Nanjangud Town, Karnataka');
  const [destName, setDestName] = useState<string>('Mysuru Palace (Amba Vilas)');
  const [startCoords, setStartCoords] = useState<LatLng>([12.1180, 76.6800]);
  const [destCoords, setDestCoords] = useState<LatLng>([12.3051, 76.6552]);

  // Autocomplete Suggestions State
  const [startSuggestions, setStartSuggestions] = useState<{ name: string; lat: number; lng: number }[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<{ name: string; lat: number; lng: number }[]>([]);
  const [showStartDropdown, setShowStartDropdown] = useState<boolean>(false);
  const [showDestDropdown, setShowDestDropdown] = useState<boolean>(false);

  // Selected Route Option: 1 (Recommended 36.8 km), 2 (38.4 km), 3 (41.2 km via Ring Road)
  const [selectedRouteOption, setSelectedRouteOption] = useState<number>(1);

  // Active Route Object
  const [activeRoute, setActiveRoute] = useState<ActiveRoute>(createNanjangudMysuruRoute());
  const [isRouteLoading, setIsRouteLoading] = useState<boolean>(false);

  // Simulation State: Start at 6.8 km approaching Kadakola Toll Plaza, RSU, and Signal
  const [isNavigating, setIsNavigating] = useState<boolean>(true);
  const [simProgressDistanceKm, setSimProgressDistanceKm] = useState<number>(6.8);
  const [simSpeedMultiplier, setSimSpeedMultiplier] = useState<number>(1);
  const [voiceGuidance, setVoiceGuidance] = useState<boolean>(true);

  // Live Traffic Signal Countdown State: transitions Green (25s) -> Amber (4s) -> Red (18s)
  const [signalSeconds, setSignalSeconds] = useState<number>(18);
  const [signalPhase, setSignalPhase] = useState<'green' | 'amber' | 'red'>('green');

  // FASTag Receipt Modal State
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [showNotificationToast, setShowNotificationToast] = useState<string | null>(null);

  // Clock
  const [currentTime, setCurrentTime] = useState<string>('10:24 AM');
  const [currentDate, setCurrentDate] = useState<string>('Jan 25, 2025');

  // Live Event Feed Items
  const [eventLogs, setEventLogs] = useState<EventLogItem[]>([
    {
      id: 'e1',
      timestamp: '10:18 AM',
      category: 'TOLL',
      title: 'FASTag payment successful – ₹55',
      description: 'Kadakola Toll Plaza (Lane 03 Express)',
      severity: 'success'
    },
    {
      id: 'e2',
      timestamp: '10:15 AM',
      category: 'SAFETY',
      title: 'Road work ahead – 500 m',
      description: 'Temporary lane closure on NH 766',
      severity: 'warning'
    },
    {
      id: 'e3',
      timestamp: '10:19 AM',
      category: 'V2I',
      title: 'Connected to RSU-KAD-01',
      description: 'Traffic & construction update received',
      severity: 'info'
    },
    {
      id: 'e4',
      timestamp: '10:05 AM',
      category: 'SYSTEM',
      title: 'Route calculated – 36.8 km',
      description: 'ETA: 10:47 AM via OSRM Engine',
      severity: 'normal'
    }
  ]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Traffic Signal Countdown loop: transitions Green (25s) -> Amber (4s) -> Red (18s)
  useEffect(() => {
    const sigInterval = setInterval(() => {
      setSignalSeconds((prev) => {
        if (prev <= 1) {
          setSignalPhase((curr) => {
            if (curr === 'green') return 'amber';
            if (curr === 'amber') return 'red';
            return 'green';
          });
          return 22;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(sigInterval);
  }, []);

  // V2I Highway Corridor Milestones (18.5 km corridor)
  // 1. Kadakola Toll Plaza at 7.8 km (zone: 7.4 - 8.1 km)
  const isPassingToll = simProgressDistanceKm >= 7.4 && simProgressDistanceKm <= 8.1;

  // 2. RSU-KAD-01 at 10.2 km (zone: 9.8 - 10.8 km)
  const isInRsuZone = simProgressDistanceKm >= 9.8 && simProgressDistanceKm <= 10.8;

  // 3. Mysuru Ring Road Traffic Signal at 15.1 km (zone: 14.85 - 15.25 km)
  const isNearSignal = simProgressDistanceKm >= 14.85 && simProgressDistanceKm <= 15.25;
  const isHaltedAtRed = isNavigating && signalPhase === 'red' && isNearSignal;

  // Vehicle Simulation Engine strictly along verified road geometry with dynamic speed adjustments
  useEffect(() => {
    if (!isNavigating) return;

    const intervalMs = 100;
    const intervalSec = intervalMs / 1000;

    const simTimer = setInterval(() => {
      setSimProgressDistanceKm((currentDist) => {
        const totalDist = activeRoute.distanceKm;

        // Auto-stop at Red Signal: Vehicle stops right before the intersection!
        const isApproachingSignal = currentDist >= 14.85 && currentDist <= 15.25;
        if (isApproachingSignal && signalPhase === 'red') {
          return Math.min(currentDist, 15.0); // Completely halted at red line!
        }

        // Dynamic Speed Profiles:
        let targetSpeed = 80; // Cruising speed
        if (currentDist >= 7.4 && currentDist <= 8.1) {
          targetSpeed = 35; // Slow down through FASTag RFID toll lane!
        } else if (currentDist >= 9.8 && currentDist <= 10.8) {
          targetSpeed = 50; // Adhere to RSU Road Work Speed Advisory (50 km/h)!
        } else if (isApproachingSignal && signalPhase === 'amber') {
          targetSpeed = 30; // Decelerate on amber
        }

        const effectiveSpeed = targetSpeed * simSpeedMultiplier;
        const deltaKm = (effectiveSpeed / 3600) * intervalSec;
        const nextDist = currentDist + deltaKm;

        if (nextDist >= totalDist) {
          return 0; // Loop route smoothly
        }
        return nextDist;
      });
    }, intervalMs);

    return () => clearInterval(simTimer);
  }, [isNavigating, simSpeedMultiplier, activeRoute.distanceKm, signalPhase]);

  // Trigger automated V2I notifications when crossing infrastructure nodes
  const lastTriggerRef = useRef<string>('');
  useEffect(() => {
    // 1. Toll plaza crossing trigger
    if (simProgressDistanceKm >= 7.7 && simProgressDistanceKm <= 7.9 && lastTriggerRef.current !== 'toll') {
      lastTriggerRef.current = 'toll';
      showToast('💳 FASTag payment successful – ₹55.00 (Kadakola Toll Plaza)');
      setEventLogs((prev) => [
        {
          id: `toll-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          category: 'TOLL',
          title: 'FASTag payment successful – ₹55',
          description: 'Kadakola Toll Plaza (Lane 03 Express)',
          severity: 'success'
        },
        ...prev.slice(0, 4)
      ]);
    }

    // 2. RSU handshake trigger
    if (simProgressDistanceKm >= 10.0 && simProgressDistanceKm <= 10.2 && lastTriggerRef.current !== 'rsu') {
      lastTriggerRef.current = 'rsu';
      showToast('📡 Connected to RSU-KAD-01: Road work ahead 500m · Advisory Speed 50 km/h');
      setEventLogs((prev) => [
        {
          id: `rsu-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          category: 'V2I',
          title: 'Connected to RSU-KAD-01',
          description: 'Speed Advisory 50 km/h received',
          severity: 'info'
        },
        ...prev.slice(0, 4)
      ]);
    }

    // 3. Red Signal Halted alert
    if (isHaltedAtRed && lastTriggerRef.current !== 'red_light') {
      lastTriggerRef.current = 'red_light';
      showToast(`🔴 Vehicle Halted at Red Signal (${signalSeconds}s)`);
    }

    if (simProgressDistanceKm < 5) {
      lastTriggerRef.current = '';
    }
  }, [simProgressDistanceKm, isHaltedAtRed, signalSeconds]);

  // Compute Vehicle Telemetry synchronized with reference image values
  const telemetry: VehicleTelemetry = useMemo(() => {
    const totalDist = activeRoute.distanceKm || 36.8;
    const progressDist = simProgressDistanceKm;
    const remainingDist = Math.max(0, parseFloat((totalDist - progressDist).toFixed(1)));
    const progressPercent = Math.min(100, Math.round((progressDist / totalDist) * 100));

    // Calculate vehicle position along road geometry
    let currentLat = activeRoute.points[0]?.[0] || 12.1180;
    let currentLng = activeRoute.points[0]?.[1] || 76.6800;
    let bearing = 12;

    const pathData = activeRoute.pathData;
    if (pathData && pathData.length > 0) {
      let targetNode = pathData[0];
      for (let i = 0; i < pathData.length; i++) {
        if (pathData[i].distanceFromStartKm >= progressDist) {
          targetNode = pathData[i];
          break;
        }
      }
      currentLat = targetNode.lat;
      currentLng = targetNode.lng;
      bearing = targetNode.bearing;
    }

    // Current live speed calculation
    let currentSpeed = 80;
    if (isHaltedAtRed) {
      currentSpeed = 0;
    } else if (!isNavigating) {
      currentSpeed = 0;
    } else if (isPassingToll) {
      currentSpeed = 35;
    } else if (isInRsuZone) {
      currentSpeed = 50;
    } else if (isNearSignal && signalPhase === 'amber') {
      currentSpeed = 30;
    }

    return {
      speedKmH: currentSpeed,
      targetSpeedKmH: isHaltedAtRed ? 0 : isInRsuZone ? 50 : isPassingToll ? 35 : 80,
      speedLimitKmH: isInRsuZone ? 50 : 80,
      distanceRemainingKm: remainingDist,
      etaString: '10:47 AM',
      progressPercent: progressPercent || 67,
      currentLat,
      currentLng,
      bearing,
      socPercent: 88,
      rangeKm: 320,
      currentRoad: 'NH 766 (Nanjangud - Mysuru Highway)',
      activeManeuverIndex: 0,
      activeRsu: activeRoute.rsus[0] || null,
      activeSignal: {
        id: 'sig-mys-orr',
        name: 'Mysuru Ring Road Signal',
        lat: 12.2680,
        lng: 76.6620,
        currentPhase: signalPhase,
        countdownSeconds: signalSeconds,
        glosaSpeedKmH: 80,
        routeProgressKm: 15.1
      },
      activeToll: activeRoute.tolls[0] || null,
      isStoppedAtSignal: isHaltedAtRed,
      isProcessingToll: isPassingToll
    };
  }, [activeRoute, simProgressDistanceKm, isNavigating, signalPhase, signalSeconds, isHaltedAtRed, isPassingToll, isInRsuZone, isNearSignal]);

  // Trigger OSRM Route Recalculation
  const triggerRouteRecalculation = async (start: LatLng, dest: LatLng, sName: string, dName: string) => {
    setIsRouteLoading(true);
    try {
      const calculatedRoute = await fetchRealRoadRoute(start, dest, sName, dName);
      if (calculatedRoute) {
        setActiveRoute(calculatedRoute);
        setSimProgressDistanceKm(0);
        showToast(`Route updated via OSRM (${calculatedRoute.distanceKm} km · ${calculatedRoute.durationMin} min)`);
      } else {
        showToast('Highway route re-aligned successfully');
      }
    } catch (e) {
      showToast('OSRM route calculated with standard highway fallback');
    } finally {
      setIsRouteLoading(false);
    }
  };

  // Autocomplete change handlers
  const handleStartInputChange = async (val: string) => {
    setStartName(val);
    if (val.trim().length >= 2) {
      const results = await searchLocationInIndia(val);
      setStartSuggestions(results);
      setShowStartDropdown(true);
    } else {
      setStartSuggestions([]);
      setShowStartDropdown(false);
    }
  };

  const handleDestInputChange = async (val: string) => {
    setDestName(val);
    if (val.trim().length >= 2) {
      const results = await searchLocationInIndia(val);
      setDestSuggestions(results);
      setShowDestDropdown(true);
    } else {
      setDestSuggestions([]);
      setShowDestDropdown(false);
    }
  };

  const handleSelectStartSuggestion = (item: { name: string; lat: number; lng: number }) => {
    setStartName(item.name);
    setStartCoords([item.lat, item.lng]);
    setShowStartDropdown(false);
    triggerRouteRecalculation([item.lat, item.lng], destCoords, item.name, destName);
  };

  const handleSelectDestSuggestion = (item: { name: string; lat: number; lng: number }) => {
    setDestName(item.name);
    setDestCoords([item.lat, item.lng]);
    setShowDestDropdown(false);
    triggerRouteRecalculation(startCoords, [item.lat, item.lng], startName, item.name);
  };

  // Recalculate route when switching route options
  const handleSelectRouteOption = (option: number) => {
    setSelectedRouteOption(option);
    setIsRouteLoading(true);
    setTimeout(() => {
      if (option === 1) {
        setActiveRoute(createNanjangudMysuruRoute());
      } else if (option === 2) {
        const base = createNanjangudMysuruRoute();
        base.distanceKm = 38.4;
        base.durationMin = 46;
        setActiveRoute({ ...base });
      } else {
        const base = createNanjangudMysuruRoute();
        base.distanceKm = 41.2;
        base.durationMin = 49;
        setActiveRoute({ ...base });
      }
      setIsRouteLoading(false);
      showToast(`Selected Corridor Option ${option}`);
    }, 250);
  };

  const handleSwapLocations = () => {
    const tmpName = startName;
    const tmpCoords = startCoords;
    setStartName(destName);
    setStartCoords(destCoords);
    setDestName(tmpName);
    setDestCoords(tmpCoords);
    triggerRouteRecalculation(destCoords, tmpCoords, destName, tmpName);
    showToast('Start and Destination swapped');
  };

  const handleMyLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords: LatLng = [pos.coords.latitude, pos.coords.longitude];
          setStartCoords(coords);
          setStartName('Current Location (GPS Lock)');
          triggerRouteRecalculation(coords, destCoords, 'Current Location (GPS)', destName);
          showToast('GPS Lock: Start Location set to current coordinates');
        },
        () => {
          showToast('Using Default GPS Corridor: Nanjangud Town');
        }
      );
    }
  };

  const handleStopSimulation = () => {
    setIsNavigating(false);
    setSimProgressDistanceKm(0);
    showToast('Navigation Stopped & Vehicle Reset to Start');
  };

  const showToast = (msg: string) => {
    setShowNotificationToast(msg);
    setTimeout(() => setShowNotificationToast(null), 3000);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans select-none">
      {/* 1. TOP HEADER (Matching Reference Image Pixel-for-Pixel) */}
      <header className="h-16 shrink-0 bg-slate-950 border-b border-slate-800/80 px-4 lg:px-6 flex items-center justify-between z-30">
        {/* Left: Tesla stylized "T" logo + App Title + Subtitle */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 flex items-center justify-center">
            <svg className="w-7 h-7 fill-white" viewBox="0 0 100 100">
              <path d="M50 20c11.5 0 22 3.5 30.5 9.5l4-7.5C74.5 14.5 62.5 10.5 50 10.5S25.5 14.5 15.5 22l4 7.5C28 23.5 38.5 20 50 20z" />
              <path d="M46.5 33v57h7V33c9.5.5 18 3 25 7.5l3.5-7C73.5 28 62.5 25 50 25S26.5 28 18 33.5l3.5 7c7-4.5 15.5-7 25-7.5z" />
            </svg>
          </div>
          <div>
            <h1 className="text-base lg:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              V2I Smart Traffic Management for SDV
            </h1>
            <p className="text-[11px] text-slate-400 font-mono tracking-tight hidden sm:block">
              Vehicle-to-Infrastructure (V2I) | Real-time Navigation | RSU Communication | Traffic & Toll (FASTag)
            </p>
          </div>
        </div>

        {/* Center / Right Controls: Interactive Signal Toggle & Vehicle Status */}
        <div className="flex items-center gap-2.5 lg:gap-3.5">
          {/* INTERACTIVE SIGNAL TOGGLE BUTTON */}
          <button
            onClick={() => {
              setSignalPhase((prev) => (prev === 'red' ? 'green' : 'red'));
              setSignalSeconds((prev) => (prev > 5 ? prev : 18));
              showToast(signalPhase === 'red' ? '🟢 Signal switched to GREEN — Vehicle Resuming' : '🔴 Signal switched to RED — Vehicle Halting');
            }}
            title="Click to force traffic light phase change"
            className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-2 shadow-lg transition-all ${
              signalPhase === 'red'
                ? 'bg-rose-950/80 border-rose-500 text-rose-300 shadow-rose-500/20'
                : 'bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-emerald-500/20'
            }`}
          >
            <div className={`w-2.5 h-2.5 rounded-full ${signalPhase === 'red' ? 'bg-rose-500 animate-ping' : 'bg-emerald-400'}`} />
            <span>Signal: {signalPhase.toUpperCase()} ({signalSeconds}s)</span>
            <span className="text-[10px] text-slate-400 font-sans hidden sm:inline">
              {signalPhase === 'red' ? '(Click for 🟢)' : '(Click for 🔴)'}
            </span>
          </button>

          {/* Vehicle Status Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800/80">
            <Car className="w-4 h-4 text-cyan-400" />
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-slate-200">Tesla SDV-01</span>
              <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                V2I Connected
              </span>
            </div>
          </div>

          {/* Battery Status Badge (88% SOC) */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800/80">
            <div className="w-6 h-3 rounded-sm border-2 border-emerald-400 p-0.5 flex items-center">
              <div className="h-full w-[88%] bg-emerald-400 rounded-2xs" />
            </div>
            <span className="text-sm font-bold font-mono text-white">88%</span>
          </div>

          {/* Date & Time Badge */}
          <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800/80 text-xs">
            <Calendar className="w-4 h-4 text-slate-400" />
            <div className="flex flex-col text-right">
              <span className="text-[10px] text-slate-400 font-mono">Jan 25, 2025</span>
              <span className="text-xs font-bold text-slate-200 font-mono tabular-nums">{currentTime}</span>
            </div>
          </div>
        </div>
      </header>

      {/* 2. MAIN COCKPIT DECK (5-Column Layout matching Reference Image) */}
      <div className="flex-1 flex overflow-hidden p-3 gap-3">
        {/* COLUMN 1: LEFT NAVIGATION SIDEBAR (w-52 shrink-0) */}
        <aside className="w-48 lg:w-52 shrink-0 bg-slate-950/80 rounded-2xl border border-slate-800/70 p-2 flex flex-col justify-between hidden md:flex">
          <nav className="space-y-1">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: Activity, active: true },
              { id: 'navigation', label: 'Navigation', icon: Navigation },
              { id: 'rsu', label: 'RSU Network', icon: Radio },
              { id: 'signals', label: 'Traffic Signals', icon: TrafficCone },
              { id: 'toll', label: 'Toll & FASTag', icon: CreditCard },
              { id: 'alerts', label: 'Route Alerts', icon: AlertTriangle },
              { id: 'vehicles', label: 'Vehicles', icon: Car },
              { id: 'analytics', label: 'Analytics', icon: Sliders },
              { id: 'history', label: 'Event History', icon: Clock },
              { id: 'settings', label: 'Settings', icon: Shield }
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeSidebarTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveSidebarTab(item.id);
                    if (item.id === 'toll') setShowReceiptModal(true);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-sm shadow-cyan-500/10'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Quick Highway Status Card */}
          <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800/80 text-[10px] space-y-1">
            <div className="flex justify-between text-slate-400">
              <span>Highway</span>
              <span className="text-cyan-400 font-mono font-bold">NH 766</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Traffic Mode</span>
              <span className="text-emerald-400 font-mono">LHT (India)</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>C-V2X Status</span>
              <span className="text-emerald-400 font-mono">5.9 GHz Active</span>
            </div>
          </div>
        </aside>

        {/* COLUMN 2: ROUTE PLANNER PANEL (w-64 lg:w-72 shrink-0) */}
        <div className="w-64 lg:w-72 shrink-0 bg-slate-950/80 rounded-2xl border border-slate-800/70 p-3.5 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-2.5">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 font-display">
                  Route Planner
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">V2I Optimal</span>
            </div>

            {/* Start Location Input with Autocomplete Dropdown */}
            <div className="relative">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                <span>Start Location</span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={startName}
                  onChange={(e) => handleStartInputChange(e.target.value)}
                  onFocus={() => {
                    if (startSuggestions.length > 0) setShowStartDropdown(true);
                  }}
                  className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 pr-8"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
              </div>

              {/* Start Suggestions Dropdown */}
              {showStartDropdown && startSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-cyan-500/40 rounded-xl shadow-2xl z-40 max-h-48 overflow-y-auto divide-y divide-slate-800">
                  {startSuggestions.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectStartSuggestion(item)}
                      className="w-full px-2.5 py-1.5 text-left text-xs hover:bg-slate-800 transition-colors flex flex-col"
                    >
                      <span className="font-semibold text-slate-200 truncate">{item.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{item.lat.toFixed(4)}, {item.lng.toFixed(4)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Swap Button */}
            <div className="flex justify-center -my-1">
              <button
                onClick={handleSwapLocations}
                title="Swap Start & Destination"
                className="p-1 rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/40 transition-colors shadow"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Destination Input with Autocomplete Dropdown */}
            <div className="relative">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
                <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                <span>Destination</span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={destName}
                  onChange={(e) => handleDestInputChange(e.target.value)}
                  onFocus={() => {
                    if (destSuggestions.length > 0) setShowDestDropdown(true);
                  }}
                  className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 pr-8"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
              </div>

              {/* Destination Suggestions Dropdown */}
              {showDestDropdown && destSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-cyan-500/40 rounded-xl shadow-2xl z-40 max-h-48 overflow-y-auto divide-y divide-slate-800">
                  {destSuggestions.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectDestSuggestion(item)}
                      className="w-full px-2.5 py-1.5 text-left text-xs hover:bg-slate-800 transition-colors flex flex-col"
                    >
                      <span className="font-semibold text-slate-200 truncate">{item.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{item.lat.toFixed(4)}, {item.lng.toFixed(4)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Action Chips: Pick on Map & My Location */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => showToast('Click or drag markers on the map to set points')}
                className="py-1.5 px-2 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 text-[11px] font-semibold text-slate-300 flex items-center justify-center gap-1.5 transition-colors"
              >
                <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                <span>Pick on Map</span>
              </button>
              <button
                onClick={handleMyLocation}
                className="py-1.5 px-2 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 text-[11px] font-semibold text-slate-300 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
                <span>My Location</span>
              </button>
            </div>

            {/* Route Options (3) */}
            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] font-bold text-slate-400">Route Options (3)</div>

              {/* Route 1 (Recommended) */}
              <button
                onClick={() => handleSelectRouteOption(1)}
                className={`w-full p-2 rounded-xl border text-left transition-all relative ${
                  selectedRouteOption === 1
                    ? 'bg-emerald-950/20 border-emerald-500/60 shadow-lg shadow-emerald-500/10'
                    : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-xs text-slate-200 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>Route 1 (Recommended)</span>
                  </div>
                  {selectedRouteOption === 1 && (
                    <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-slate-950">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">36.8 km • 42 min</div>
              </button>

              {/* Route 2 */}
              <button
                onClick={() => handleSelectRouteOption(2)}
                className={`w-full p-2 rounded-xl border text-left transition-all ${
                  selectedRouteOption === 2
                    ? 'bg-emerald-950/20 border-emerald-500/60 shadow-lg shadow-emerald-500/10'
                    : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-xs text-slate-300">Route 2</div>
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">38.4 km • 46 min</div>
              </button>

              {/* Route 3 (via Ring Road) */}
              <button
                onClick={() => handleSelectRouteOption(3)}
                className={`w-full p-2 rounded-xl border text-left transition-all ${
                  selectedRouteOption === 3
                    ? 'bg-emerald-950/20 border-emerald-500/60 shadow-lg shadow-emerald-500/10'
                    : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-xs text-slate-300">Route 3 (via Ring Road)</div>
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">41.2 km • 49 min</div>
              </button>
            </div>
          </div>

          {/* V2I INTERACTIVE TEST CENTER & CONTROLS */}
          <div className="pt-2 border-t border-slate-800/80 space-y-2">
            {/* Interactive Shortcut Jump Pills */}
            <div className="space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 flex items-center justify-between">
                <span>V2I Live Testing Jumps</span>
                <span className="text-[9px] text-slate-500">1-Click Test</span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <button
                  onClick={() => {
                    setSimProgressDistanceKm(14.85);
                    setSignalPhase('red');
                    setSignalSeconds(18);
                    setIsNavigating(true);
                    showToast('🚦 Jumped to Signal: Car decelerates & stops at Red light!');
                  }}
                  title="Test car stopping at Red Signal"
                  className="py-1 px-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/40 text-[10px] font-mono text-rose-300 flex flex-col items-center justify-center transition-all active:scale-95 shadow"
                >
                  <span className="font-bold">🚦 Red Signal</span>
                  <span className="text-[8px] text-rose-400/80">Stop at 15.0km</span>
                </button>

                <button
                  onClick={() => {
                    setSimProgressDistanceKm(9.85);
                    setIsNavigating(true);
                    showToast('📡 Jumped to RSU Node: C-V2X Handshake & 50 km/h Advisory active!');
                  }}
                  title="Test RSU V2I Response"
                  className="py-1 px-1 rounded-lg bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/40 text-[10px] font-mono text-purple-300 flex flex-col items-center justify-center transition-all active:scale-95 shadow"
                >
                  <span className="font-bold">📡 RSU V2I</span>
                  <span className="text-[8px] text-purple-400/80">Handshake 10km</span>
                </button>

                <button
                  onClick={() => {
                    setSimProgressDistanceKm(7.45);
                    setIsNavigating(true);
                    showToast('💳 Jumped to FASTag Plaza: RFID Tag scan & ₹55 fee deduction!');
                  }}
                  title="Test FASTag Toll Plaza Passing"
                  className="py-1 px-1 rounded-lg bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/40 text-[10px] font-mono text-amber-300 flex flex-col items-center justify-center transition-all active:scale-95 shadow"
                >
                  <span className="font-bold">💳 FASTag</span>
                  <span className="text-[8px] text-amber-400/80">Pass Toll 7.8km</span>
                </button>
              </div>
            </div>

            {/* Main Navigation Button */}
            <button
              onClick={() => setIsNavigating(!isNavigating)}
              className="w-full py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all active:scale-[0.98]"
            >
              {isNavigating ? (
                <>
                  <Pause className="w-4 h-4 fill-current" />
                  <span>Pause Navigation</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Start Navigation</span>
                </>
              )}
            </button>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => triggerRouteRecalculation(startCoords, destCoords, startName, destName)}
                disabled={isRouteLoading}
                className="py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 font-medium flex items-center justify-center gap-1 transition-colors"
              >
                <RefreshCw className={`w-3 h-3 text-cyan-400 ${isRouteLoading ? 'animate-spin' : ''}`} />
                <span>Recalculate</span>
              </button>
              <button
                onClick={handleStopSimulation}
                className="py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 font-medium flex items-center justify-center gap-1 transition-colors"
              >
                <Square className="w-3 h-3 text-rose-400" />
                <span>Stop</span>
              </button>
            </div>
          </div>
        </div>

        {/* COLUMN 3: CENTER INTERACTIVE MAP (flex-1) */}
        <div className={`transition-all duration-300 h-full ${
          viewMode === 'map' ? 'flex-1' : viewMode === '3d' ? 'hidden' : 'flex-1'
        }`}>
          <NavigationMap
            route={activeRoute}
            telemetry={telemetry}
            mapType={mapType}
            setMapType={setMapType}
            onSelectStartLocation={(c, name) => {
              setStartCoords(c);
              setStartName(name);
              triggerRouteRecalculation(c, destCoords, name, destName);
            }}
            onSelectDestLocation={(c, name) => {
              setDestCoords(c);
              setDestName(name);
              triggerRouteRecalculation(startCoords, c, startName, name);
            }}
            onSwapLocations={handleSwapLocations}
            startName={startName}
            destName={destName}
          />
        </div>

        {/* COLUMN 4: 3D DRIVING VIEW + NAVIGATION INSTRUCTIONS (w-80 lg:w-96 shrink-0) */}
        <div className={`w-80 lg:w-96 shrink-0 flex flex-col gap-3 h-full transition-all duration-300 ${
          viewMode === 'map' ? 'hidden' : viewMode === '3d' ? 'flex-1' : 'w-80 lg:w-96 shrink-0'
        }`}>
          {/* Top Half: 3D View Toggles & WebGL Viewport */}
          <div className="flex-1 bg-slate-950/80 rounded-2xl border border-slate-800/70 overflow-hidden relative flex flex-col">
            {/* View Mode Switches: [ 3D Driving ] [ Split View ] [ Full Map ] */}
            <div className="p-2 border-b border-slate-800/80 bg-slate-950/90 flex items-center justify-between z-20">
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[11px] font-semibold w-full">
                <button
                  onClick={() => setViewMode('3d')}
                  className={`flex-1 py-1 rounded-lg flex items-center justify-center gap-1 transition-all ${
                    viewMode === '3d'
                      ? 'bg-sky-500 text-white font-bold shadow-md shadow-sky-500/25'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Camera className="w-3 h-3" />
                  <span>3D Driving</span>
                </button>
                <button
                  onClick={() => setViewMode('split')}
                  className={`flex-1 py-1 rounded-lg flex items-center justify-center gap-1 transition-all ${
                    viewMode === 'split'
                      ? 'bg-sky-500 text-white font-bold shadow-md shadow-sky-500/25'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Maximize2 className="w-3 h-3" />
                  <span>Split View</span>
                </button>
                <button
                  onClick={() => setViewMode('map')}
                  className={`flex-1 py-1 rounded-lg flex items-center justify-center gap-1 transition-all ${
                    viewMode === 'map'
                      ? 'bg-sky-500 text-white font-bold shadow-md shadow-sky-500/25'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Navigation className="w-3 h-3" />
                  <span>Full Map</span>
                </button>
              </div>
            </div>

            {/* 3D WebGL Canvas */}
            <div className="flex-1 w-full h-full relative">
              <DrivingView3D
                telemetry={telemetry}
                activeRsu={telemetry.activeRsu}
                activeSignal={telemetry.activeSignal}
                currentRoadName={telemetry.currentRoad}
                isNavigating={isNavigating}
              />
            </div>
          </div>

          {/* Bottom Half: Navigation Instructions Card (Matching Reference Image) */}
          <div className="h-44 bg-slate-950/80 rounded-2xl border border-slate-800/70 p-3 flex flex-col justify-between overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 shrink-0">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-cyan-400 stroke-[2.5]" />
                <span className="text-xs font-bold text-slate-100 font-display">
                  Navigation Instructions
                </span>
              </div>
              <span className="text-[11px] font-mono text-cyan-400 font-semibold tabular-nums">
                {telemetry.distanceRemainingKm} km to dest
              </span>
            </div>

            {/* Turn-by-Turn List matching reference image */}
            <div className="space-y-1.5 overflow-y-auto pr-1 flex-1 py-1">
              {/* Row 1 (Active, highlighted in teal gradient) */}
              <div className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-teal-950/90 to-slate-900 border border-teal-500/40 text-teal-300 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <ArrowUp className="w-4 h-4 text-emerald-400 stroke-[2.5]" />
                  <span className="font-semibold text-slate-100 text-[11px]">Continue on NH 766</span>
                </div>
                <span className="font-mono text-emerald-400 font-bold text-xs">12.4 km</span>
              </div>

              {/* Row 2 */}
              <div className="px-2.5 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800/70 text-slate-300 flex items-center justify-between text-xs hover:bg-slate-900">
                <div className="flex items-center gap-2.5">
                  <CornerUpRight className="w-4 h-4 text-slate-400 stroke-[2.5]" />
                  <span className="font-medium text-slate-200 text-[11px]">Keep right towards Mysuru Ring Road</span>
                </div>
                <span className="font-mono text-slate-400 text-xs">7.8 km</span>
              </div>

              {/* Row 3 - Dynamic Signal Instruction */}
              <div className={`px-2.5 py-1.5 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                isNearSignal ? 'bg-slate-900 border-cyan-500/60 shadow' : 'bg-slate-900/60 border-slate-800/70 text-slate-300'
              }`}>
                <div className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded bg-slate-950 border border-slate-700 flex flex-col items-center justify-around py-0.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      signalPhase === 'red' ? 'bg-rose-500 shadow-[0_0_6px_#f43f5e]' : signalPhase === 'amber' ? 'bg-amber-400' : 'bg-emerald-400'
                    }`} />
                  </div>
                  <span className="font-medium text-slate-200 text-[11px]">
                    Traffic signal ahead ({signalPhase.toUpperCase()} – {signalSeconds}s)
                  </span>
                </div>
                <span className={`font-mono text-xs ${signalPhase === 'red' ? 'text-rose-400 font-bold' : 'text-slate-400'}`}>
                  1.2 km
                </span>
              </div>

              {/* Row 4 - Dynamic Toll Instruction */}
              <div className={`px-2.5 py-1.5 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                isPassingToll ? 'bg-amber-950/40 border-amber-500/60 shadow' : 'bg-slate-900/60 border-slate-800/70 text-slate-300'
              }`}>
                <div className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-[9px]">
                    ₹
                  </div>
                  <span className="font-medium text-slate-200 text-[11px]">Toll Plaza (FASTag) - ₹55</span>
                </div>
                <span className="font-mono text-amber-400 font-bold text-xs">3.6 km</span>
              </div>

              {/* Row 5 */}
              <div className="px-2.5 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800/70 text-slate-300 flex items-center justify-between text-xs hover:bg-slate-900">
                <div className="flex items-center gap-2.5">
                  <Flag className="w-4 h-4 text-rose-400 stroke-[2.5]" />
                  <span className="font-medium text-slate-200 text-[11px]">Arrive at Mysuru Palace (Amba Vilas)</span>
                </div>
                <span className="font-mono text-slate-400 text-xs">18.5 km</span>
              </div>
            </div>
          </div>
        </div>

        {/* COLUMN 5: RIGHT CARDS COLUMN (w-64 lg:w-72 shrink-0) */}
        <div className="w-64 lg:w-72 shrink-0 flex flex-col gap-3 h-full hidden xl:flex">
          {/* Card 1: RSU (V2I) Updates Card */}
          <div className={`flex-1 bg-slate-950/80 rounded-2xl border p-3.5 flex flex-col justify-between transition-all ${
            isInRsuZone ? 'border-purple-500/80 shadow-lg shadow-purple-500/20 bg-purple-950/20' : 'border-slate-800/70'
          }`}>
            <div>
              {/* Header */}
              <div className="flex items-center gap-2 pb-2.5 border-b border-slate-800/80">
                <Radio className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-slate-100 uppercase tracking-wider font-display">
                  RSU (V2I) Updates
                </span>
              </div>

              {/* Connected RSU Badge */}
              <div className={`mt-2.5 flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-colors ${
                isInRsuZone ? 'bg-purple-900/40 border-purple-400/50' : 'bg-emerald-950/30 border-emerald-500/30'
              }`}>
                <CheckCircle2 className={`w-4 h-4 shrink-0 ${isInRsuZone ? 'text-purple-400' : 'text-emerald-400'}`} />
                <span className={`text-xs font-bold ${isInRsuZone ? 'text-purple-200 animate-pulse' : 'text-emerald-300'}`}>
                  RSU-KAD-01 {isInRsuZone ? '(Live Handshake Active)' : '(Active)'}
                </span>
              </div>

              {/* Details table */}
              <div className="mt-3 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Location :</span>
                  <span className="text-slate-200 font-medium">Kadakola, NH 766</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Range :</span>
                  <span className="text-slate-200 font-mono">300 m C-V2X</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Status :</span>
                  <span className={`font-semibold font-mono ${isInRsuZone ? 'text-purple-400' : 'text-emerald-400'}`}>
                    {isInRsuZone ? 'Broadcasting Advisory' : 'Connected'}
                  </span>
                </div>
              </div>

              {/* Messages section */}
              <div className="mt-3 pt-2.5 border-t border-slate-800/80">
                <div className="text-[11px] font-bold text-slate-400 mb-1.5">Live V2X Advisories :</div>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span className="text-[11px]">Road work ahead (500 m)</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-amber-400 font-medium">
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span className="text-[11px]">Left lane closed · Merge Right</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-cyan-400 font-mono font-bold">
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span className="text-[11px]">Advisory Speed: 50 km/h</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <span className="text-[10px] text-slate-500 font-mono">Source: Simulated V2X Broadcast (5.895 GHz)</span>
            </div>
          </div>

          {/* Card 2: Toll & FASTag Card */}
          <div className={`flex-1 bg-slate-950/80 rounded-2xl border p-3.5 flex flex-col justify-between transition-all ${
            isPassingToll ? 'border-amber-500/80 shadow-lg shadow-amber-500/20 bg-amber-950/20' : 'border-slate-800/70'
          }`}>
            <div>
              {/* Header */}
              <div className="flex items-center gap-2 pb-2.5 border-b border-slate-800/80">
                <CreditCard className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-slate-100 uppercase tracking-wider font-display">
                  Toll & FASTag
                </span>
              </div>

              {/* Status Badge */}
              <div className={`mt-2.5 flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-colors ${
                isPassingToll ? 'bg-amber-900/40 border-amber-400/50' : 'bg-emerald-950/30 border-emerald-500/30'
              }`}>
                <CheckCircle2 className={`w-4 h-4 shrink-0 ${isPassingToll ? 'text-amber-400' : 'text-emerald-400'}`} />
                <span className={`text-xs font-bold ${isPassingToll ? 'text-amber-300 animate-pulse' : 'text-emerald-300'}`}>
                  {isPassingToll ? 'RFID Tag Authorized · Barrier Opened' : 'Toll Paid Successfully'}
                </span>
              </div>

              {/* Details table */}
              <div className="mt-3 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Plaza :</span>
                  <span className="text-slate-200 font-medium">Kadakola Toll Plaza</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Amount :</span>
                  <span className="text-amber-400 font-bold font-mono">₹55.00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Deducted From :</span>
                  <span className="text-slate-200 font-mono text-[11px]">FASTag (A/c ****4321)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Transaction ID :</span>
                  <span className="text-cyan-400 font-mono text-[11px]">FTG7843921</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Time :</span>
                  <span className="text-slate-300 font-mono">10:18 AM</span>
                </div>
              </div>
            </div>

            {/* View Receipt Button */}
            <div className="pt-2">
              <button
                onClick={() => setShowReceiptModal(true)}
                className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-700/80 text-xs font-semibold text-slate-200 flex items-center justify-center gap-2 shadow transition-colors"
              >
                <FileText className="w-3.5 h-3.5 text-cyan-400" />
                <span>View Receipt</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. BOTTOM TELEMETRY GRID (Row of 6 Cards Matching Reference Image) */}
      <div className="shrink-0 px-3 pb-2">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {/* Card 1: Current Speed */}
          <div className={`bg-slate-950/80 rounded-2xl border p-3 flex items-center gap-3 transition-colors ${
            isHaltedAtRed ? 'border-rose-500/80 shadow-lg shadow-rose-500/20 bg-rose-950/20' : isInRsuZone ? 'border-purple-500/60' : 'border-slate-800/70'
          }`}>
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
              isHaltedAtRed
                ? 'bg-rose-500/20 border-rose-400/40 text-rose-400 animate-pulse'
                : isInRsuZone
                ? 'bg-purple-500/20 border-purple-400/40 text-purple-400'
                : 'bg-cyan-500/15 border-cyan-400/30 text-cyan-400'
            }`}>
              <Gauge className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-medium">Current Speed</div>
              <div className={`text-base lg:text-lg font-bold font-mono tabular-nums ${isHaltedAtRed ? 'text-rose-400' : 'text-white'}`}>
                {telemetry.speedKmH} km/h
              </div>
              <div className="text-[9px] font-mono">
                {isHaltedAtRed ? (
                  <span className="text-rose-400 font-bold animate-pulse">HALTED: Red Signal ({signalSeconds}s)</span>
                ) : isInRsuZone ? (
                  <span className="text-purple-400 font-bold">Advisory: 50 km/h</span>
                ) : isPassingToll ? (
                  <span className="text-amber-400 font-bold">FASTag Lane: 35 km/h</span>
                ) : (
                  <span className="text-slate-500">Speed Limit: 80 km/h</span>
                )}
              </div>
            </div>
          </div>

          {/* Card 2: Distance Remaining */}
          <div className="bg-slate-950/80 rounded-2xl border border-slate-800/70 p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-400 shrink-0">
              <Share2 className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-medium">Distance Remaining</div>
              <div className="text-base lg:text-lg font-bold font-mono text-white tabular-nums">
                {telemetry.distanceRemainingKm} km
              </div>
            </div>
          </div>

          {/* Card 3: Estimated Arrival */}
          <div className="bg-slate-950/80 rounded-2xl border border-slate-800/70 p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-400 shrink-0">
              <Clock className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-medium">Estimated Arrival</div>
              <div className="text-base lg:text-lg font-bold font-mono text-white tabular-nums">
                10:47 AM
              </div>
              <div className="text-[9px] text-slate-500 font-mono">(23 min)</div>
            </div>
          </div>

          {/* Card 4: Battery (SOC) */}
          <div className="bg-slate-950/80 rounded-2xl border border-slate-800/70 p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Zap className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-medium">Battery (SOC)</div>
              <div className="text-base lg:text-lg font-bold font-mono text-emerald-300 tabular-nums">
                88%
              </div>
              <div className="text-[9px] text-slate-500 font-mono">(~320 km)</div>
            </div>
          </div>

          {/* Card 5: RSU Status */}
          <div className="bg-slate-950/80 rounded-2xl border border-slate-800/70 p-3 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
              isInRsuZone ? 'bg-purple-500/20 border-purple-400/40 text-purple-400' : 'bg-emerald-500/15 border-emerald-400/30 text-emerald-400'
            }`}>
              <Wifi className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-medium">RSU Status</div>
              <div className={`text-base lg:text-lg font-bold font-mono ${isInRsuZone ? 'text-purple-400' : 'text-emerald-400'}`}>
                {isInRsuZone ? 'In 300m Zone' : 'Connected'}
              </div>
              <div className="text-[9px] text-slate-500 font-mono">
                {isInRsuZone ? '5.890 GHz Link' : '(300 m range)'}
              </div>
            </div>
          </div>

          {/* Card 6: Route Progress */}
          <div className="bg-slate-950/80 rounded-2xl border border-slate-800/70 p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-400 shrink-0">
              <Activity className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-slate-400 font-medium">Route Progress</div>
              <div className="text-base lg:text-lg font-bold font-mono text-white tabular-nums">
                {telemetry.progressPercent}%
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-1 overflow-hidden">
                <div
                  className="bg-emerald-400 h-full rounded-full shadow-[0_0_8px_#34d399] transition-all duration-300"
                  style={{ width: `${telemetry.progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. BOTTOM TICKER BANNER: LIVE ALERTS & EVENTS (Matching Reference Image) */}
      <footer className="shrink-0 bg-slate-950 border-t border-slate-800/80 px-4 py-2 flex items-center gap-4 overflow-x-auto z-30">
        <div className="flex items-center gap-2 shrink-0">
          <Bell className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold text-white tracking-wide whitespace-nowrap font-display">
            Live Alerts & Events
          </span>
        </div>

        <div className="flex items-center gap-2.5 overflow-x-auto text-xs py-0.5">
          {eventLogs.map((evt) => (
            <div key={evt.id} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 shrink-0">
              {evt.severity === 'warning' ? (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span className={`font-mono font-bold text-[11px] ${evt.severity === 'warning' ? 'text-amber-400' : 'text-emerald-400'}`}>
                {evt.timestamp}
              </span>
              <span className="text-slate-200 text-[11px]">
                {evt.title} <span className="text-slate-400">({evt.description})</span>
              </span>
            </div>
          ))}
        </div>
      </footer>

      {/* FASTag Receipt Modal */}
      {showReceiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden p-6 text-slate-100">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold">
                  ₹
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white font-display">NHAI FASTag E-Receipt</h3>
                  <p className="text-[11px] text-slate-400 font-mono">National Electronic Toll Collection (NETC)</p>
                </div>
              </div>
              <button
                onClick={() => setShowReceiptModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Receipt Body */}
            <div className="my-5 p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Plaza Name:</span>
                <span className="text-white font-bold">Kadakola Toll Plaza</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Highway Section:</span>
                <span className="text-slate-300">NH 766 (Mysuru - Nanjangud)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Vehicle No:</span>
                <span className="text-cyan-400 font-bold">KA 09 EV 2026 (Tesla SDV-01)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">FASTag Account:</span>
                <span className="text-slate-300">**** **** **** 4321</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Transaction ID:</span>
                <span className="text-cyan-400 font-bold">FTG7843921</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Date & Time:</span>
                <span className="text-slate-300">Jan 25, 2025 • 10:18:24 AM</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-800 text-sm">
                <span className="text-slate-300 font-bold">Toll Fee Paid:</span>
                <span className="text-emerald-400 font-bold text-base">₹55.00</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] pt-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Authorized via C-V2X DSRC 5.9GHz Reader</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  showToast('Receipt saved to vehicle storage');
                  setShowReceiptModal(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF</span>
              </button>
              <button
                onClick={() => setShowReceiptModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {showNotificationToast && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 border border-cyan-500/50 text-cyan-200 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-medium animate-in slide-in-from-top-2">
          <AlertCircle className="w-4 h-4 text-cyan-400" />
          <span>{showNotificationToast}</span>
        </div>
      )}
    </div>
  );
}
