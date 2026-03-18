import React, { useEffect, useRef, useState } from 'react';
import { getAirportByIcao } from '../airportsData';

export default function FlightMap({ flights = [], aircraft = [], crew = [] }) {
  const mapRef  = useRef(null);
  const mapInst = useRef(null);
  const [filterAc,   setFilterAc]   = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo,   setFilterTo]   = useState('');
  const [filterCond, setFilterCond] = useState('');
  const [loaded, setLoaded]         = useState(false);
  const [stats, setStats]           = useState({ routes:0, airports:0, nm:0 });

  // Load Leaflet from CDN
  useEffect(() => {
    if (window.L) { setLoaded(true); return; }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
  }, []);

  const filtered = flights.filter(f => {
    if (filterAc   && f.aircraftId !== filterAc) return false;
    if (filterCond && f.flightConditions !== filterCond) return false;
    if (filterFrom && f.date < filterFrom) return false;
    if (filterTo   && f.date > filterTo)   return false;
    return true;
  });

  useEffect(() => {
    if (!loaded || !mapRef.current) return;
    const L = window.L;

    if (mapInst.current) { mapInst.current.remove(); mapInst.current = null; }

    const map = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: true });
    mapInst.current = map;

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      maxZoom: 18,
    }).addTo(map);

    const airportSet = new Set();
    const routeMap   = {};
    let totalNm = 0;

    filtered.forEach(f => {
      const dep = getAirportByIcao(f.departureIcao);
      const dst = getAirportByIcao(f.destinationIcao);
      if (!dep?.lat || !dst?.lat) return;

      airportSet.add(f.departureIcao);
      airportSet.add(f.destinationIcao);
      totalNm += parseFloat(f.distanceNm || 0);

      const key = [f.departureIcao, f.destinationIcao].sort().join('-');
      routeMap[key] = (routeMap[key] || { dep, dst, count: 0, flights: [] });
      routeMap[key].count++;
      routeMap[key].flights.push(f);
    });

    // Draw routes
    const acColors = {};
    const palette = ['#4d9de0','#3dbf8a','#e8a84a','#9b7fe8','#e05c5c','#3dc4c0'];
    aircraft.forEach((ac, i) => { acColors[ac.id] = palette[i % palette.length]; });

    Object.values(routeMap).forEach(({ dep, dst, count, flights: rFlights }) => {
      const color = filterAc ? (acColors[filterAc] || '#4d9de0') :
        (acColors[rFlights[0]?.aircraftId] || '#4d9de0');
      const weight = Math.min(1 + count * 0.5, 4);

      L.polyline(
        [[dep.lat, dep.lng], [dst.lat, dst.lng]],
        { color, weight, opacity: 0.7, dashArray: rFlights[0]?.flightConditions === 'ifr' ? null : '5,5' }
      ).bindPopup(`
        <b>${dep.icao} → ${dst.icao}</b><br>
        ${dep.name} → ${dst.name}<br>
        ${count} voo(s)
      `).addTo(map);
    });

    // Draw airports
    airportSet.forEach(icao => {
      const ap = getAirportByIcao(icao);
      if (!ap?.lat) return;
      const circle = L.circleMarker([ap.lat, ap.lng], {
        radius: 5, fillColor: '#4d9de0', color: '#fff',
        weight: 1.5, opacity: 1, fillOpacity: 0.9,
      });
      circle.bindPopup(`<b>${ap.icao}</b><br>${ap.name}<br>${ap.city}${ap.state ? ', ' + ap.state : ''}`);
      circle.addTo(map);
    });

    setStats({ routes: Object.keys(routeMap).length, airports: airportSet.size, nm: Math.round(totalNm) });

    // Fit bounds
    const allPts = [];
    Object.values(routeMap).forEach(({ dep, dst }) => {
      allPts.push([dep.lat, dep.lng], [dst.lat, dst.lng]);
    });
    if (allPts.length > 0) {
      map.fitBounds(allPts, { padding: [40, 40] });
    } else {
      map.setView([-15.8, -47.9], 4);
    }

    return () => { if (mapInst.current) { mapInst.current.remove(); mapInst.current = null; } };
  }, [loaded, filtered, aircraft, filterAc]);

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 400, marginBottom: 4 }}>Mapa de voos</div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>Rotas sólidas = IFR · Tracejadas = VFR</div>

      {/* Filters */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          <div>
            <label>Aeronave</label>
            <select value={filterAc} onChange={e => setFilterAc(e.target.value)}>
              <option value="">Todas</option>
              {aircraft.map(ac => <option key={ac.id} value={ac.id}>{ac.registration}</option>)}
            </select>
          </div>
          <div>
            <label>Condição</label>
            <select value={filterCond} onChange={e => setFilterCond(e.target.value)}>
              <option value="">IFR + VFR</option>
              <option value="ifr">Somente IFR</option>
              <option value="vfr">Somente VFR</option>
            </select>
          </div>
          <div>
            <label>Data início</label>
            <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
          </div>
          <div>
            <label>Data fim</label>
            <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <button onClick={() => { setFilterAc(''); setFilterCond(''); setFilterFrom(''); setFilterTo(''); }}
              style={{ flex: 1, padding: '8px', fontSize: 12 }}>Limpar</button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
        {[
          { label: 'Voos', value: filtered.length },
          { label: 'Rotas únicas', value: stats.routes },
          { label: 'Aeródromos', value: stats.airports },
          { label: 'Total nm', value: stats.nm.toLocaleString('pt-BR') },
        ].map(s => (
          <div key={s.label} style={{ padding: '10px 16px', background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 10, minWidth: 100 }}>
            <div style={{ fontSize: 9.5, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 3 }}>{s.label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, color: 'var(--text1)' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Map */}
      {!loaded ? (
        <div style={{ height: 500, background: 'var(--bg2)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13 }}>
          Carregando mapa...
        </div>
      ) : (
        <div ref={mapRef} style={{ height: 520, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }} />
      )}

      {filtered.length === 0 && loaded && (
        <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 12, marginTop: 16 }}>
          Nenhum voo com coordenadas disponíveis. Certifique-se de que os campos de origem e destino (ICAO) estão preenchidos.
        </div>
      )}
    </div>
  );
}
