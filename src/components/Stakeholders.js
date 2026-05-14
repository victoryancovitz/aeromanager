import React, { useState, useEffect, useCallback } from 'react';
import {
  getAircraft,
  listStakeholders, saveStakeholder, removeStakeholder,
  listInvites, inviteStakeholder, revokeInvite,
} from '../store';

const ROLE_LABELS = {
  owner:      { label: 'Dono',           desc: 'Aprova orçamentos, decide tudo' },
  co_owner:   { label: 'Cosócio',        desc: 'Equity stake, vê tudo, aprova com dono' },
  manager:    { label: 'Gestor',         desc: 'Monta orçamento, despacha voos, gere fornecedores' },
  pilot:      { label: 'Piloto',         desc: 'Registra voos, envia despesas, sem dados financeiros completos' },
  mechanic:   { label: 'Mecânico',       desc: 'Manutenção e equipamentos, sem voos/finanças' },
  cabin_crew: { label: 'Comissário',     desc: 'Bordo & catering, sem dados sensíveis' },
  viewer:     { label: 'Apenas leitura', desc: 'Vê dashboards, não edita nada' },
};

const ROLE_COLORS = {
  owner:      '#3dbf8a',
  co_owner:   '#4d9de0',
  manager:    '#9b7fe8',
  pilot:      '#e8a84a',
  mechanic:   '#e87b4a',
  cabin_crew: '#e84ad3',
  viewer:     '#888',
};

const DEFAULT_INVITE = { email: '', display_name: '', role: 'viewer', message: '', expires_in_days: 14 };

