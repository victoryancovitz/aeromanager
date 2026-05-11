// FlightDocuments.js — General Declaration (GenDec) PDF + CBP eAPIS checklist
// Gera PDF do voo via jsPDF e valida documentos para entrada nos EUA.
import React, { useState, useEffect, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import { supabase } from '../supabase';

const ROLE_SHORT = {
  pic: 'PIC', sic: 'SIC',
  flight_attendant: 'F/A', mechanic: 'MX',
  passenger: 'PAX', other: 'CREW',
};

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T12:00:00');
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d - new Date()) / 86400000);
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d + 'T12:00:00').toLocaleDateString('en-GB').replace(/\//g, '-');
}

function isUsAirport(icao) {
  if (!icao) return false;
  const u = icao.toUpperCase().trim();
  return u.length === 4 && u.startsWith('K');
}

export default function FlightDocuments({ flight, aircraft }) {
  const [crew, setCrew] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (flight?.id) load(); }, [flight?.id]);

  async function load() {
    setLoading(true); setError('');
    try {
      const { data, error: e } = await supabase
        .from('flight_crew')
        .select('*, crew_member:crew_member_id(*)')
        .eq('flight_id', flight.id)
        .order('created_at');
      if (e) throw e;
      setCrew(data || []);
    } catch(e) { setError(e.message); }
    setLoading(false);
  }

  const usBound = isUsAirport(flight?.destinationIcao) || isUsAirport(flight?.departureIcao) || isUsAirport(flight?.alternateIcao);

  const cbpChecks = useMemo(() => crew.map(fc => {
    const m = fc.crew_member;
    const name = m?.full_name || fc.name_adhoc || '—';
    const checks = {
      passport_number: !!m?.passport_number,
      passport_expiry_valid: m?.passport_expiry && (daysUntil(m.passport_expiry) ?? -1) >= 0,
      passport_expiry_6mo: m?.passport_expiry && (daysUntil(m.passport_expiry) ?? -1) >= 180,
      dob: !!m?.dob,
      gender: !!m?.gender,
      nationality: !!m?.nationality,
      us_visa: !!m?.us_visa_number,
      us_visa_valid: m?.us_visa_expiry && (daysUntil(m.us_visa_expiry) ?? -1) >= 0,
    };
    const issues = [];
    if (!checks.passport_number)      issues.push('Sem número de passaporte');
    if (!checks.passport_expiry_valid) issues.push('Passaporte vencido');
    else if (!checks.passport_expiry_6mo) issues.push('Passaporte expira em < 6 meses');
    if (!checks.dob)         issues.push('Sem data de nascimento');
    if (!checks.gender)      issues.push('Sem gênero');
    if (!checks.nationality) issues.push('Sem nacionalidade');
    if (!checks.us_visa)     issues.push('Sem visto US (B1/B2/C1/D conforme aplicável)');
    else if (!checks.us_visa_valid) issues.push('Visto US vencido');
    return { id: fc.id, role: fc.role, name, member: m, adhoc: !m, issues };
  }), [crew]);

  const allCleared = cbpChecks.length > 0 && cbpChecks.every(c => c.issues.length === 0);

  async function generateGenDec() {
    setBusy(true); setError('');
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const W = 210, M = 14;
      let y = M;

      // Title
      doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
      doc.text('GENERAL DECLARATION', W/2, y, { align: 'center' });
      y += 5;
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text('(Outward / Inward) — ICAO Annex 9 Appendix 1', W/2, y, { align: 'center' });
      y += 7;

      // Owner / operator block
      doc.setDrawColor(60); doc.rect(M, y, W - M*2, 22);
      doc.setFontSize(8); doc.setTextColor(80);
      doc.text('OWNER / OPERATOR', M+2, y+4);
      doc.setFontSize(10); doc.setTextColor(0);
      doc.text(aircraft?.operator || 'YANCOVITZ AVIATION', M+2, y+10);
      doc.setFontSize(9); doc.setTextColor(60);
      doc.text(`Aircraft Registration: ${aircraft?.registration || '—'}`, M+2, y+15);
      doc.text(`Type / Model: ${aircraft?.manufacturer || ''} ${aircraft?.model || ''}`.trim() || '—', M+2, y+19);
      y += 26;

      // Flight info two-column
      const colW = (W - M*2) / 2;
      doc.setDrawColor(60); doc.rect(M, y, colW, 32); doc.rect(M+colW, y, colW, 32);
      doc.setFontSize(8); doc.setTextColor(80);
      doc.text('FLIGHT', M+2, y+4); doc.text('ROUTE & TIMES', M+colW+2, y+4);

      const rows = [
        ['Flight No.', aircraft?.registration ? aircraft.registration.replace('-','') : '—'],
        ['Date', fmtDate(flight?.date)],
        ['Departure (ICAO)', flight?.departureIcao || '—'],
        ['Destination (ICAO)', flight?.destinationIcao || '—'],
      ];
      const rows2 = [
        ['Block Out (UTC)', flight?.blockOutTime || flight?.takeoffUtc || '—'],
        ['Takeoff (UTC)',   flight?.takeoffUtc || '—'],
        ['Landing (UTC)',   flight?.landingUtc || '—'],
        ['Block In (UTC)',  flight?.blockInTime || flight?.landingUtc || '—'],
      ];
      doc.setFontSize(9); doc.setTextColor(0);
      rows.forEach((r, i) => {
        doc.setTextColor(110); doc.text(r[0], M+2,  y+10 + i*5.5);
        doc.setTextColor(0);   doc.text(String(r[1]||'—'), M+34, y+10 + i*5.5);
      });
      rows2.forEach((r, i) => {
        doc.setTextColor(110); doc.text(r[0], M+colW+2,  y+10 + i*5.5);
        doc.setTextColor(0);   doc.text(String(r[1]||'—'), M+colW+34, y+10 + i*5.5);
      });
      y += 36;

      // Crew table
      doc.setFontSize(8); doc.setTextColor(80);
      doc.text('CREW & PASSENGERS — Passport details for immigration', M, y); y += 2;
      doc.setDrawColor(60); doc.line(M, y, W - M, y); y += 4;

      // Header
      doc.setFontSize(7.5); doc.setTextColor(80);
      const cols = [
        { x: M,     w: 8,  h: '#' },
        { x: M+8,   w: 12, h: 'Role' },
        { x: M+20,  w: 50, h: 'Full Name' },
        { x: M+70,  w: 16, h: 'Nat.' },
        { x: M+86,  w: 28, h: 'Passport' },
        { x: M+114, w: 18, h: 'Expiry' },
        { x: M+132, w: 18, h: 'DOB' },
        { x: M+150, w: 8,  h: 'M/F' },
        { x: M+158, w: 24, h: 'US Visa' },
      ];
      cols.forEach(c => doc.text(c.h, c.x, y));
      y += 1.5; doc.line(M, y, W - M, y); y += 4;
      doc.setTextColor(0); doc.setFontSize(8);

      if (crew.length === 0) {
        doc.setTextColor(120);
        doc.text('— No crew/passengers registered for this flight —', M, y+2);
        y += 10;
      } else {
        crew.forEach((fc, i) => {
          if (y > 270) { doc.addPage(); y = M; }
          const m = fc.crew_member;
          const name = (m?.full_name || fc.name_adhoc || '—').toUpperCase();
          const r = [
            String(i+1),
            ROLE_SHORT[fc.role] || (fc.role||'').toUpperCase(),
            name.length > 28 ? name.slice(0,28) : name,
            (m?.nationality || '').toUpperCase(),
            m?.passport_number || '—',
            fmtDate(m?.passport_expiry) || '—',
            fmtDate(m?.dob) || '—',
            (m?.gender || '—').toUpperCase().slice(0,1),
            m?.us_visa_number ? `${(m.us_visa_type||'').toUpperCase()} ${fmtDate(m.us_visa_expiry)||''}`.trim() : '—',
          ];
          cols.forEach((c, k) => doc.text(String(r[k] ?? '—'), c.x, y));
          y += 5;
        });
      }

      // Signatures
      y = Math.max(y + 10, 240);
      doc.setDrawColor(60); doc.line(M, y, M+70, y);
      doc.line(W-M-70, y, W-M, y);
      doc.setFontSize(8); doc.setTextColor(80);
      doc.text('PIC Signature (Comandante)', M, y+4);
      doc.text('Authorized Agent / Operator', W-M-70, y+4);

      // Footer
      doc.setFontSize(7); doc.setTextColor(120);
      doc.text(`Generated by AeroManager · ${new Date().toISOString().slice(0,16).replace('T',' ')} UTC`, W/2, 290, { align:'center' });

      const fname = `GenDec_${aircraft?.registration||'AC'}_${flight?.date||''}_${flight?.departureIcao||''}-${flight?.destinationIcao||''}.pdf`;
      doc.save(fname);
    } catch(e) { setError(e.message || 'Falha ao gerar PDF'); }
    setBusy(false);
  }

  return (
    <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, flexWrap:'wrap', gap:10 }}>
        <div className="section-title" style={{ margin:0 }}>
          Documentos do voo
          {usBound && (
            <span style={{ marginLeft:10, fontSize:10, padding:'2px 7px', borderRadius:4, background:'rgba(59,130,246,.1)', border:'1px solid rgba(59,130,246,.4)', color:'var(--blue)', fontWeight:600 }}>
              🇺🇸 Voo com trecho US — eAPIS necessário
            </span>
          )}
        </div>
        <button type="button" onClick={generateGenDec} disabled={busy || loading} className="primary" style={{ fontSize:12 }}>
          {busy ? 'Gerando…' : '📄 General Declaration (PDF)'}
        </button>
      </div>

      {error && (
        <div style={{ padding:'8px 12px', marginBottom:10, background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.3)', borderRadius:6, color:'var(--red)', fontSize:12 }}>{error}</div>
      )}

      {loading ? (
        <div style={{ color:'var(--text3)', fontSize:12, padding:'10px 0' }}>Carregando…</div>
      ) : crew.length === 0 ? (
        <div style={{ color:'var(--text3)', fontSize:12, padding:'12px 0', textAlign:'center' }}>
          Adicione tripulantes e passageiros para gerar a GenDec.
        </div>
      ) : (
        <div style={{ fontSize:11, color:'var(--text3)' }}>
          {crew.length} pessoa(s) — a GenDec será gerada com passaporte, validade, data de nascimento e visto US (quando aplicável).
        </div>
      )}

      {usBound && (
        <div style={{ marginTop:14, padding:'12px 14px', background:'var(--bg1)', border:'1px solid var(--border)', borderRadius:8 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
            <div style={{ fontSize:12, fontWeight:600 }}>
              ✅ Checklist CBP eAPIS
              {!loading && (
                allCleared
                  ? <span style={{ marginLeft:8, fontSize:10, padding:'2px 7px', borderRadius:4, background:'rgba(16,185,129,.12)', border:'1px solid rgba(16,185,129,.4)', color:'var(--green)', fontWeight:600 }}>Tudo OK</span>
                  : crew.length > 0 && <span style={{ marginLeft:8, fontSize:10, padding:'2px 7px', borderRadius:4, background:'rgba(245,166,35,.12)', border:'1px solid rgba(245,166,35,.4)', color:'var(--amber)', fontWeight:600 }}>{cbpChecks.filter(c=>c.issues.length>0).length} pendência(s)</span>
              )}
            </div>
            <a href="https://eapis.cbp.dhs.gov/" target="_blank" rel="noopener noreferrer" style={{ fontSize:11, color:'var(--blue)' }}>Abrir CBP eAPIS ↗</a>
          </div>

          {cbpChecks.length === 0 ? (
            <div style={{ fontSize:11, color:'var(--text3)' }}>Adicione tripulantes/passageiros para validar.</div>
          ) : (
            <div style={{ display:'grid', gap:6 }}>
              {cbpChecks.map(c => (
                <div key={c.id} style={{
                  display:'flex', gap:10, alignItems:'flex-start',
                  padding:'8px 10px', borderRadius:6,
                  background: c.issues.length === 0 ? 'rgba(16,185,129,.05)' : 'rgba(245,166,35,.05)',
                  border: c.issues.length === 0 ? '1px solid rgba(16,185,129,.25)' : '1px solid rgba(245,166,35,.25)',
                }}>
                  <span style={{ fontSize:14, lineHeight:1.2 }}>{c.issues.length === 0 ? '✓' : '⚠'}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:500 }}>
                      {c.name} <span style={{ color:'var(--text3)', fontWeight:400 }}>· {ROLE_SHORT[c.role] || c.role}</span>
                      {c.adhoc && <span style={{ marginLeft:6, fontSize:9, color:'var(--amber)' }}>(ad-hoc — sem ficha)</span>}
                    </div>
                    {c.issues.length > 0 && (
                      <ul style={{ margin:'4px 0 0', padding:'0 0 0 18px', fontSize:11, color:'var(--amber)' }}>
                        {c.issues.map((i, k) => <li key={k}>{i}</li>)}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop:10, fontSize:10, color:'var(--text3)', lineHeight:1.4 }}>
            Lembrete operacional: eAPIS (manifesto) deve ser enviado <strong>≥ 60 min antes</strong> da decolagem para voos entrando ou saindo dos EUA. Tripulação aérea estrangeira normalmente usa <strong>visto C-1/D</strong>; passageiros, B1/B2.
          </div>
        </div>
      )}
    </div>
  );
}
