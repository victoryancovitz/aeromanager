import React, { useState, useRef, useEffect } from 'react';
import { getAircraft, getFlights, getCosts, getMaintenance, getSettings, saveSettings } from '../store';

const SUGGESTIONS = [
  'Qual o meu custo real por hora este mês?',
  'Qual aeronave é mais econômica para voar?',
  'Analise minha manutenção pendente',
  'Quanto devo reservar por hora para o motor?',
  'Quais voos tiveram o maior custo?',
  'Como está minha reserva de TBO?',
  'Me dê um resumo financeiro do mês',
  'Qual o custo por nm das minhas rotas?',
];

async function buildContext() {
  const aircraft = await getAircraft();
  const flights = (await getFlights()).slice(-30);
  const costs = (await getCosts()).slice(-50);
  const maint = await getMaintenance();

  const acSummary = aircraft.map(a => {
    const acFlights = flights.filter(f => f.aircraftId === a.id);
    const acCosts = costs.filter(c => c.aircraftId === a.id);
    const totalCost = acCosts.reduce((s, c) => s + parseFloat(c.amountBrl || 0), 0);
    const totalHours = acFlights.reduce((s, f) => s + (f.flightTimeMinutes || 0), 0) / 60;
    const cph = totalHours > 0 ? (totalCost / totalHours).toFixed(0) : '—';
    return `${a.registration} (${a.manufacturer} ${a.model}, ${a.type === 'single_engine' ? 'monomotor' : a.type === 'multi_engine' ? 'bimotor' : 'experimental'}): ${totalHours.toFixed(1)}h voadas, R$${cph}/h, motor ${a.totalEngineHours}h (TBO ${a.engineTboHours}h)`;
  }).join('\n');

  const flightSummary = flights.map(f => {
    const a = aircraft.find(x => x.id === f.aircraftId);
    const h = Math.floor((f.flightTimeMinutes || 0) / 60);
    const m = (f.flightTimeMinutes || 0) % 60;
    return `${f.date} ${a?.registration || '?'}: ${f.departureIcao}→${f.destinationIcao} ${h}h${m.toString().padStart(2,'0')} ${f.fuelAddedLiters ? f.fuelAddedLiters+'L comb.' : ''}`;
  }).join('\n');

  const costsByCategory = {};
  costs.forEach(c => { costsByCategory[c.category] = (costsByCategory[c.category] || 0) + parseFloat(c.amountBrl || 0); });
  const costSummary = Object.entries(costsByCategory).map(([k, v]) => `${k}: R$${Math.round(v)}`).join(', ');

  const maintSummary = maint.map(m => {
    const a = aircraft.find(x => x.id === m.aircraftId);
    return `${a?.registration || '?'} — ${m.name}: ${m.status}${m.nextDueHours ? ` (vence ${m.nextDueHours}h)` : ''}${m.nextDueDate ? ` (vence ${m.nextDueDate})` : ''}`;
  }).join('\n');

  return `Você é o CoPiloto IA do AeroManager, assistente especializado em gestão de aeronaves privadas para pilotos proprietários brasileiros. Responda sempre em português brasileiro, de forma direta e prática. Use dados reais do usuário para dar respostas concretas.

AERONAVES DO USUÁRIO:
${acSummary || 'Nenhuma aeronave cadastrada'}

ÚLTIMOS VOOS (${flights.length} registros):
${flightSummary || 'Nenhum voo registrado'}

CUSTOS POR CATEGORIA:
${costSummary || 'Nenhum custo lançado'}

MANUTENÇÃO:
${maintSummary || 'Nenhum item cadastrado'}

Regras importantes:
- Use sempre R$ para valores monetários
- Refira-se ao usuário como "você" ou "piloto"
- Seja objetivo: máximo 3 parágrafos curtos ou use listas com marcadores
- Se não tiver dados suficientes, diga o que falta cadastrar
- Para cálculos de TBO: custo_overhaul ÷ horas_restantes = reserva por hora
- Você pode sugerir ações concretas (ex: "cadastre o custo de hangar mensalmente")`;
}

