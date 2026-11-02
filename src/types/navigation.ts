/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type LatLng = [number, number]; // [latitude, longitude]

export interface RoutePoint {
  lat: number;
  lng: number;
  distanceFromStartKm: number;
  bearing: number;
}

export interface NavManeuver {
  id: string;
  type: 'straight' | 'right' | 'left' | 'fork' | 'signal' | 'toll' | 'destination';
  instruction: string;
  distanceKm: number;
  roadName: string;
  triggerDistanceKm: number;
}

export interface RSUData {
  id: string;
  name: string;
  lat: number;
  lng: number;
  rangeM: number;
  status: 'connected' | 'in_range' | 'standby';
  frequency: string;
  advisorySpeedKmH: number;
  lastMessage: string;
  routeProgressKm: number;
}

export interface TrafficSignalData {
  id: string;
  name: string;
  lat: number;
  lng: number;
  currentPhase: 'green' | 'amber' | 'red';
  countdownSeconds: number;
  glosaSpeedKmH: number;
  routeProgressKm: number;
}

export interface TollPlazaData {
  id: string;
  name: string;
  lat: number;
  lng: number;
  fee: number;
  fastagLane: string;
  status: 'pending' | 'authorized' | 'passed';
  txId?: string;
  routeProgressKm: number;
}

export interface ActiveRoute {
  id: string;
  name: string;
  summary: string;
  distanceKm: number;
  durationMin: number;
  points: LatLng[];
  pathData: RoutePoint[];
  maneuvers: NavManeuver[];
  hasToll: boolean;
  tollFee: number;
  rsus: RSUData[];
  signals: TrafficSignalData[];
  tolls: TollPlazaData[];
}

export interface VehicleTelemetry {
  speedKmH: number;
  targetSpeedKmH: number;
  speedLimitKmH: number;
  distanceRemainingKm: number;
  etaString: string;
  progressPercent: number;
  currentLat: number;
  currentLng: number;
  bearing: number;
  socPercent: number;
  rangeKm: number;
  currentRoad: string;
  activeManeuverIndex: number;
  activeRsu: RSUData | null;
  activeSignal: TrafficSignalData | null;
  activeToll: TollPlazaData | null;
  isStoppedAtSignal: boolean;
  isProcessingToll: boolean;
}

export interface EventLogItem {
  id: string;
  timestamp: string;
  category: 'V2I' | 'SIGNAL' | 'TOLL' | 'SAFETY' | 'SYSTEM';
  title: string;
  description: string;
  severity: 'normal' | 'info' | 'warning' | 'success';
}
