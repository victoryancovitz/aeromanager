import React, { useState } from 'react';
import { saveAircraft } from '../store';

const STEPS = [
  { id: 'welcome',  label: 'Boas-vindas' },
  { id: 'aircraft', label: 'Aeronave'    },
  { id: 'fleet',    label: 'Frota'       },
  { id: 'members',  label: 'Membros'     },
  { id: 'tour',     label: 'Tour'        },
];

const PROFILES = [
  { id: 'owner_pilot',      icon: '🧑‍✈️', label: 'Proprietário-piloto',       desc: 'Sou o único dono e voo eu mesmo.' },
  { id: 'co_owner',         icon: '🤝',          label: 'Co-proprietário (condomínio)', desc: 'Compartilho a aeronave com sócios.' },
  { id: 'owner_hired',      icon: '👔',          label: 'Proprietário com piloto',    desc: 'Sou dono, mas o piloto é contratado.' },
  { id: 'managed',          icon: '🏢',          label: 'Gerenciada por empresa',     desc: 'Uma empresa opera por mim.' },
  { id: 'authorized_pilot', icon: '🛫',          label: 'Piloto autorizado',          desc: 'Não sou dono — tenho permissão para voar.' },
];

const TOUR_ITEMS = [
  { icon: '✈',  label: 'Aeronaves',       desc: 'Cadastre prefixo, motor, hélice e horários.' },
  { icon: '🛫', label: 'Todos os Voos',   desc: 'Registro completo de cada voo com custo/hora.' },
  { icon: '🔧', label: 'Manutenção & MX', desc: 'Plano de MX gerado automaticamente pela IA.' },
  { icon: '💰', label: 'Custos Fixos',    desc: 'Hangar, seguro e anuidades no automático.' },
  { icon: '⚖️', label: 'Rateio',          desc: 'Divida custos entre sócios com um clique.' },
  { icon: '🤖', label: 'CoPiloto IA',     desc: 'Pergunte qualquer coisa sobre sua frota.' },
];

const EMPTY_AC = {
  registration: '', manufacturer: '', model: '', year: '',
  type: 'single_engine', engineModel: '', engineTboHours: 2000,
  fuelType: 'avgas_100ll', homeBase: '',
};

