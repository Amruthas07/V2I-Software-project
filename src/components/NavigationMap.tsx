/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Layers, Plus, Minus, Crosshair, Search, LocateFixed, ArrowLeftRight, X } from 'lucide-react';
import { ActiveRoute, LatLng, VehicleTelemetry, RSUData, TrafficSignalData, TollPlazaData } from '../types/navigation';
import { searchLocationInIndia } from '../services/routingService';

interface NavigationMapProps {
  route: ActiveRoute;
  telemetry: VehicleTelemetry;
  mapType: 'satellite' | 'map' | 'terrain';
  setMapType: (t: 'satellite' | 'map' | 'terrain') => void;
  onSelectStartLocation: (coords: LatLng, name: string) => void;
  onSelectDestLocation: (coords: LatLng, name: string) => void;
  onSwapLocations: () => void;
  startName: string;
  destName: string;
}

export const NavigationMap: React.FC<NavigationMapProps> = ({
  route,
  telemetry,
  mapType,
  setMapType,
  onSelectStartLocation,
  onSelectDestLocation,
  onSwapLocations,
  startName,
  destName
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const vehicleMarkerRef = useRef<L.Marker | null>(null);
  const infrastructureGroupRef = useRef<L.LayerGroup | null>(null);

  // Search Bar State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTarget, setSearchTarget] = useState<'start' | 'dest'>('dest');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ name: string; lat: number; lng: number }[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [isTileLoading, setIsTileLoading] = useState(false);
  const [tileError, setTileError] = useState<string | null>(null);

  // ResizeObserver to guarantee the map never has grey/blank areas on layout changes
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize({ debounceMoveend: true });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Initialize Map & Tile Layer
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapRef.current) {
      const initialCenter = route.points[0] || [12.2150, 76.6690];
      const map = L.map(mapContainerRef.current, {
        center: initialCenter,
        zoom: 12,
        zoomControl: false,
        attributionControl: false
      });

      mapRef.current = map;
    }

    const map = mapRef.current;

    // Switch Tile Layer:
    // 1. Vector Dark: Standard OpenStreetMap with CSS dark filter (.osm-dark-tile) - Zero API Key Watermark!
    // 2. Satellite: ESRI World Imagery - High-res aerial view, completely clean, Zero API Key Watermark!
    // 3. Terrain: ESRI World Topo Map - Clean topographical contours, Zero API Key Watermark!
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    let tileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    let maxZoom = 19;
    let tileClassName = 'osm-dark-tile';
    let attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

    if (mapType === 'satellite') {
      tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      maxZoom = 18;
      tileClassName = 'esri-satellite-tile';
      attribution = 'Tiles &copy; Esri';
    } else if (mapType === 'terrain') {
      tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}';
      maxZoom = 18;
      tileClassName = 'esri-topo-tile';
      attribution = 'Tiles &copy; Esri';
    }

    const tile = L.tileLayer(tileUrl, {
      maxZoom,
      className: tileClassName,
      attribution
    });

    tile.on('loading', () => setIsTileLoading(true));
    tile.on('load', () => {
      setIsTileLoading(false);
      setTileError(null);
    });
    tile.on('tileerror', () => {
      setIsTileLoading(false);
    });

    tile.addTo(map);
    tileLayerRef.current = tile;

    // Invalidate size immediately and debounced to prevent any grey blank areas
    map.invalidateSize();
    const timer = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
        try {
          if (polyline.getBounds().isValid()) {
            mapRef.current.fitBounds(polyline.getBounds(), { padding: [50, 50] });
          }
        } catch (e) {}
      }
    }, 150);

    // Route Polyline (Thick vibrant blue route matching reference image)
    if (routePolylineRef.current) {
      map.removeLayer(routePolylineRef.current);
    }

    const polyline = L.polyline(route.points, {
      color: '#0ea5e9', // Vibrant Blue
      weight: 7,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);
    routePolylineRef.current = polyline;

    // Render All Infrastructure Markers matching reference image
    if (infrastructureGroupRef.current) {
      map.removeLayer(infrastructureGroupRef.current);
    }
    const layerGroup = L.layerGroup().addTo(map);
    infrastructureGroupRef.current = layerGroup;

    // 1. START MARKER (Green Pin at Nanjangud Town - Draggable)
    const startCoord = route.points[0];
    if (startCoord) {
      const startHtml = `
        <div class="flex items-center gap-2 group cursor-grab active:cursor-grabbing">
          <div class="w-8 h-8 rounded-full bg-emerald-500 border-2 border-white shadow-2xl flex items-center justify-center text-white font-bold">
            <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
          </div>
          <div class="px-2.5 py-1 rounded-md bg-slate-950/90 border border-slate-700/80 text-white font-bold text-[11px] shadow-xl whitespace-nowrap">
            ${startName}
          </div>
        </div>
      `;
      const startMarker = L.marker(startCoord, {
        draggable: true,
        icon: L.divIcon({ className: 'custom-start-marker', html: startHtml, iconAnchor: [16, 16] })
      }).addTo(layerGroup);

      startMarker.on('dragend', (e) => {
        const newPos = (e.target as L.Marker).getLatLng();
        const coords: LatLng = [parseFloat(newPos.lat.toFixed(5)), parseFloat(newPos.lng.toFixed(5))];
        onSelectStartLocation(coords, `Point (${coords[0].toFixed(3)}, ${coords[1].toFixed(3)})`);
      });
    }

    // 2. DESTINATION MARKER (Red Pin at Mysuru Palace - Draggable)
    const destCoord = route.points[route.points.length - 1];
    if (destCoord) {
      const destHtml = `
        <div class="flex items-center gap-2 group cursor-grab active:cursor-grabbing">
          <div class="w-8 h-8 rounded-full bg-rose-500 border-2 border-white shadow-2xl flex items-center justify-center text-white font-bold">
            <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
          </div>
          <div class="px-2.5 py-1 rounded-md bg-slate-950/90 border border-slate-700/80 text-white font-bold text-[11px] shadow-xl whitespace-nowrap">
            ${destName}
          </div>
        </div>
      `;
      const destMarker = L.marker(destCoord, {
        draggable: true,
        icon: L.divIcon({ className: 'custom-dest-marker', html: destHtml, iconAnchor: [16, 16] })
      }).addTo(layerGroup);

      destMarker.on('dragend', (e) => {
        const newPos = (e.target as L.Marker).getLatLng();
        const coords: LatLng = [parseFloat(newPos.lat.toFixed(5)), parseFloat(newPos.lng.toFixed(5))];
        onSelectDestLocation(coords, `Point (${coords[0].toFixed(3)}, ${coords[1].toFixed(3)})`);
      });
    }

    // 3. TOLL PLAZA (Orange Card & Gate Icon: Kadakola Toll Plaza (FASTag))
    route.tolls.forEach((toll) => {
      const tollHtml = `
        <div class="flex items-center gap-2 group cursor-pointer">
          <div class="w-8 h-8 rounded-lg bg-amber-500 border-2 border-white shadow-2xl flex items-center justify-center text-slate-950 font-black">
            <svg class="w-5 h-5 text-slate-950" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 19V5h16v14M4 10h16M9 19v-5h6v5"/></svg>
          </div>
          <div class="px-2.5 py-1 rounded-md bg-slate-950/90 border border-slate-700/80 text-white font-bold text-[11px] shadow-xl whitespace-nowrap">
            ${toll.name}
          </div>
        </div>
      `;
      L.marker([toll.lat, toll.lng], {
        icon: L.divIcon({ className: 'custom-toll-marker', html: tollHtml, iconAnchor: [16, 16] })
      }).addTo(layerGroup);
    });

    // 4. ROAD WORK AHEAD WARNING BADGE (Red Hazard Triangle: Road Work Ahead (500 m) (Lane Closure))
    const roadWorkHtml = `
      <div class="flex items-center gap-2 group cursor-pointer">
        <div class="w-8 h-8 rounded-lg bg-red-600 border-2 border-white shadow-2xl flex items-center justify-center text-white">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </div>
        <div class="px-2.5 py-1 rounded-md bg-slate-950/90 border border-red-500/80 text-white font-bold text-[11px] shadow-xl whitespace-nowrap">
          <div class="text-rose-400 font-bold">Road Work Ahead</div>
          <div class="text-[9px] text-slate-300">(500 m) (Lane Closure)</div>
        </div>
      </div>
    `;
    L.marker([12.2220, 76.6682], {
      icon: L.divIcon({ className: 'custom-roadwork-marker', html: roadWorkHtml, iconAnchor: [16, 16] })
    }).addTo(layerGroup);

    // 5. RSU ROADSIDE UNIT (Purple Box & Callout: RSU-KAD-01 (300 m range))
    route.rsus.forEach((rsu) => {
      const rsuHtml = `
        <div class="flex items-center gap-2 group cursor-pointer">
          <div class="w-8 h-8 rounded-lg bg-purple-600 border-2 border-white shadow-2xl flex items-center justify-center text-white">
            <svg class="w-4 h-4 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/></svg>
          </div>
          <div class="px-2.5 py-1 rounded-md bg-slate-950/90 border border-slate-700/80 text-white font-bold text-[11px] shadow-xl whitespace-nowrap">
            <div class="text-purple-300 font-bold">${rsu.name}</div>
            <div class="text-[9px] text-slate-400">(${rsu.rangeM} m range)</div>
          </div>
        </div>
      `;
      L.marker([rsu.lat, rsu.lng], {
        icon: L.divIcon({ className: 'custom-rsu-marker', html: rsuHtml, iconAnchor: [16, 16] })
      }).addTo(layerGroup);

      // 300m Coverage Range Circle
      L.circle([rsu.lat, rsu.lng], {
        radius: rsu.rangeM,
        color: '#a855f7',
        dashArray: '5, 5',
        weight: 1.5,
        fillColor: '#9333ea',
        fillOpacity: 0.1
      }).addTo(layerGroup);
    });

    // 6. TRAFFIC SIGNAL (Traffic Light Box & Callout: Mysuru Ring Road Signal (18s))
    route.signals.forEach((sig) => {
      const sigCountdown = sig.countdownSeconds || 18;
      const sigHtml = `
        <div class="flex items-center gap-2 group cursor-pointer">
          <div class="w-6 h-11 rounded-md bg-slate-950 border-2 border-slate-700 shadow-2xl flex flex-col items-center justify-around py-1">
            <div class="w-2.5 h-2.5 rounded-full ${sig.currentPhase === 'red' ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]' : 'bg-slate-800'}"></div>
            <div class="w-2.5 h-2.5 rounded-full ${sig.currentPhase === 'amber' ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]' : 'bg-slate-800'}"></div>
            <div class="w-2.5 h-2.5 rounded-full ${sig.currentPhase === 'green' ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-slate-800'}"></div>
          </div>
          <div class="px-2.5 py-1 rounded-md bg-slate-950/90 border border-slate-700/80 text-white font-bold text-[11px] shadow-xl whitespace-nowrap">
            <div class="text-slate-100 font-bold">${sig.name}</div>
            <div class="text-[10px] text-emerald-400 font-mono">Signal (${sigCountdown}s)</div>
          </div>
        </div>
      `;
      L.marker([sig.lat, sig.lng], {
        icon: L.divIcon({ className: 'custom-sig-marker', html: sigHtml, iconAnchor: [12, 20] })
      }).addTo(layerGroup);
    });

    // 7. Yellow Highway Shields "NH 766" along the corridor matching reference image
    if (route.points.length > 6) {
      const shieldIndices = [
        Math.floor(route.points.length * 0.18),
        Math.floor(route.points.length * 0.52),
        Math.floor(route.points.length * 0.82)
      ];
      shieldIndices.forEach((idx) => {
        const pt = route.points[idx];
        if (pt) {
          const shieldHtml = `
            <div class="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-[10px] shadow-lg border border-amber-200">
              NH 766
            </div>
          `;
          L.marker(pt, {
            icon: L.divIcon({ className: 'highway-shield', html: shieldHtml, iconAnchor: [20, 10] })
          }).addTo(layerGroup);
        }
      });
    }

    // 8. Geographical Town/Landmark Labels matching reference image ("Mysuru", "Badakola", "Bandipalya")
    const townLabels = [
      { name: 'Mysuru', coords: [12.2850, 76.6450] },
      { name: 'Badakola', coords: [12.2100, 76.6420] },
      { name: 'Bandipalya', coords: [12.1650, 76.6380] }
    ];
    townLabels.forEach((town) => {
      const townHtml = `
        <div class="text-white font-bold text-sm tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] opacity-90 select-none">
          ${town.name}
        </div>
      `;
      L.marker(town.coords as LatLng, {
        icon: L.divIcon({ className: 'town-label', html: townHtml, iconAnchor: [30, 10] })
      }).addTo(layerGroup);
    });

    // Click on map to set Destination or Start
    const handleMapClick = (e: L.LeafletMouseEvent) => {
      const coords: LatLng = [parseFloat(e.latlng.lat.toFixed(5)), parseFloat(e.latlng.lng.toFixed(5))];
      onSelectDestLocation(coords, `Map Pin (${coords[0].toFixed(3)}, ${coords[1].toFixed(3)})`);
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
    };
  }, [route, mapType, startName, destName]);

  // Update Moving Vehicle Marker with Cyan Glow & 80 km/h Badge
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const carHtml = `
      <div class="relative flex items-center justify-center" style="transform: rotate(${telemetry.bearing}deg);">
        <!-- Cyan Glowing Ground Halo -->
        <div class="w-12 h-12 rounded-full bg-cyan-400/30 animate-pulse absolute"></div>
        <!-- White Tesla Model Car Silhouette from Top -->
        <div class="w-6 h-10 rounded-lg bg-white border border-slate-400 shadow-2xl flex flex-col items-center justify-between py-1 relative z-10">
          <div class="w-4 h-1.5 rounded-sm bg-slate-900"></div>
          <div class="w-4 h-3 rounded-sm bg-slate-800"></div>
          <div class="w-4 h-1 rounded-sm bg-rose-500"></div>
        </div>
      </div>
      <!-- Speed Tag Badge (80 km/h) right next to vehicle matching reference image -->
      <div class="absolute left-9 -top-1 px-2 py-0.5 rounded-md bg-teal-900/90 border border-cyan-400 text-cyan-200 font-mono font-bold text-[10px] shadow-lg whitespace-nowrap">
        ${telemetry.speedKmH} km/h
      </div>
    `;

    if (!vehicleMarkerRef.current) {
      const marker = L.marker([telemetry.currentLat, telemetry.currentLng], {
        icon: L.divIcon({
          className: 'tesla-live-map-marker',
          html: carHtml,
          iconSize: [48, 48],
          iconAnchor: [24, 24]
        }),
        zIndexOffset: 1000
      }).addTo(map);
      vehicleMarkerRef.current = marker;
    } else {
      vehicleMarkerRef.current.setLatLng([telemetry.currentLat, telemetry.currentLng]);
      const el = vehicleMarkerRef.current.getElement();
      if (el) {
        el.innerHTML = carHtml;
      }
    }
  }, [telemetry.currentLat, telemetry.currentLng, telemetry.bearing, telemetry.speedKmH]);

  // Search Submit Handler
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    const results = await searchLocationInIndia(searchQuery);
    setSearchResults(results);
    setIsSearching(false);
  };

  const handleRecenter = () => {
    if (mapRef.current) {
      mapRef.current.setView([telemetry.currentLat, telemetry.currentLng], 14, { animate: true });
    }
  };

  return (
    <div className="w-full h-full relative overflow-hidden rounded-2xl glass-panel shadow-2xl bg-slate-950">
      {/* Map Container (absolute inset-0 guarantees complete layout fill without grey bars) */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" />

      {/* Loading Indicator */}
      {isTileLoading && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded-full bg-slate-900/95 border border-cyan-500/40 text-[10px] text-cyan-300 font-mono flex items-center gap-2 shadow-2xl backdrop-blur-md animate-in fade-in">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span>Updating Map Tiles...</span>
        </div>
      )}

      {/* TOP LEFT LAYER SWITCHER (Matching Reference Image) */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1 bg-slate-950/85 backdrop-blur-md border border-slate-800 p-1 rounded-xl shadow-2xl">
        {(['map', 'satellite', 'terrain'] as const).map((layer) => (
          <button
            key={layer}
            onClick={() => setMapType(layer)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
              mapType === layer
                ? 'bg-sky-500 text-white font-bold shadow-md shadow-sky-500/25'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            {layer}
          </button>
        ))}
      </div>

      {/* TOP RIGHT SEARCH & LAYER ICON */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        <button
          onClick={() => setIsSearchOpen(!isSearchOpen)}
          title="Search Places Anywhere in India"
          className="p-2 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-800 text-slate-200 hover:text-cyan-400 hover:border-cyan-500/40 transition-colors shadow-xl flex items-center gap-1.5 text-xs font-medium"
        >
          <Search className="w-4 h-4" />
          <span className="hidden sm:inline">Search India</span>
        </button>

        <button
          onClick={onSwapLocations}
          title="Swap Start & Destination"
          className="p-2 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-800 text-slate-200 hover:text-cyan-400 transition-colors shadow-xl"
        >
          <ArrowLeftRight className="w-4 h-4" />
        </button>
      </div>

      {/* SEARCH OVERLAY PANEL (Google Maps Style Geocoding) */}
      {isSearchOpen && (
        <div className="absolute top-14 left-3 right-3 sm:right-auto sm:w-96 z-30 bg-slate-900/95 backdrop-blur-xl border border-cyan-500/40 rounded-2xl p-4 shadow-2xl animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-bold text-slate-100 font-display uppercase tracking-wider flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-cyan-400" /> Search Place in India
            </div>
            <button onClick={() => setIsSearchOpen(false)} className="text-slate-400 hover:text-slate-100">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => setSearchTarget('start')}
              className={`flex-1 py-1 rounded-lg text-xs font-semibold ${
                searchTarget === 'start' ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              Set Start (A)
            </button>
            <button
              onClick={() => setSearchTarget('dest')}
              className={`flex-1 py-1 rounded-lg text-xs font-semibold ${
                searchTarget === 'dest' ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              Set Destination (B)
            </button>
          </div>

          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="e.g. Mysuru Palace, Bengaluru, NH 766..."
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-400 font-medium"
            />
            <button
              type="submit"
              disabled={isSearching}
              className="px-3 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400 transition-colors"
            >
              {isSearching ? '...' : 'Go'}
            </button>
          </form>

          {/* Quick Shortcuts */}
          <div className="mt-3 pt-2 border-t border-slate-800 flex flex-wrap gap-1.5 text-[10px]">
            <button
              onClick={() => {
                onSelectStartLocation([12.1180, 76.6800], 'Nanjangud Town (NH 766)');
                onSelectDestLocation([12.3051, 76.6552], 'Mysuru Palace (Amba Vilas)');
                setIsSearchOpen(false);
              }}
              className="px-2 py-1 rounded bg-slate-800 text-cyan-300 hover:bg-slate-700 font-medium"
            >
              Default: Nanjangud → Mysuru
            </button>
            <button
              onClick={() => {
                onSelectStartLocation([12.3082, 76.6578], 'KSRTC Bus Stand, Mysuru');
                onSelectDestLocation([12.3685, 76.6080], 'NIE North, Mysuru');
                setIsSearchOpen(false);
              }}
              className="px-2 py-1 rounded bg-slate-800 text-emerald-300 hover:bg-slate-700 font-medium"
            >
              City: KSRTC → NIE North
            </button>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-3 max-h-48 overflow-y-auto space-y-1">
              {searchResults.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    const coords: LatLng = [item.lat, item.lng];
                    if (searchTarget === 'start') {
                      onSelectStartLocation(coords, item.name);
                    } else {
                      onSelectDestLocation(coords, item.name);
                    }
                    setIsSearchOpen(false);
                  }}
                  className="p-2 rounded-lg bg-slate-950/80 hover:bg-cyan-950/60 border border-slate-800 text-xs cursor-pointer transition-colors"
                >
                  <div className="font-semibold text-slate-200 line-clamp-1">{item.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {item.lat.toFixed(4)}, {item.lng.toFixed(4)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* BOTTOM RIGHT ZOOM & RECENTER CONTROLS (Matching Reference Image) */}
      <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1.5">
        <button
          onClick={() => mapRef.current?.zoomIn()}
          title="Zoom In"
          className="w-8 h-8 rounded-xl bg-white text-slate-900 flex items-center justify-center font-bold shadow-xl hover:bg-slate-100 transition-colors"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
        </button>
        <button
          onClick={() => mapRef.current?.zoomOut()}
          title="Zoom Out"
          className="w-8 h-8 rounded-xl bg-white text-slate-900 flex items-center justify-center font-bold shadow-xl hover:bg-slate-100 transition-colors"
        >
          <Minus className="w-4 h-4 stroke-[2.5]" />
        </button>
        <button
          onClick={handleRecenter}
          title="Recenter on Moving Tesla"
          className="w-8 h-8 rounded-xl bg-white text-slate-900 flex items-center justify-center font-bold shadow-xl hover:bg-slate-100 transition-colors"
        >
          <Crosshair className="w-4 h-4 text-cyan-600 stroke-[2.5]" />
        </button>
      </div>

      {/* BOTTOM LEFT GIS ATTRIBUTION & SCALE BAR (Clean, No API Key Watermarks) */}
      <div className="absolute bottom-3 left-3 z-10 pointer-events-none flex items-center gap-2">
        <div className="flex items-center text-[10px] font-mono select-none bg-slate-950/90 px-2.5 py-1 rounded-lg border border-slate-800 text-cyan-400 shadow-xl">
          <span>OSM Vector Dark • OSRM</span>
        </div>
        <div className="px-2.5 py-1 rounded-lg bg-slate-950/90 backdrop-blur-md border border-slate-800 text-[10px] font-mono text-slate-300 flex items-center gap-2 shadow-xl">
          <div className="w-8 h-1 bg-cyan-400"></div>
          <span>2 km</span>
        </div>
      </div>
    </div>
  );
};
