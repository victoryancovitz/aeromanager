import React, { useState, useEffect } from 'react';
import { getCrewMembers, getCrewDocuments } from '../store';

// Generates GD as HTML for printing / PDF via browser
function buildGDHTML(data) {
  const { operator, registration, flightNo, date, depPlace, arrPlace, routing, crew, pax } = data;

  const crewRows = crew.map(c => `
    <tr>
      <td style="padding:5px 8px;border:1px solid #999;font-size:11px">CREW</td>
      <td style="padding:5px 8px;border:1px solid #999;font-size:11px">${c.name}</td>
      <td style="padding:5px 8px;border:1px solid #999;font-size:11px;font-family:monospace">${c.passport || ''}</td>
      <td style="padding:5px 8px;border:1px solid #999;font-size:11px">${c.dob ? new Date(c.dob).toLocaleDateString('en-GB') : ''}</td>
      <td style="padding:5px 8px;border:1px solid #999;font-size:11px">${c.nationality || ''}</td>
    </tr>`).join('');

  const paxRows = pax.map(p => `
    <tr>
      <td style="padding:5px 8px;border:1px solid #999;font-size:11px">PAX</td>
      <td style="padding:5px 8px;border:1px solid #999;font-size:11px">${p.name}</td>
      <td style="padding:5px 8px;border:1px solid #999;font-size:11px;font-family:monospace">${p.passport || ''}</td>
      <td style="padding:5px 8px;border:1px solid #999;font-size:11px">${p.dob ? new Date(p.dob).toLocaleDateString('en-GB') : ''}</td>
      <td style="padding:5px 8px;border:1px solid #999;font-size:11px">${p.nationality || ''}</td>
    </tr>`).join('');

  const routeRows = routing.map(r => `
    <tr>
      <td style="padding:4px 8px;border:1px solid #999;font-size:11px;font-family:monospace">${r}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #000; background: #fff; padding: 20px; }
  h1 { font-size: 16px; text-align: center; font-weight: bold; margin-bottom: 4px; }
  h2 { font-size: 12px; text-align: center; margin-bottom: 16px; }
  .field-row { display: flex; gap: 16px; margin-bottom: 8px; align-items: baseline; }
  .field { flex: 1; border-bottom: 1px solid #000; padding-bottom: 2px; min-height: 18px; font-size: 11px; }
  .field-label { font-size: 9px; color: #555; white-space: nowrap; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th { padding: 5px 8px; border: 1px solid #999; font-size: 10px; background: #f0f0f0; text-align: left; }
  .sig-area { border: 1px solid #000; height: 50px; margin-top: 8px; padding: 4px 8px; font-size: 10px; color: #555; }
  @media print {
    body { padding: 10mm; }
    button { display: none; }
  }
</style>
</head>
<body>
<div style="border:2px solid #000;padding:16px;max-width:210mm;margin:0 auto">
  <h1>GENERAL DECLARATION</h1>
  <h2>(Outward / Inward) — ICAO Annex 9 Appendix 1</h2>

  <div class="field-row">
    <div style="flex:3">
      <div class="field-label">Operator / Operador</div>
      <div class="field">${operator || ''}</div>
    </div>
  </div>

  <div class="field-row" style="margin-top:8px">
    <div style="flex:2">
      <div class="field-label">Marks of Nationality and Registration / Matrícula</div>
      <div class="field">${registration || ''}</div>
    </div>
    <div style="flex:1">
      <div class="field-label">Flight No.</div>
      <div class="field">${flightNo || 'PRIVATE'}</div>
    </div>
    <div style="flex:1">
      <div class="field-label">Date</div>
      <div class="field">${date ? new Date(date+'T12:00:00').toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'}).toUpperCase() : ''}</div>
    </div>
  </div>

  <div class="field-row" style="margin-top:8px">
    <div style="flex:1">
      <div class="field-label">Departure from (Place)</div>
      <div class="field">${depPlace || ''}</div>
    </div>
    <div style="flex:1">
      <div class="field-label">Arrival at (Place)</div>
      <div class="field">${arrPlace || ''}</div>
    </div>
  </div>

  <div style="margin-top:12px">
    <div style="font-size:11px;font-weight:bold;margin-bottom:4px">FLIGHT ROUTING</div>
    <table>
      <thead><tr><th>PLACE (Origin / Stops / Destination)</th></tr></thead>
      <tbody>${routeRows || '<tr><td style="padding:5px 8px;border:1px solid #999;font-size:11px">&nbsp;</td></tr>'}</tbody>
    </table>
  </div>

  <div style="margin-top:12px">
    <div style="font-size:11px;font-weight:bold;margin-bottom:4px">CREW AND PASSENGERS / TRIPULAÇÃO E PASSAGEIROS</div>
    <table>
      <thead>
        <tr>
          <th style="width:60px">Type</th>
          <th>Name / Nome</th>
          <th style="width:110px">Passport No.</th>
          <th style="width:90px">DOB</th>
          <th style="width:90px">Nationality</th>
        </tr>
      </thead>
      <tbody>
        ${crewRows}
        ${paxRows}
        <tr><td colspan="5" style="padding:4px 8px;border:1px solid #999;font-size:9px;color:#666">PAX embarking: ${pax.length} &nbsp;&nbsp; PAX disembarking: ${pax.length} &nbsp;&nbsp; Crew: ${crew.length}</td></tr>
      </tbody>
    </table>
  </div>

  <div style="margin-top:12px;font-size:10px;border:1px solid #ccc;padding:8px">
    <strong>Declaration of Health:</strong> Name and function of persons on board with illness or communicable disease: NONE
  </div>

  <div style="margin-top:16px">
    <div style="font-size:10px;line-height:1.5">I declare that all statements and particulars contained in this General Declaration, and in any supplementary forms required to be presented with this General Declaration, are complete, exact and true to the best of my knowledge.</div>
    <div class="sig-area" style="margin-top:12px">
      <div>SIGNATURE __________________________________ &nbsp;&nbsp;&nbsp; Date: _____________</div>
      <div style="margin-top:8px;font-size:10px">Authorized Agent or Pilot-in-command</div>
    </div>
  </div>

  <div style="margin-top:16px;font-size:9px;color:#888;text-align:center">
    Generated by AeroManager · Size A4 210mm × 297mm · ICAO Annex 9, Appendix 1
  </div>
</div>
</body>
</html>`;
}

export default function GeneralDeclaration({ mission, aircraft, onClose }) {
  const [form, setForm] = useState({
    operator: '',
    registration: aircraft?.[0]?.registration || '',
    flightNo: 'PRIVATE',
    date: mission?.dateStart || new Date().toISOString().slice(0,10),
    depPlace: mission?.legs?.[0]?.departureIcao || '',
    arrPlace: mission?.legs?.[mission?.legs?.length-1]?.destinationIcao || '',
    routing: [],
    crew: [],
    pax: [],
  });
  const [allCrew, setAllCrew] = useState([]);
  const [selectedCrew, setSelectedCrew] = useState([]);
  const [selectedPax, setSelectedPax] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generated, setGenerated] = useState(false);

  useEffect(() => {
    loadCrew();
  }, []);

  async function loadCrew() {
    setLoading(true);
    try {
      const members = await getCrewMembers();
      // Load docs for each
      const withDocs = await Promise.all(members.map(async m => {
        const docs = await getCrewDocuments(m.id);
        const passport = docs.find(d => d.doc_type === 'passport');
        return {
          ...m,
          passport: passport?.doc_number || '',
          dob:      m.dob || passport?.raw_data?.dob || '',
          nationality: m.nationality || passport?.raw_data?.nationality || '',
        };
      }));
      setAllCrew(withDocs);
      // Pre-select crew from mission if available
      if (mission?.passengers) {
        const crewFromMission = mission.passengers.filter(p => p.role === 'crew').map(p => p.name);
        const paxFromMission  = mission.passengers.filter(p => p.role === 'pax').map(p => p.name);
        const matchCrew = withDocs.filter(m => crewFromMission.some(n => m.full_name.includes(n) || n.includes(m.full_name)));
        const matchPax  = withDocs.filter(m => paxFromMission.some(n => m.full_name.includes(n) || n.includes(m.full_name)));
        setSelectedCrew(matchCrew.map(m => m.id));
        setSelectedPax(matchPax.map(m => m.id));
      }
      // Auto-build routing from legs
      if (mission?.legs?.length) {
        const places = [mission.legs[0].departureIcao, ...mission.legs.map(l => l.destinationIcao)];
        setForm(f => ({ ...f, routing: places }));
      }
    } catch(e) { console.error(e); }
    setLoading(false);
  }

  function toggleCrew(id) { setSelectedCrew(s => s.includes(id) ? s.filter(x=>x!==id) : [...s,id]); }
  function togglePax(id)  { setSelectedPax(s  => s.includes(id) ? s.filter(x=>x!==id) : [...s,id]); }

  function generate() {
    const crew = allCrew.filter(m => selectedCrew.includes(m.id)).map(m => ({ name: m.full_name, passport: m.passport, dob: m.dob, nationality: m.nationality }));
    const pax  = allCrew.filter(m => selectedPax.includes(m.id)).map(m => ({ name: m.full_name, passport: m.passport, dob: m.dob, nationality: m.nationality }));
    const html = buildGDHTML({ ...form, crew, pax });

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
    setGenerated(true);
  }

  const set = (k,v) => setForm(f => ({...f,[k]:v}));

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', zIndex:1002, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'30px 20px', overflowY:'auto' }}>
      <div style={{ background:'var(--bg1)', border:'1px solid var(--border)', borderRadius:16, width:'100%', maxWidth:640, padding:28 }}>

        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:22 }}>
          <div style={{ width:40, height:40, borderRadius:10, background:'var(--purple-dim)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>📄</div>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:'var(--font-serif)', fontSize:18 }}>General Declaration</div>
            <div style={{ fontSize:11, color:'var(--text3)', marginTop:1 }}>ICAO Annex 9 — Appendix 1</div>
          </div>
          <button className="ghost" onClick={onClose} style={{ fontSize:16 }}>✕</button>
        </div>

        {loading ? <div style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>Carregando tripulantes...</div> : (
          <div>
            <div className="card" style={{ padding:'14px 18px', marginBottom:14 }}>
              <div className="section-title">Dados do voo</div>
              <div className="g2" style={{ marginBottom:12 }}>
                <div><label>Operador</label><input value={form.operator} onChange={e=>set('operator',e.target.value)} placeholder="Exemplo Aviação Executiva Ltda" /></div>
                <div><label>Matrícula</label>
                  <select value={form.registration} onChange={e=>set('registration',e.target.value)}>
                    {aircraft.map(ac=><option key={ac.id} value={ac.registration}>{ac.registration}</option>)}
                  </select>
                </div>
              </div>
              <div className="g3" style={{ marginBottom:12 }}>
                <div><label>Voo Nº</label><input value={form.flightNo} onChange={e=>set('flightNo',e.target.value)} placeholder="PRIVATE" /></div>
                <div><label>Data</label><input type="date" value={form.date} onChange={e=>set('date',e.target.value)} /></div>
                <div></div>
              </div>
              <div className="g2">
                <div><label>Saída (ICAO + cidade)</label><input value={form.depPlace} onChange={e=>set('depPlace',e.target.value)} placeholder="SBGR - São Paulo, Brazil" /></div>
                <div><label>Chegada (ICAO + cidade)</label><input value={form.arrPlace} onChange={e=>set('arrPlace',e.target.value)} placeholder="KOPF - Miami, USA" /></div>
              </div>
            </div>

            <div className="card" style={{ padding:'14px 18px', marginBottom:14 }}>
              <div className="section-title">Tripulação ({selectedCrew.length} selecionados)</div>
              {allCrew.filter(m => m.role !== 'pax').map(m => {
                const sel = selectedCrew.includes(m.id);
                return (
                  <div key={m.id} onClick={() => toggleCrew(m.id)} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:8, cursor:'pointer', background: sel?'var(--blue-dim)':'transparent', border:`1px solid ${sel?'var(--blue-mid)':'transparent'}`, marginBottom:4 }}>
                    <div style={{ width:16, height:16, borderRadius:4, border:`2px solid ${sel?'var(--blue)':'var(--border2)'}`, background:sel?'var(--blue)':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      {sel && <span style={{ fontSize:9, color:'#fff' }}>✓</span>}
                    </div>
                    <div style={{ flex:1, fontSize:12 }}>{m.full_name}</div>
                    <div style={{ fontSize:10, color:'var(--text3)', fontFamily:'var(--font-mono)' }}>{m.passport || '—'}</div>
                    <div style={{ fontSize:10, color:'var(--text3)' }}>{m.nationality || ''}</div>
                  </div>
                );
              })}
              {allCrew.filter(m=>m.role!=='pax').length===0 && <div style={{ fontSize:12, color:'var(--text3)', padding:'8px 0' }}>Nenhum tripulante cadastrado</div>}
            </div>

            <div className="card" style={{ padding:'14px 18px', marginBottom:20 }}>
              <div className="section-title">Passageiros ({selectedPax.length} selecionados)</div>
              {allCrew.map(m => {
                const sel = selectedPax.includes(m.id);
                return (
                  <div key={m.id} onClick={() => togglePax(m.id)} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:8, cursor:'pointer', background: sel?'var(--green-dim)':'transparent', border:`1px solid ${sel?'var(--green-mid)':'transparent'}`, marginBottom:4 }}>
                    <div style={{ width:16, height:16, borderRadius:4, border:`2px solid ${sel?'var(--green)':'var(--border2)'}`, background:sel?'var(--green)':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      {sel && <span style={{ fontSize:9, color:'#fff' }}>✓</span>}
                    </div>
                    <div style={{ flex:1, fontSize:12 }}>{m.full_name}</div>
                    <div style={{ fontSize:10, color:'var(--text3)', fontFamily:'var(--font-mono)' }}>{m.passport || '—'}</div>
                    <div style={{ fontSize:10, color:'var(--text3)' }}>{m.nationality || ''}</div>
                  </div>
                );
              })}
              {allCrew.length===0 && <div style={{ fontSize:12, color:'var(--text3)', padding:'8px 0' }}>Nenhum passageiro cadastrado no PAX DB</div>}
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <button className="primary" onClick={generate} style={{ flex:1, padding:'12px' }}>
                🖨 Gerar e Imprimir GD
              </button>
              <button onClick={onClose}>Fechar</button>
            </div>
            {generated && <div style={{ marginTop:8, fontSize:11, color:'var(--green)', textAlign:'center' }}>GD gerada! Use Cmd+P (Mac) ou Ctrl+P para salvar como PDF.</div>}
          </div>
        )}
      </div>
    </div>
  );
}