export default function OnboardingWizard({ onClose, onComplete }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [profile, setProfile] = useState(null);
  const [ac, setAc] = useState(EMPTY_AC);
  const [addMore, setAddMore] = useState(null);
  const [members, setMembers] = useState([{ name: '', email: '', role: 'owner' }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const step = STEPS[stepIdx];
  const isLast = stepIdx === STEPS.length - 1;

  function setF(k, v) { setAc(a => ({ ...a, [k]: v })); }

  function canAdvance() {
    if (step.id === 'welcome')  return !!profile;
    if (step.id === 'aircraft') return !!ac.registration && !!ac.manufacturer && !!ac.model;
    return true;
  }

  async function advance() {
    if (!canAdvance()) return;
    if (step.id === 'aircraft') {
      setSaving(true); setError('');
      try {
        await saveAircraft({
          registration: ac.registration,
          type: ac.type,
          manufacturer: ac.manufacturer,
          model: ac.model,
          year: parseInt(ac.year) || null,
          engineModel: ac.engineModel || null,
          engineTboHours: parseFloat(ac.engineTboHours) || 2000,
          fuelType: ac.fuelType,
          homeBase: ac.homeBase || null,
          isActive: true,
        });
      } catch (e) { setError(e.message); setSaving(false); return; }
      setSaving(false);
    }
    if (isLast) { onComplete?.(); return; }
    setStepIdx(i => i + 1);
  }

  function skip() {
    if (isLast) { onComplete?.(); return; }
    setStepIdx(i => i + 1);
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1200,
      background: 'rgba(0,0,0,0.72)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px',
    }}>
      <button onClick={onClose} style={{
        position: 'absolute', top: 16, right: 20,
        background: 'none', border: 'none',
        color: 'rgba(255,255,255,.5)', fontSize: 22, cursor: 'pointer', lineHeight: 1,
      }}>✕</button>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {STEPS.map((s, i) => (
          <div key={s.id} style={{
            height: 4, borderRadius: 2,
            width: i === stepIdx ? 28 : 16,
            background: i < stepIdx ? '#1D9E75' : i === stepIdx ? '#378ADD' : 'rgba(255,255,255,.25)',
            transition: 'all .3s',
          }} />
        ))}
      </div>

      <div style={{
        background: 'var(--bg1)', border: '1px solid var(--border)',
        borderRadius: 20, width: '100%', maxWidth: 480,
        padding: '28px 28px 22px', maxHeight: '80vh', overflowY: 'auto',
      }}>

        {step.id === 'welcome' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 44, marginBottom: 10 }}>✈</div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, marginBottom: 6 }}>Bem-vindo ao AeroManager</div>
              <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.6 }}>
                Vamos configurar sua conta em 5 passos.<br />Qual é a sua relação com a aeronave?
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {PROFILES.map(p => (
                <button key={p.id} onClick={() => setProfile(p.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '12px 16px', borderRadius: 12,
                  border: `1.5px solid ${profile === p.id ? 'var(--blue)' : 'var(--border)'}`,
                  background: profile === p.id ? 'var(--blue-dim)' : 'var(--bg2)',
                  cursor: 'pointer', textAlign: 'left', transition: 'all .12s',
                }}>
                  <span style={{ fontSize: 22, flexShrink: 0 }}>{p.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: profile === p.id ? 'var(--blue)' : 'var(--text1)', marginBottom: 2 }}>{p.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{p.desc}</div>
                  </div>
                  {profile === p.id && <span style={{ color: 'var(--blue)', fontSize: 16 }}>✓</span>}
                </button>
              ))}
            </div>
          </>
        )}

        {step.id === 'aircraft' && (
          <>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 19, marginBottom: 4 }}>Sua primeira aeronave</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>Dados básicos — você completa o resto depois.</div>
            </div>
            {error && (
              <div style={{ marginBottom: 12, padding: '9px 14px', background: 'var(--red-dim)', border: '1px solid var(--red-mid)', borderRadius: 8, fontSize: 12, color: 'var(--red)' }}>{error}</div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Prefixo *</label>
                <input value={ac.registration} onChange={e => setF('registration', e.target.value.toUpperCase())} placeholder="PP-ABC" autoFocus
                  style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 18, letterSpacing: 3, width: '100%', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Fabricante *</label>
                <input value={ac.manufacturer} onChange={e => setF('manufacturer', e.target.value)} placeholder="Cessna, Piper..." style={{ width: '100%', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Modelo *</label>
                <input value={ac.model} onChange={e => setF('model', e.target.value)} placeholder="172S, PA-28..." style={{ width: '100%', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Ano</label>
                <input type="number" value={ac.year} onChange={e => setF('year', e.target.value)} placeholder="2019" style={{ width: '100%', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Base (ICAO)</label>
                <input value={ac.homeBase} onChange={e => setF('homeBase', e.target.value.toUpperCase())} placeholder="SBMT" maxLength={4}
                  style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'var(--font-mono)' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Tipo</label>
                <select value={ac.type} onChange={e => setF('type', e.target.value)} style={{ width: '100%', boxSizing: 'border-box' }}>
                  <option value="single_engine">Monomotor</option>
                  <option value="multi_engine">Bimotor</option>
                  <option value="turboprop">Turboélice</option>
                  <option value="jet">Jato</option>
                  <option value="helicopter">Helicóptero</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Combustível</label>
                <select value={ac.fuelType} onChange={e => setF('fuelType', e.target.value)} style={{ width: '100%', boxSizing: 'border-box' }}>
                  <option value="avgas_100ll">Avgas 100LL</option>
                  <option value="jet_a1">Jet A-1</option>
                </select>
              </div>
            </div>
          </>
        )}

        {step.id === 'fleet' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🛩</div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 19, marginBottom: 6 }}>Tem mais aeronaves?</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>Você pode cadastrar várias e filtrar tudo por prefixo.</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { v: 'yes', label: 'Sim, tenho mais aeronaves',   desc: 'Cadastro agora ou depois em Aeronaves.' },
                { v: 'no',  label: 'Não, só tenho uma por agora', desc: 'Posso adicionar mais a qualquer momento.' },
              ].map(opt => (
                <button key={opt.v} onClick={() => setAddMore(opt.v)} style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 12,
                  border: `1.5px solid ${addMore === opt.v ? 'var(--blue)' : 'var(--border)'}`,
                  background: addMore === opt.v ? 'var(--blue-dim)' : 'var(--bg2)',
                  cursor: 'pointer', textAlign: 'left', transition: 'all .12s',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: addMore === opt.v ? 'var(--blue)' : 'var(--text1)', marginBottom: 2 }}>{opt.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{opt.desc}</div>
                  </div>
                  {addMore === opt.v && <span style={{ color: 'var(--blue)', fontSize: 16, flexShrink: 0 }}>✓</span>}
                </button>
              ))}
            </div>
            {addMore === 'yes' && (
              <div style={{ marginTop: 14, padding: '11px 14px', background: 'var(--blue-dim)', border: '1px solid var(--blue-mid)', borderRadius: 9, fontSize: 12, color: 'var(--blue)' }}>
                ✓ Após o wizard, vá em <strong>Aeronaves → + Nova aeronave</strong>.
              </div>
            )}
          </>
        )}

        {step.id === 'members' && (
          <>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 19, marginBottom: 4 }}>Convidar membros ou sócios</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>Opcional — pode pular e convidar depois.</div>
            </div>
            {members.map((m, i) => (
              <div key={i} style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--border)', marginBottom: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text3)', display: 'block', marginBottom: 3 }}>Nome</label>
                    <input value={m.name} onChange={e => setMembers(ms => ms.map((x,j) => j===i ? {...x, name: e.target.value} : x))}
                      placeholder="Nome completo" style={{ width: '100%', boxSizing: 'border-box', fontSize: 12 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text3)', display: 'block', marginBottom: 3 }}>E-mail</label>
                    <input type="email" value={m.email} onChange={e => setMembers(ms => ms.map((x,j) => j===i ? {...x, email: e.target.value} : x))}
                      placeholder="email@exemplo.com" style={{ width: '100%', boxSizing: 'border-box', fontSize: 12 }} />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 10, color: 'var(--text3)', display: 'block', marginBottom: 3 }}>Papel</label>
                    <select value={m.role} onChange={e => setMembers(ms => ms.map((x,j) => j===i ? {...x, role: e.target.value} : x))} style={{ width: '100%', fontSize: 12 }}>
                      <option value="owner">Co-proprietário</option>
                      <option value="pilot">Piloto autorizado</option>
                      <option value="manager">Gerenciador</option>
                      <option value="viewer">Somente leitura</option>
                    </select>
                  </div>
                  {members.length > 1 && (
                    <button onClick={() => setMembers(ms => ms.filter((_,j) => j!==i))}
                      style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 18, alignSelf: 'flex-end', paddingBottom: 2 }}>×</button>
                  )}
                </div>
              </div>
            ))}
            <button onClick={() => setMembers(ms => [...ms, { name: '', email: '', role: 'owner' }])}
              style={{ background: 'none', border: '1px dashed var(--border)', borderRadius: 9, width: '100%', padding: '9px', fontSize: 12, color: 'var(--text3)', cursor: 'pointer', marginTop: 2 }}>
              + Adicionar membro
            </button>
            <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--amber-dim)', border: '1px solid var(--amber-mid)', borderRadius: 8, fontSize: 11, color: 'var(--amber)' }}>
              ⚠ Convites por e-mail chegam na v6.x — dados ficam registrados.
            </div>
          </>
        )}

        {step.id === 'tour' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 22 }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🎉</div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, marginBottom: 6 }}>Tudo pronto!</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
                {ac.registration ? `${ac.registration} está cadastrada.` : 'Conta configurada.'} O que você pode fazer agora:
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
              {TOUR_ITEMS.map(item => (
                <div key={item.label} style={{ padding: '12px 14px', borderRadius: 11, background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 20, marginBottom: 6 }}>{item.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text1)', marginBottom: 3 }}>{item.label}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text3)', lineHeight: 1.5 }}>{item.desc}</div>
                </div>
              ))}
            </div>
          </>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <button onClick={skip} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--text3)', cursor: 'pointer' }}>
            {isLast ? '' : 'Pular etapa'}
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {stepIdx > 0 && (
              <button onClick={() => setStepIdx(i => i - 1)}
                style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}>
                ← Voltar
              </button>
            )}
            <button onClick={advance} disabled={!canAdvance() || saving} style={{
              padding: '9px 24px', borderRadius: 9, border: 'none',
              background: canAdvance() && !saving ? '#378ADD' : 'var(--bg3)',
              color: canAdvance() && !saving ? '#fff' : 'var(--text3)',
              fontSize: 13, fontWeight: 600,
              cursor: canAdvance() && !saving ? 'pointer' : 'default',
              transition: 'all .15s',
            }}>
              {saving ? 'Salvando...' : isLast ? 'Ir para o Dashboard →' : 'Continuar →'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14, fontSize: 11, color: 'rgba(255,255,255,.4)', letterSpacing: '.08em' }}>
        ETAPA {stepIdx + 1} DE {STEPS.length} — {STEPS[stepIdx].label.toUpperCase()}
      </div>
    </div>
  );
}