export default function AIAgent({ onClose }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Olá! Sou o **CoPiloto IA** do AeroManager. Tenho acesso a todos os seus dados de voos, custos e manutenção. Como posso ajudar?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [history, setHistory] = useState([]);
  const bottomRef = useRef();

  useEffect(() => {
    getSettings().then(s => setApiKey(s?.apiKey || '')).catch(()=>{});
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const [serverKeyAvailable, setServerKeyAvailable] = useState(null); // null=checking, true/false

  // Check if server has ANTHROPIC_API_KEY configured
  useEffect(() => {
    fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] }),
    })
      .then(r => r.json())
      .then(d => setServerKeyAvailable(!d.error?.type?.includes('auth')))
      .catch(() => setServerKeyAvailable(false));
  }, []);

  async function saveKey() {
    const s = await getSettings();
    await saveSettings({ ...s, apiKey });
    setShowKeyInput(false);
  }

  async function send(text) {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput('');

    const userMsg = { role: 'user', content: msg };
    setMessages(m => [...m, userMsg]);
    const newHistory = [...history, { role: 'user', content: msg }];
    setLoading(true);

    try {
      // Se não tem chave do servidor nem do usuário, pede configuração
      if (!serverKeyAvailable && !apiKey) {
        setMessages(m => [...m, { role: 'assistant', content: '⚠️ Configure sua chave da API Anthropic clicando no ícone 🔑 acima. Obtenha sua chave em **console.anthropic.com**.' }]);
        setLoading(false);
        return;
      }

      const headers = {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      };
      // Só envia a chave no header se o usuário configurou manualmente
      if (apiKey) headers['x-api-key'] = apiKey;

      const res = await fetch('/api/claude', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          system: await buildContext(),
          messages: newHistory,
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
      const reply = data.content?.map(b => b.text || '').join('') || 'Não foi possível obter resposta.';
      setHistory([...newHistory, { role: 'assistant', content: reply }]);
      setMessages(m => [...m, { role: 'assistant', content: reply }]);
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', content: `Erro: ${e.message}` }]);
    }
    setLoading(false);
  }

  function renderMarkdown(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/s, '<ul style="padding-left:16px;margin:8px 0">$1</ul>')
      .replace(/\n/g, '<br/>');
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: 20, zIndex: 1000 }}>
      <div style={{ width: 420, height: 600, background: '#161920', border: '1px solid #3d4560', borderRadius: 16, display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,.6)', animation: 'slideUp .2s ease' }}>

        {/* Header */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #2e3448', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#4a9eff22', border: '1px solid #4a9eff44', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#4a9eff"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>CoPiloto IA</div>
            <div style={{ fontSize: 10, color: serverKeyAvailable ? '#3dbf8a' : apiKey ? '#3dbf8a' : '#e8a84a', marginTop:1 }}>
              {serverKeyAvailable === null ? 'Verificando...' : serverKeyAvailable ? '● Conectado' : apiKey ? '● Chave configurada' : '● Chave não configurada'}
            </div>
          </div>
          <button className="ghost" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => setShowKeyInput(v => !v)} title="Configurar API Key">🔑</button>
          <button className="ghost" style={{ padding: '4px 8px' }} onClick={onClose}>✕</button>
        </div>

        {/* API Key input */}
        {showKeyInput && (
          <div style={{ padding: '10px 16px', background: '#1e2230', borderBottom: '1px solid #2e3448' }}>
            {serverKeyAvailable ? (
              <div style={{ fontSize: 11, color: '#3dbf8a', padding: '6px 0' }}>
                ✓ Chave da API configurada no servidor pelo administrador. O CoPiloto está funcionando.
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 11, color: '#9aa0b8', marginBottom: 8, lineHeight: 1.5 }}>
                  Insira sua chave da API Anthropic. Obtenha em{' '}
                  <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" style={{ color: '#4a9eff' }}>console.anthropic.com</a>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="password" placeholder="sk-ant-api03-..." value={apiKey} onChange={e => setApiKey(e.target.value)} style={{ fontSize: 12, padding: '6px 10px', flex: 1 }} />
                  <button className="primary" style={{ padding: '6px 12px', fontSize: 11, whiteSpace: 'nowrap' }} onClick={saveKey}>Salvar</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '88%', padding: '10px 13px', borderRadius: m.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                background: m.role === 'user' ? '#4a9eff' : '#1e2230',
                border: m.role === 'user' ? 'none' : '1px solid #2e3448',
                color: m.role === 'user' ? '#fff' : '#e8eaf0',
                fontSize: 13, lineHeight: 1.55,
              }} dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ padding: '10px 14px', background: '#1e2230', border: '1px solid #2e3448', borderRadius: '12px 12px 12px 4px', fontSize: 13 }}>
                <span style={{ animation: 'pulse 1s infinite' }}>Analisando seus dados...</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Suggestions */}
        {messages.length <= 1 && (
          <div style={{ padding: '8px 16px', display: 'flex', gap: 6, flexWrap: 'wrap', borderTop: '1px solid #2e3448' }}>
            {SUGGESTIONS.slice(0, 4).map(s => (
              <button key={s} onClick={() => send(s)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, background: '#1e2230', border: '1px solid #2e3448', color: '#9aa0b8' }}>{s}</button>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #2e3448', display: 'flex', gap: 8 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Pergunte sobre seus voos, custos, manutenção..."
            style={{ fontSize: 13, padding: '8px 12px' }}
            disabled={loading}
          />
          <button className="primary" onClick={() => send()} disabled={loading || !input.trim()} style={{ padding: '8px 14px', flexShrink: 0 }}>
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}