export default function Stakeholders({ onClose }) {
  const [aircraftList, setAircraftList] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [stakeholders, setStakeholders] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState(DEFAULT_INVITE);
  const [saving, setSaving] = useState(false);
  const [copiedToken, setCopiedToken] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getAircraft().then(list => {
      if (cancelled) return;
      setAircraftList(list || []);
      setSelectedId(prev => prev || (list && list[0]?.id) || '');
    }).catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, []);

  const reload = useCallback(async () => {
    if (!selectedId) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const [s, i] = await Promise.all([
        listStakeholders(selectedId),
        listInvites(selectedId),
      ]);
      setStakeholders(s);
      setInvites(i);
    } catch(e) {
      setError(e.message);
    }
    setLoading(false);
  }, [selectedId]);

  useEffect(() => { reload(); }, [reload]);

  async function submitInvite(e) {
    e.preventDefault();
    setError('');
    if (!inviteForm.email.trim() || !inviteForm.display_name.trim()) {
      setError('Nome e e-mail são obrigatórios.');
      return;
    }
    setSaving(true);
    try {
      await inviteStakeholder({
        aircraftId: selectedId,
        email: inviteForm.email.trim(),
        displayName: inviteForm.display_name.trim(),
        role: inviteForm.role,
        message: inviteForm.message.trim() || null,
        expiresInDays: parseInt(inviteForm.expires_in_days) || 14,
      });
      setInviteForm(DEFAULT_INVITE);
      setShowInvite(false);
      await reload();
    } catch(err) { setError(err.message); }
    setSaving(false);
  }

  async function handleRevoke(id, email) {
    if (!window.confirm(`Revogar convite para ${email}?`)) return;
    try { await revokeInvite(id); await reload(); }
    catch(e) { setError(e.message); }
  }

  async function handleRemove(s) {
    if (!window.confirm(`Remover ${s.displayName} (${ROLE_LABELS[s.role]?.label || s.role}) da aeronave? O histórico é preservado.`)) return;
    try { await removeStakeholder(s.id); await reload(); }
    catch(e) { setError(e.message); }
  }

  function copyInviteLink(token) {
    const url = `${window.location.origin}/?invite=${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    });
  }

  const pendingInvites = invites.filter(i => !i.accepted_at && !i.revoked_at && new Date(i.expires_at) > new Date());
  const expiredOrRevoked = invites.filter(i => i.revoked_at || (new Date(i.expires_at) < new Date() && !i.accepted_at));

  return (
    <div className="page">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
        <h1 style={{ margin:0 }}>Equipe & Acesso</h1>
        {onClose && <button onClick={onClose} style={{ fontSize:12 }}>← Voltar</button>}
      </div>

      <div className="card" style={{ padding:'14px 18px', marginBottom:16 }}>
        <div style={{ fontSize:12, color:'var(--text3)', marginBottom:8 }}>
          Quem tem acesso a esta aeronave e com qual papel. Papéis controlam o que cada pessoa pode ver e fazer
          (orçamento, voos, manutenção, despesas). Donos aprovam orçamentos; gestores montam; pilotos/mecânicos têm visibilidade restrita à sua área.
        </div>
        <label style={{ fontSize:11, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.06em' }}>Aeronave</label>
        <select value={selectedId} onChange={e => setSelectedId(e.target.value)} style={{ width:'100%', marginTop:4 }}>
          {aircraftList.length === 0 && <option value="">Nenhuma aeronave cadastrada</option>}
          {aircraftList.map(a => (
            <option key={a.id} value={a.id}>
              {a.registration || a.id} — {a.manufacturer || ''} {a.model || ''}
              {a._shared ? ' (compartilhada)' : ''}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div style={{ padding:'10px 14px', marginBottom:14, background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.3)', borderRadius:6, color:'var(--red)', fontSize:12 }}>
          {error}
        </div>
      )}

      {!selectedId ? (
        <div className="card" style={{ padding:30, textAlign:'center', color:'var(--text3)' }}>
          Cadastre uma aeronave antes de gerenciar a equipe.
        </div>
      ) : loading ? (
        <div className="card" style={{ padding:20, color:'var(--text3)' }}>Carregando…</div>
      ) : (
        <>
          {/* Stakeholders ativos */}
          <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <div className="section-title" style={{ margin:0 }}>
                Pessoas com acesso <span style={{ color:'var(--text3)', fontWeight:400, fontSize:12, marginLeft:8 }}>({stakeholders.length})</span>
              </div>
              {!showInvite && (
                <button type="button" className="primary" style={{ fontSize:12 }} onClick={() => setShowInvite(true)}>
                  + Convidar pessoa
                </button>
              )}
            </div>

            {stakeholders.length === 0 ? (
              <div style={{ padding:'30px 0', textAlign:'center', color:'var(--text3)', fontSize:13 }}>
                <div style={{ fontSize:28, marginBottom:6 }}>👥</div>
                Ninguém com acesso ainda. Comece convidando o dono ou um gestor.
              </div>
            ) : (
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ background:'var(--bg2)' }}>
                    {['Nome','E-mail','Papel','Equity','Entrou em',''].map(h => (
                      <th key={h} style={{ padding:'7px 10px', textAlign:'left', fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.06em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stakeholders.map(s => (
                    <tr key={s.id} style={{ borderBottom:'1px solid var(--border)' }}>
                      <td style={{ padding:'8px 10px', fontWeight:500 }}>{s.displayName}</td>
                      <td style={{ padding:'8px 10px', color:'var(--text2)' }}>{s.email || '—'}</td>
                      <td style={{ padding:'8px 10px' }}>
                        <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:10, background: ROLE_COLORS[s.role]+'22', color: ROLE_COLORS[s.role], fontSize:11, fontWeight:600 }}>
                          {ROLE_LABELS[s.role]?.label || s.role}
                        </span>
                      </td>
                      <td style={{ padding:'8px 10px', fontFamily:'var(--font-mono)', color:'var(--blue)' }}>
                        {s.sharePct != null ? parseFloat(s.sharePct).toFixed(2)+'%' : '—'}
                      </td>
                      <td style={{ padding:'8px 10px', color:'var(--text3)', fontFamily:'var(--font-mono)', fontSize:11 }}>{s.joinedAt || '—'}</td>
                      <td style={{ padding:'8px 10px', textAlign:'right' }}>
                        <button className="danger" style={{ fontSize:11, padding:'3px 8px' }} onClick={() => handleRemove(s)}>Remover</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {showInvite && (
              <form onSubmit={submitInvite} style={{ marginTop:14, padding:14, background:'var(--bg0)', border:'1px solid var(--blue)', borderRadius:8 }}>
                <div className="section-title" style={{ color:'var(--blue)', marginBottom:10 }}>Novo convite</div>
                <div className="g3" style={{ marginBottom:10 }}>
                  <div>
                    <label>Nome *</label>
                    <input required value={inviteForm.display_name} onChange={e=>setInviteForm(f=>({...f, display_name:e.target.value}))} placeholder="Nome completo" />
                  </div>
                  <div>
                    <label>E-mail *</label>
                    <input type="email" required value={inviteForm.email} onChange={e=>setInviteForm(f=>({...f, email:e.target.value}))} placeholder="email@exemplo.com" />
                  </div>
                  <div>
                    <label>Papel</label>
                    <select value={inviteForm.role} onChange={e=>setInviteForm(f=>({...f, role:e.target.value}))}>
                      {Object.entries(ROLE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                    <div style={{ fontSize:10, color:'var(--text3)', marginTop:3 }}>{ROLE_LABELS[inviteForm.role]?.desc}</div>
                  </div>
                </div>
                <div className="g3" style={{ marginBottom:10 }}>
                  <div>
                    <label>Expira em (dias)</label>
                    <input type="number" min="1" max="90" value={inviteForm.expires_in_days} onChange={e=>setInviteForm(f=>({...f, expires_in_days:e.target.value}))} />
                  </div>
                  <div style={{ gridColumn:'span 2' }}>
                    <label>Mensagem (opcional)</label>
                    <input value={inviteForm.message} onChange={e=>setInviteForm(f=>({...f, message:e.target.value}))} placeholder="Boas-vindas ao time…" />
                  </div>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button type="submit" className="primary" disabled={saving} style={{ fontSize:12 }}>{saving?'Enviando…':'Gerar convite'}</button>
                  <button type="button" onClick={() => { setShowInvite(false); setInviteForm(DEFAULT_INVITE); setError(''); }} style={{ fontSize:12 }}>Cancelar</button>
                </div>
                <div style={{ fontSize:10, color:'var(--text3)', marginTop:8 }}>
                  💡 O convite gera um link mágico que aparecerá abaixo. Você pode compartilhar manualmente (envio automático por e-mail vem na próxima fase).
                </div>
              </form>
            )}
          </div>

          {/* Pending invites */}
          {pendingInvites.length > 0 && (
            <div className="card" style={{ padding:'16px 20px', marginBottom:14 }}>
              <div className="section-title" style={{ marginBottom:10 }}>
                Convites pendentes <span style={{ color:'var(--text3)', fontWeight:400, fontSize:12, marginLeft:8 }}>({pendingInvites.length})</span>
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ background:'var(--bg2)' }}>
                    {['E-mail','Papel','Expira','Link',''].map(h => (
                      <th key={h} style={{ padding:'7px 10px', textAlign:'left', fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.06em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pendingInvites.map(inv => (
                    <tr key={inv.id} style={{ borderBottom:'1px solid var(--border)' }}>
                      <td style={{ padding:'8px 10px' }}>
                        <div style={{ fontWeight:500 }}>{inv.display_name || inv.email}</div>
                        <div style={{ fontSize:11, color:'var(--text3)' }}>{inv.email}</div>
                      </td>
                      <td style={{ padding:'8px 10px' }}>
                        <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:10, background: ROLE_COLORS[inv.role]+'22', color: ROLE_COLORS[inv.role], fontSize:11, fontWeight:600 }}>
                          {ROLE_LABELS[inv.role]?.label || inv.role}
                        </span>
                      </td>
                      <td style={{ padding:'8px 10px', color:'var(--text3)', fontFamily:'var(--font-mono)', fontSize:11 }}>{inv.expires_at?.slice(0,10)}</td>
                      <td style={{ padding:'8px 10px' }}>
                        <button onClick={() => copyInviteLink(inv.token)} style={{ fontSize:11, padding:'3px 8px' }}>
                          {copiedToken === inv.token ? '✓ Copiado' : '📋 Copiar link'}
                        </button>
                      </td>
                      <td style={{ padding:'8px 10px', textAlign:'right' }}>
                        <button className="danger" style={{ fontSize:11, padding:'3px 8px' }} onClick={() => handleRevoke(inv.id, inv.email)}>Revogar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Histórico (revoked/expired) */}
          {expiredOrRevoked.length > 0 && (
            <div className="card" style={{ padding:'16px 20px', marginBottom:14, opacity:.7 }}>
              <div className="section-title" style={{ marginBottom:10, fontSize:11 }}>
                Convites expirados ou revogados <span style={{ color:'var(--text3)', fontWeight:400, fontSize:11, marginLeft:8 }}>({expiredOrRevoked.length})</span>
              </div>
              <div style={{ fontSize:11, color:'var(--text3)' }}>
                {expiredOrRevoked.map(i => `${i.email} (${ROLE_LABELS[i.role]?.label || i.role})`).join(' · ')}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
