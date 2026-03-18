// ============================================================
// AeroManager — GPS Flight Tracker Engine
// Detecta automaticamente decolagem, cruzeiro e pouso
// Preenche o voo com dados reais de GPS
// ============================================================

import { saveFlight, saveCost, getMaintenance, saveMaintenance } from './store';

const TRACKER_KEY  = 'am3_tracker_state';
const TRACK_KEY    = 'am3_track_points';
const AIRPORTS_KEY = 'am3_airports_cache';

// ── Thresholds ────────────────────────────────────────────────
const TAKEOFF_SPEED_KT    = 40;   // above this = airborne
const LANDING_SPEED_KT    = 35;   // below this = landed
const CONFIRM_SECS        = 20;   // seconds to confirm state change
const TRACKING_INTERVAL   = 10000; // ms between GPS reads (10s)
const CRUISE_ALT_MARGIN   = 200;   // ft — altitude stable = cruising

// ── Airport DB (subset for matching) ─────────────────────────
// We store positions in localStorage on first load from store
function loadAirportCache() {
  try { return JSON.parse(localStorage.getItem(AIRPORTS_KEY)) || []; }
  catch { return []; }
}

export function seedAirportCache(airports) {
  // airports: [{icao, lat, lon, name}]
  localStorage.setItem(AIRPORTS_KEY, JSON.stringify(airports));
}

// Haversine distance in nm
function distanceNm(lat1, lon1, lat2, lon2) {
  const R = 3440.065; // nm
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function findNearestAirport(lat, lon, maxNm = 5) {
  const airports = loadAirportCache();
  let best = null, bestDist = Infinity;
  for (const ap of airports) {
    const d = distanceNm(lat, lon, ap.lat, ap.lon);
    if (d < bestDist) { bestDist = d; best = ap; }
  }
  return bestDist <= maxNm ? best : null;
}

// m/s → knots
function msToKt(ms) { return ms * 1.94384; }

// ── State management ──────────────────────────────────────────
export function getTrackerState() {
  try { return JSON.parse(localStorage.getItem(TRACKER_KEY)) || { status: 'idle' }; }
  catch { return { status: 'idle' }; }
}

function saveTrackerState(state) {
  localStorage.setItem(TRACKER_KEY, JSON.stringify(state));
}

function getTrackPoints() {
  try { return JSON.parse(localStorage.getItem(TRACK_KEY)) || []; }
  catch { return []; }
}

function addTrackPoint(point) {
  const points = getTrackPoints();
  points.push(point);
  // Keep last 2000 points (~5.5 hours at 10s interval)
  if (points.length > 2000) points.splice(0, points.length - 2000);
  localStorage.setItem(TRACK_KEY, JSON.stringify(points));
}

function clearTrack() {
  localStorage.removeItem(TRACK_KEY);
}

// ── Core tracker class ────────────────────────────────────────
class FlightTracker {
  constructor() {
    this.intervalId = null;
    this.listeners  = [];
    this.stateConfirmStart = null;
    this.pendingState      = null;
  }

  subscribe(fn) {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter(l => l !== fn); };
  }

  notify(state) {
    this.listeners.forEach(fn => fn(state));
  }

  getState() { return getTrackerState(); }

  async start(aircraftId) {
    if (!navigator.geolocation) throw new Error('GPS não disponível neste dispositivo.');

    const state = {
      status: 'waiting_takeoff',
      aircraftId,
      startedAt: new Date().toISOString(),
      departureIcao: null,
      departureTime: null,
      takeoffTime: null,
      landingTime: null,
      destinationIcao: null,
      maxAltitudeFt: 0,
      cruiseAltitudeFt: 0,
      currentSpeedKt: 0,
      currentAltFt: 0,
      currentLat: null,
      currentLon: null,
      distanceNm: 0,
      phases: [],
      lastPhase: 'ground',
    };

    clearTrack();
    saveTrackerState(state);
    this.notify(state);

    // Get initial position for departure airport
    try {
      const pos = await this._getPosition();
      const apt = findNearestAirport(pos.coords.latitude, pos.coords.longitude);
      state.departureIcao   = apt?.icao || null;
      state.departureLatLon = [pos.coords.latitude, pos.coords.longitude];
      state.departureTime   = new Date().toISOString();
      saveTrackerState(state);
    } catch(e) { console.warn('Could not get initial position:', e); }

    // Start polling
    this.intervalId = setInterval(() => this._tick(), TRACKING_INTERVAL);
    this._tick(); // immediate first tick
  }

  stop() {
    if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; }
    const state = getTrackerState();
    state.status = 'idle';
    saveTrackerState(state);
    this.notify(state);
  }

  async _getPosition() {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 5000,
      });
    });
  }

  async _tick() {
    const state = getTrackerState();
    if (state.status === 'idle') return;

    let pos;
    try { pos = await this._getPosition(); }
    catch(e) {
      console.warn('GPS error:', e.message);
      this.notify({ ...state, gpsError: e.message });
      return;
    }

    const { latitude: lat, longitude: lon, altitude, speed, accuracy } = pos.coords;
    const altFt   = altitude ? altitude * 3.28084 : state.currentAltFt || 0;
    const speedKt = speed ? msToKt(speed) : 0;
    const now     = new Date().toISOString();

    // Add track point
    addTrackPoint({ lat, lon, altFt, speedKt, ts: now, accuracy });

    // Update current values
    state.currentLat    = lat;
    state.currentLon    = lon;
    state.currentAltFt  = Math.round(altFt);
    state.currentSpeedKt= Math.round(speedKt);
    state.maxAltitudeFt = Math.max(state.maxAltitudeFt || 0, altFt);

    // Calculate distance from track
    const points = getTrackPoints();
    if (points.length >= 2) {
      let total = 0;
      for (let i = 1; i < points.length; i++) {
        total += distanceNm(points[i-1].lat, points[i-1].lon, points[i].lat, points[i].lon);
      }
      state.distanceNm = parseFloat(total.toFixed(1));
    }

    // ── State machine ──────────────────────────────────────────
    if (state.status === 'waiting_takeoff') {
      if (speedKt >= TAKEOFF_SPEED_KT) {
        if (!this.stateConfirmStart) {
          this.stateConfirmStart = Date.now();
          this.pendingState      = 'airborne';
        } else if (Date.now() - this.stateConfirmStart > CONFIRM_SECS * 1000) {
          // Confirmed takeoff!
          state.status      = 'airborne';
          state.takeoffTime = now;
          state.lastPhase   = 'climb';
          state.phases.push({ phase: 'climb', startTime: now, startAltFt: altFt });
          this.stateConfirmStart = null;
          this.pendingState      = null;
        }
      } else {
        this.stateConfirmStart = null;
        this.pendingState      = null;
      }
    }

    else if (state.status === 'airborne') {
      // Detect landing
      if (speedKt < LANDING_SPEED_KT && altFt < 1000) {
        if (!this.stateConfirmStart) {
          this.stateConfirmStart = Date.now();
          this.pendingState      = 'landed';
        } else if (Date.now() - this.stateConfirmStart > CONFIRM_SECS * 1000) {
          // Confirmed landing!
          state.status         = 'landed';
          state.landingTime    = now;
          const apt = findNearestAirport(lat, lon);
          state.destinationIcao = apt?.icao || null;

          // Close last phase
          if (state.phases.length > 0) {
            const last = state.phases[state.phases.length - 1];
            last.endTime   = now;
            last.endAltFt  = altFt;
          }

          // Calculate cruise altitude (most common altitude during flight)
          const airbornePoints = points.filter(p => p.speedKt > TAKEOFF_SPEED_KT);
          if (airbornePoints.length > 5) {
            const alts = airbornePoints.map(p => p.altFt).sort((a,b)=>a-b);
            state.cruiseAltitudeFt = Math.round(alts[Math.floor(alts.length * 0.6)] / 100) * 100;
          }

          this.stateConfirmStart = null;
          this.pendingState      = null;
          clearInterval(this.intervalId);
          this.intervalId = null;
        }
      } else {
        this.stateConfirmStart = null;
        this.pendingState      = null;

        // Detect phase transitions
        const lastPhase = state.phases[state.phases.length - 1];
        if (lastPhase) {
          const altDiff = altFt - (lastPhase.startAltFt || 0);
          if (state.lastPhase === 'climb' && altDiff < CRUISE_ALT_MARGIN && speedKt > TAKEOFF_SPEED_KT) {
            // Transition to cruise
            lastPhase.endTime  = now;
            lastPhase.endAltFt = altFt;
            state.phases.push({ phase: 'cruise', startTime: now, startAltFt: altFt });
            state.lastPhase = 'cruise';
          } else if (state.lastPhase === 'cruise' && altFt < (state.cruiseAltitudeFt || state.maxAltitudeFt) - 500) {
            // Transition to descent
            lastPhase.endTime  = now;
            lastPhase.endAltFt = altFt;
            state.phases.push({ phase: 'descent', startTime: now, startAltFt: altFt });
            state.lastPhase = 'descent';
          }
        }
      }
    }

    saveTrackerState(state);
    this.notify(state);
  }

  // Called when pilot manually confirms the flight after landing
  async confirmFlight(overrides = {}) {
    const state   = getTrackerState();
    const points  = getTrackPoints();

    if (!state.takeoffTime || !state.landingTime) return null;

    const takeoff  = new Date(state.takeoffTime);
    const landing  = new Date(state.landingTime);
    const flightMins = Math.round((landing - takeoff) / 60000);

    // Phase durations
    const phases = {};
    state.phases.forEach(p => {
      if (p.startTime && p.endTime) {
        phases[p.phase] = Math.round((new Date(p.endTime) - new Date(p.startTime)) / 60000);
      }
    });

    // Build flight object
    const flight = {
      aircraftId:        state.aircraftId,
      date:              takeoff.toISOString().slice(0, 10),
      departureIcao:     overrides.departureIcao  || state.departureIcao  || '',
      destinationIcao:   overrides.destinationIcao|| state.destinationIcao|| '',
      takeoffUtc:        takeoff.toTimeString().slice(0,5),
      landingUtc:        landing.toTimeString().slice(0,5),
      flightTimeMinutes: overrides.flightTimeMinutes || flightMins,
      distanceNm:        overrides.distanceNm || parseFloat(state.distanceNm?.toFixed(1) || 0),
      cruiseAltitudeFt:  overrides.cruiseAltitudeFt || state.cruiseAltitudeFt || 0,
      maxAltitudeFt:     state.maxAltitudeFt || 0,
      flightConditions:  overrides.flightConditions || 'vfr',
      purpose:           overrides.purpose || 'leisure',
      cycles:            1,
      phaseClimbMin:     phases.climb   || 0,
      phaseCruiseMin:    phases.cruise  || 0,
      phaseDescentMin:   phases.descent || 0,
      source:            'gps',
      gpsTrackPoints:    points.length,
      logbookNotes:      overrides.logbookNotes || `Voo registrado por GPS. Distância: ${state.distanceNm?.toFixed(1)} nm. Alt. máx.: ${Math.round(state.maxAltitudeFt)}ft.`,
      ...overrides,
    };

    const saved = await saveFlight(flight);

    // Auto-update maintenance
    await _deductMaintenance(state.aircraftId, flightMins / 60, 1);

    // Reset tracker
    clearTrack();
    saveTrackerState({ status: 'idle' });
    this.notify({ status: 'idle' });

    return saved;
  }

  // Discard current tracking session
  discard() {
    clearTrack();
    saveTrackerState({ status: 'idle' });
    if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; }
    this.notify({ status: 'idle' });
  }
}

// Deduce hours and cycles from all maintenance items for an aircraft
async function _deductMaintenance(aircraftId, hoursFlown, cycles) {
  const items = (await getMaintenance()).filter(m => m.aircraftId === aircraftId);
  for (const item of items) {
    if (item.nextDueHours) {
      const remaining = parseFloat(item.nextDueHours) - hoursFlown;
      const updated   = { ...item };
      if (remaining <= 0) updated.status = 'overdue';
      else if (remaining <= 10) updated.status = 'due_soon';
      else updated.status = 'current';
      await saveMaintenance(updated);
    }
  }
}

// Export singleton
export const tracker = new FlightTracker();

// ── GPX export ────────────────────────────────────────────────
export function exportGPX() {
  const points = getTrackPoints();
  if (!points.length) return null;

  const header = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="AeroManager" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><name>AeroManager Flight</name><trkseg>`;
  const footer = `  </trkseg></trk></gpx>`;
  const pts = points.map(p =>
    `    <trkpt lat="${p.lat}" lon="${p.lon}"><ele>${Math.round((p.altFt||0)*0.3048)}</ele><time>${p.ts}</time></trkpt>`
  ).join('\n');

  return header + '\n' + pts + '\n' + footer;
}
