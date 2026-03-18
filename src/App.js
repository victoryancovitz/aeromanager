import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { onAuthChange, signOut, getAircraft, getFlights, getCosts, getMaintenance, getMissions, getCrewMembers, getCrewDocuments } from './store';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './components/Login';
import MigrationBanner from './components/MigrationBanner';
import Dashboard from './components/Dashboard';
import AIAgent from './components/AIAgent';
import SeedDataBanner from './components/SeedDataBanner';
import NotificationBell from './components/NotificationBell';
import AircraftDetail from './components/AircraftDetail';
import UserProfile from './components/UserProfile';
import './index.css';

const Aircraft     = React.lazy(() => import('./components/Aircraft'));
const Flights      = React.lazy(() => import('./components/Flights'));
const Costs        = React.lazy(() => import('./components/Costs'));
const Maintenance  = React.lazy(() => import('./components/Maintenance'));
const CostIndex    = React.lazy(() => import('./components/CostIndex'));
const Integrations = React.lazy(() => import('./components/Integrations'));
const FuelPrices   = React.lazy(() => import('./components/FuelPrices'));
const Missions     = React.lazy(() => import('./components/Missions'));
const FlightTracker= React.lazy(() => import('./components/FlightTracker'));
const OilTracking  = React.lazy(() => import('./components/OilTracking'));
const MaintenanceTimeline = React.lazy(() => import('./components/MaintenanceTimeline'));
const POHImporter  = React.lazy(() => import('./components/POHImporter'));
const ReceiptScanner = React.lazy(() => import('./components/ReceiptScanner'));
const CrewModule   = React.lazy(() => import('./components/CrewModule'));
const GeneralDeclaration = React.lazy(() => import('./components/GeneralDeclaration'));
const FBOModule    = React.lazy(() => import('./components/FBOModule'));
const DataPortability = React.lazy(() => import('./components/DataPortability'));
const Logbook         = React.lazy(() => import('./components/Logbook'));
const CIV             = React.lazy(() => import('./components/CIV'));
const ComponentMap    = React.lazy(() => import('./components/ComponentMap'));
const AirportManager  = React.lazy(() => import('./components/AirportManager'));
const EngineEvents    = React.lazy(() => import('./components/EngineEvents'));
const CostCategories  = React.lazy(() => import('./components/CostCategories'));
const FlightMap       = React.lazy(() => import('./components/FlightMap'));
const AircraftPricing = React.lazy(() => import('./components/AircraftPricing'));
const RangeCalculator = React.lazy(() => import('./components/RangeCalculator'));
const FlightJourney       = React.lazy(() => import('./components/FlightJourney'));
const AircraftDocuments   = React.lazy(() => import('./components/AircraftDocuments'));
const AircraftOnboarding  = React.lazy(() => import('./components/AircraftOnboarding'));
const CostSplitting       = React.lazy(() => import('./components/CostSplitting'));
const CreditLedger        = React.lazy(() => import('./components/CreditLedger'));
const DocumentImportWizard = React.lazy(() => import('./components/DocumentImportWizard'));
const EmailTemplates       = React.lazy(() => import('./components/EmailTemplates'));
const CustomAlerts         = React.lazy(() => import('./components/CustomAlerts'));

const NAV = [
  // ── 1. GESTÃO DA AERONAVE ─────────────────────────────────────────────────
  { section: 'Gestão da Aeronave' },
  { id:'dashboard',    label:'Dashboard',              icon:'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z' },
  { id:'aircraft',     label:'Aeronaves',              icon:'M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z' },
  { id:'maintenance',  label:'Manutenção & MX',        icon:'M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z' },
  { id:'components',   label:'Mapa de Componentes',    icon:'M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z' },
  { id:'engineevents', label:'Histórico de Motor',     icon:'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z' },
  { id:'performance',  label:'Performance',            icon:'M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15l-5-2.18L7 18V5h10v13z' },
  { id:'cost_split',   label:'Rateio entre sócios',    icon:'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z' },
  { id:'costs',        label:'Custos Fixos',           icon:'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z' },
  { id:'aircraft_docs', label:'Documentos da Aeronave',  icon:'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z' },

  // ── 2. VOOS (hub da jornada) ──────────────────────────────────────────────
  { section: 'Voos' },
  { id:'journey',      label:'Todos os Voos',          icon:'M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z', highlight: true },
  { id:'tracker', advanced: true,      label:'Voo no Bolso (GPS)',     icon:'M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0013 3.06V1h-2v2.06A8.994 8.994 0 003.06 11H1v2h2.06A8.994 8.994 0 0011 20.94V23h2v-2.06A8.994 8.994 0 0020.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z' },
  { id:'missions',     label:'Missões & GD',           icon:'M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z' },
  { id:'flights',      label:'Registro de Voos',       icon:'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  { id:'flightmap', advanced: true,    label:'Mapa de Voos',           icon:'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z' },
  { id:'logbook', advanced: true,      label:'Diário de Bordo ANAC',   icon:'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z' },
  { id:'civ', advanced: true,          label:'CIV — Caderneta Indiv.', icon:'M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v1h20v-1c0-3.3-6.7-5-10-5z' },
  { id:'range', advanced: true,        label:'Alcance & Combustível',  icon:'M21 3L3 10.53v.98l6.84 2.65L12.48 21h.98L21 3z' },
  { id:'costindex', advanced: true,    label:'Cost Index',             icon:'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z' },
  { id:'fbo', advanced: true,          label:'FBO & Cotações',         icon:'M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z' },
  { id:'airports', advanced: true,     label:'Aeroportos & Taxas',     icon:'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z' },
  { id:'fuelprices', advanced: true,   label:'Preços Combustível',     icon:'M19.77 7.23l.01-.01-3.72-3.72L15 4.56l2.11 2.11c-.94.36-1.61 1.26-1.61 2.33 0 1.38 1.12 2.5 2.5 2.5.36 0 .69-.08 1-.21v7.21c0 .55-.45 1-1 1s-1-.45-1-1V14c0-1.1-.9-2-2-2h-1V5c0-1.1-.9-2-2-2H6c-1.1 0-2 .9-2 2v16h10v-7.5h1.5v5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V9c0-.69-.28-1.32-.73-1.77zM18 10c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zM8 18v-4.5H6L10 6v5h2L8 18z' },

  // ── 4. CONFIGURAÇÕES & CADASTROS ──────────────────────────────────────────
  { section: 'Configurações & Cadastros' },
  { id:'aircraftdb', advanced: true,   label:'Base de Aeronaves',      icon:'M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12zM5 10h9v2H5zm0-3h9v2H5zm0 6h6v2H5zm10 0l4-4-4-4v3h-2v2h2z' },
  { id:'email_templates', label:'Templates de E-mail',    icon:'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z' },
  { id:'custom_alerts',   label:'Alertas Personalizados', icon:'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z' },
  { id:'crew',         label:'Tripulação & Docs',      icon:'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z' },
  { id:'costcategories', advanced: true, label:'Categorias de Custo',  icon:'M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16z' },
  { id:'pricing', advanced: true,      label:'Precificação',           icon:'M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z' },
  { id:'benchmark', advanced: true,    label:'Benchmark Conklin',      icon:'M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z' },
  { id:'data', advanced: true,         label:'Exportar / Integrações', icon:'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z' },
];

const THEME_ICONS = { dark:'🌙', light:'☀️', system:'💻' };

// Tooltip simples com ? para termos técnicos
export function Tip({ text, children }) {
  const [show, setShow] = React.useState(false);
  return (
    <span style={{ position:'relative', display:'inline-flex', alignItems:'center', gap:3 }}>
      {children}
      <span
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:14, height:14, borderRadius:'50%', background:'var(--bg3)', border:'1px solid var(--border)', fontSize:9, color:'var(--text3)', cursor:'help', flexShrink:0, fontWeight:600 }}>
        ?
      </span>
      {show && (
        <span style={{ position:'absolute', bottom:'calc(100% + 6px)', left:'50%', transform:'translateX(-50%)', background:'var(--bg0)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 12px', fontSize:11, color:'var(--text1)', whiteSpace:'pre-wrap', maxWidth:260, zIndex:9999, boxShadow:'0 4px 20px rgba(0,0,0,.3)', lineHeight:1.5 }}>
          {text}
          <span style={{ position:'absolute', top:'100%', left:'50%', transform:'translateX(-50%)', width:0, height:0, borderLeft:'5px solid transparent', borderRight:'5px solid transparent', borderTop:'5px solid var(--border)' }} />
        </span>
      )}
    </span>
  );
}

// Tint sutil por seção — mantém identidade visual do app
const SECTION_TINTS = {
  'Gestão da Aeronave':        { tint:'rgba(77,157,224,0.03)',  accent:'var(--blue)' },
  'Planejamento & Despacho':   { tint:'rgba(232,168,74,0.03)',  accent:'var(--amber)' },
  'Acompanhamento de Voo':     { tint:'rgba(61,191,138,0.03)',  accent:'var(--green)' },
  'Configurações & Cadastros': { tint:'rgba(155,127,232,0.03)', accent:'var(--purple)' },
};

function getSectionForPage(pid) {
  let cur = null;
  for (const item of NAV) {
    if (item.section) cur = item.section;
    else if (item.id === pid) return cur;
  }
  return null;
}

export default function App() {
  const [user, setUser]         = useState(undefined);
  const [page, setPage]         = useState('dashboard');
  const [aircraft, setAircraft] = useState([]);
  const [flights, setFlights]   = useState([]);
  const [costs, setCosts]       = useState([]);
  const [maintenance, setMaint] = useState([]);
  const [missions, setMissions] = useState([]);
  const [crew, setCrew]         = useState([]);
  const [crewDocs, setCrewDocs] = useState([]);
  const [selectedAc, setSelectedAc]   = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showAI, setShowAI]     = useState(false);
  const [showPOH, setShowPOH]   = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [globalAcFilter, setGlobalAcFilter] = useState('all'); // 'all' | aircraft.id
  const [showDocImport, setShowDocImport] = useState(false);
  const [showGD, setShowGD]     = useState(false);
  const [preselFlight, setPreselFlight] = useState(null);
  const [dataLoading, setDataLoading]   = useState(false);
  const [collapsed, setCollapsed]       = useState(() => localStorage.getItem('am_sidebar') === '1');
  const [openSections, setOpenSections]  = useState(() => {
    const saved = localStorage.getItem('am_page') || 'dashboard';
    const activeSection = getSectionForPage(saved);
    return new Set(activeSection ? [activeSection] : ['Gestão da Aeronave']);
  });
  const [theme, setTheme]               = useState(() => localStorage.getItem('am_theme') || 'dark');

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('am_theme', theme);
  }, [theme]);

  function cycleTheme() {
    setTheme(t => t === 'dark' ? 'light' : t === 'light' ? 'system' : 'dark');
  }

  function toggleSidebar() {
    setCollapsed(v => {
      const next = !v;
      localStorage.setItem('am_sidebar', next ? '1' : '0');
      return next;
    });
  }

  useEffect(() => {
    const { data: { subscription } } = onAuthChange(u => setUser(u));
    return () => subscription.unsubscribe();
  }, []);

  const reload = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);
    try {
      const [ac, fl, co, ma, mi] = await Promise.all([
        getAircraft(), getFlights(), getCosts(), getMaintenance(), getMissions()
      ]);
      setAircraft(ac); setFlights(fl); setCosts(co); setMaint(ma); setMissions(mi);
      // Load crew silently (non-blocking)
      getCrewMembers().then(members => {
        setCrew(members || []);
        Promise.all((members||[]).map(m => getCrewDocuments(m.id))).then(allDocs => {
          setCrewDocs(allDocs.flat());
        }).catch(() => {});
      }).catch(() => {});
    } catch(e) { console.error('Reload error:', e); }
    setDataLoading(false);
  }, [user]);

  useEffect(() => { if (user) reload(); }, [user, reload]);

  // ── Realtime sync ─────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    // Debounce — evita múltiplos reloads quando várias linhas mudam ao mesmo tempo
    let timer = null;
    function debouncedReload() {
      clearTimeout(timer);
      timer = setTimeout(() => reload(), 400);
    }

    const channel = supabase
      .channel(`aeromanager:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'aircraft',    filter: `user_id=eq.${user.id}` }, debouncedReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'flights',     filter: `user_id=eq.${user.id}` }, debouncedReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'costs',       filter: `user_id=eq.${user.id}` }, debouncedReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance', filter: `user_id=eq.${user.id}` }, debouncedReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'missions',    filter: `user_id=eq.${user.id}` }, debouncedReload)
      .subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [user, reload]);

  // Filtered data based on global aircraft selector
  const filteredFlights  = globalAcFilter === 'all' ? flights     : flights.filter(f => f.aircraftId === globalAcFilter);
  const filteredCosts    = globalAcFilter === 'all' ? costs       : costs.filter(c => c.aircraftId === globalAcFilter);
  const filteredMaint    = globalAcFilter === 'all' ? maintenance : maintenance.filter(m => m.aircraftId === globalAcFilter);
  const filteredAircraft = globalAcFilter === 'all' ? aircraft    : aircraft.filter(a => a.id === globalAcFilter);

  // Auto-open onboarding for new users with no aircraft
  useEffect(() => {
    if (user && !dataLoading && aircraft.length === 0) {
      if (!localStorage.getItem('am_onboarding_dismissed')) {
        setShowOnboarding(true);
      }
    }
  }, [user, dataLoading, aircraft.length]);

  if (user === undefined) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg0)' }}>
      <div style={{ textAlign:'center', color:'var(--text3)' }}>
        <div style={{ fontSize:32, marginBottom:12 }}>✈</div>
        <div style={{ fontSize:13 }}>Carregando...</div>
      </div>
    </div>
  );

  if (!user) return <Login />;

  const alerts = maintenance.filter(m => m.status === 'due_soon' || m.status === 'overdue').length;
  const sidebarW = collapsed ? 54 : 210;

  function go(p, data) {
    if (data) setPreselFlight(data);
    setSelectedAc(null);
    setPage(p);
    const sec = getSectionForPage(p);
    if (sec) setOpenSections(prev => { const next = new Set(prev); next.add(sec); return next; });
  }

  return (
    <div style={{ display:'flex', minHeight:'100vh' }}>
      {/* Sidebar */}
      <aside style={{ width:sidebarW, background:'var(--bg1)', borderRight:`1px solid var(--border)`, display:'flex', flexDirection:'column', flexShrink:0, position:'sticky', top:0, height:'100vh', overflowY:'auto', overflowX:'hidden', transition:'width .2s ease' }}>

        {/* Logo */}
        <div style={{ padding: collapsed ? '14px 10px' : '14px 14px', borderBottom:`1px solid var(--border)`, display:'flex', alignItems:'center', gap:10, justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <div style={{ width:32, height:32, borderRadius:8, background:'var(--blue)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>
          </div>
          {!collapsed && (
            <div className="logo-text">
              <div style={{ fontFamily:'var(--font-serif)', fontWeight:400, fontSize:17, color:'var(--text1)', letterSpacing:'.02em' }}>AeroManager</div>
              <div style={{ fontSize:9.5, color:'var(--text3)', fontWeight:500, letterSpacing:'.1em', textTransform:'uppercase', marginTop:1 }}>v5.38</div>
            </div>
          )}
        </div>

        {/* Nav — accordion by section */}
        <nav style={{ flex:1, padding: collapsed ? '8px 4px' : '8px', overflowY:'auto' }}>
          {(() => {
            const elements = [];
            let currentSection = null;
            let sectionItems = [];

            const flushSection = () => {
              if (!currentSection) return;
              const isOpen = openSections.has(currentSection);
              const tint = SECTION_TINTS[currentSection];
              const activeSec = getSectionForPage(page) === currentSection;

              if (collapsed) {
                // Collapsed: just icons, no section headers
                sectionItems.forEach(item => {
                  const active = page === item.id;
                  elements.push(
                    <button key={item.id} title={item.label} onClick={() => go(item.id)}
                      style={{ display:'flex', alignItems:'center', justifyContent:'center', width:'100%', padding:'7px', borderRadius:7, border:'none', cursor:'pointer', marginBottom:1, transition:'all .12s', position:'relative',
                        background: active ? 'var(--blue-dim)' : 'transparent',
                        color: active ? 'var(--blue)' : item.highlight ? 'var(--green)' : 'var(--text3)' }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d={item.icon}/></svg>
                      {item.id==='maintenance' && alerts > 0 && <div style={{ position:'absolute', width:6, height:6, borderRadius:'50%', background:'var(--red)', top:4, right:4 }} />}
                    </button>
                  );
                });
              } else {
                // Section header button — capture section name to avoid closure bug
                const sectionName = currentSection;
                elements.push(
                  <button key={`sec-${sectionName}`}
                    onClick={() => setOpenSections(prev => { const n = new Set(prev); n.has(sectionName) ? n.delete(sectionName) : n.add(sectionName); return n; })}
                    style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%', padding:'8px 10px 7px', borderRadius:8, border:'none', cursor:'pointer', marginBottom:2, marginTop:4, transition:'all .15s',
                      background: activeSec ? (tint?.tint?.replace('0.03','0.07') || 'transparent') : 'transparent',
                      color: activeSec ? tint?.accent?.replace('var(--','').replace(')','').split('-')[0] === 'blue' ? 'var(--blue)' : tint?.accent?.includes('amber') ? 'var(--amber)' : tint?.accent?.includes('green') ? 'var(--green)' : 'var(--purple)' : 'var(--text3)' }}>
                    <span style={{ fontSize:9, fontWeight:600, textTransform:'uppercase', letterSpacing:'.1em' }}>{currentSection}</span>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"
                      style={{ flexShrink:0, transition:'transform .2s', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                      <path d="M10 17l5-5-5-5v10z"/>
                    </svg>
                  </button>
                );
                // Section items (animated height via maxHeight)
                if (isOpen) {
                  const mainItems = sectionItems.filter(i => !i.advanced);
                  const advItems  = sectionItems.filter(i => i.advanced);
                  const advKey    = `adv-open-${sectionName}`;
                  const advOpen   = openSections.has(advKey);

                  mainItems.forEach(item => {
                    const active = page === item.id;
                    elements.push(
                      <button key={item.id} title={item.label} onClick={() => go(item.id)}
                        style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:'6px 10px 6px 14px', borderRadius:7, border:'none', justifyContent:'flex-start', fontSize:11.5, fontWeight:500, cursor:'pointer', marginBottom:1, transition:'all .12s',
                          background: active ? 'var(--bg3)' : 'transparent',
                          color: active ? 'var(--text1)' : item.highlight ? 'var(--green)' : 'var(--text2)',
                          borderLeft: active ? `2px solid ${tint?.accent || 'var(--blue)'}` : '2px solid transparent' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink:0, opacity: active ? 1 : 0.6 }}><path d={item.icon}/></svg>
                        <span style={{ flex:1 }}>{item.label}</span>
                        {item.id==='maintenance' && alerts > 0 && <span style={{ background:'var(--red)', color:'#fff', borderRadius:10, fontSize:9, padding:'1px 5px', fontWeight:700 }}>{alerts}</span>}
                      </button>
                    );
                  });

                  if (advItems.length > 0) {
                    // "Avançado" toggle
                    elements.push(
                      <button key={advKey}
                        onClick={() => setOpenSections(prev => { const n = new Set(prev); n.has(advKey) ? n.delete(advKey) : n.add(advKey); return n; })}
                        style={{ display:'flex', alignItems:'center', gap:6, width:'100%', padding:'4px 10px 4px 14px', borderRadius:6, border:'none', cursor:'pointer', marginBottom:1, marginTop:2, background:'transparent', color:'var(--text3)' }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{ transition:'transform .2s', transform: advOpen ? 'rotate(90deg)' : 'rotate(0)' }}><path d="M10 17l5-5-5-5v10z"/></svg>
                        <span style={{ fontSize:9.5, fontWeight:500, letterSpacing:'.05em' }}>Avançado</span>
                      </button>
                    );
                    if (advOpen) {
                      advItems.forEach(item => {
                        const active = page === item.id;
                        elements.push(
                          <button key={item.id} title={item.label} onClick={() => go(item.id)}
                            style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:'5px 10px 5px 22px', borderRadius:7, border:'none', justifyContent:'flex-start', fontSize:11, fontWeight:400, cursor:'pointer', marginBottom:1, transition:'all .12s',
                              background: active ? 'var(--bg3)' : 'transparent',
                              color: active ? 'var(--text1)' : 'var(--text3)',
                              borderLeft: active ? `2px solid ${tint?.accent || 'var(--blue)'}` : '2px solid transparent', opacity: active ? 1 : 0.8 }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink:0 }}><path d={item.icon}/></svg>
                            <span style={{ flex:1 }}>{item.label}</span>
                          </button>
                        );
                      });
                    }
                  }
                }
              }
              currentSection = null;
              sectionItems = [];
            };

            NAV.forEach((item, i) => {
              if (item.section) {
                flushSection();
                currentSection = item.section;
              } else {
                sectionItems.push(item);
              }
            });
            flushSection();
            return elements;
          })()}
        </nav>

        {/* Bottom */}
        <div className="bottom-section" style={{ padding: collapsed ? '8px 4px' : '8px', borderTop:`1px solid var(--border)` }}>
          {!collapsed && (
            <div className="bottom-email" style={{ fontSize:10, color:'var(--text3)', padding:'4px 10px', marginBottom:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {user.email}
            </div>
          )}

          {/* CoPiloto */}
          <button title={collapsed ? 'CoPiloto IA' : ''} onClick={() => setShowAI(true)}
            style={{ width:'100%', padding: collapsed ? '9px' : '9px', borderRadius:10, border:`1px solid var(--blue-dim)`, background:'var(--blue-dim)', color:'var(--blue)', fontWeight:600, fontSize:11, cursor:'pointer', display:'flex', alignItems:'center', gap: collapsed ? 0 : 8, justifyContent: collapsed ? 'center' : 'flex-start', marginBottom:6, transition:'all .15s' }}>
            <div style={{ width:18, height:18, borderRadius:5, background:'var(--blue)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
            </div>
            {!collapsed && 'CoPiloto IA'}
          </button>

          {/* Perfil */}
          <button title={collapsed ? 'Perfil' : ''} onClick={() => setShowProfile(true)}
            style={{ width:'100%', padding: collapsed ? '8px' : '7px 10px', borderRadius:8, border:`1px solid var(--border)`, background:'transparent', color:'var(--text2)', fontSize:11, cursor:'pointer', display:'flex', alignItems:'center', gap: collapsed ? 0 : 8, justifyContent: collapsed ? 'center' : 'flex-start', marginBottom:6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v1h20v-1c0-3.3-6.7-5-10-5z"/></svg>
            {!collapsed && <span style={{ flex:1 }}>Perfil</span>}
          </button>

          {/* Theme */}
          <button title={`Tema: ${theme}`} onClick={cycleTheme}
            style={{ width:'100%', padding: collapsed ? '8px' : '7px 10px', borderRadius:8, border:`1px solid var(--border)`, background:'transparent', color:'var(--text2)', fontSize:11, cursor:'pointer', display:'flex', alignItems:'center', gap: collapsed ? 0 : 8, justifyContent: collapsed ? 'center' : 'flex-start', marginBottom:6 }}>
            <span style={{ fontSize:14 }}>{THEME_ICONS[theme]}</span>
            {!collapsed && <span style={{ flex:1 }}>Tema: {theme === 'dark' ? 'Escuro' : theme === 'light' ? 'Claro' : 'Sistema'}</span>}
          </button>

          {/* Sign out */}
          <button title={collapsed ? 'Sair' : ''} onClick={signOut}
            style={{ width:'100%', padding: collapsed ? '8px' : '7px 10px', borderRadius:8, border:`1px solid var(--border)`, background:'transparent', color:'var(--text3)', fontSize:11, cursor:'pointer', display:'flex', alignItems:'center', gap: collapsed ? 0 : 8, justifyContent: collapsed ? 'center' : 'flex-start' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>
            {!collapsed && 'Sair'}
          </button>
        </div>

        {/* Collapse toggle */}
        <button onClick={toggleSidebar} title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          style={{ position:'absolute', top:'50%', right:-12, transform:'translateY(-50%)', width:24, height:24, borderRadius:'50%', border:`1px solid var(--border)`, background:'var(--bg1)', color:'var(--text3)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, padding:0, zIndex:10, transition:'all .2s' }}>
          {collapsed ? '›' : '‹'}
        </button>
      </aside>

      {/* Main */}
      <main style={{ flex:1, minWidth:0, overflowY:'auto', transition:'background .35s ease',
        background: (() => { const s = getSectionForPage(page); const t = SECTION_TINTS[s]; return t ? `color-mix(in srgb, var(--bg0) 97%, ${t.tint.includes('77,157') ? '#4d9de0' : t.tint.includes('232,168') ? '#e8a84a' : t.tint.includes('61,191') ? '#3dbf8a' : '#9b7fe8'} 3%)` : 'var(--bg0)'; })() }}>
        {/* Topbar with notifications */}
        <div style={{ display:'flex', justifyContent:'flex-end', alignItems:'center', padding:'8px 16px 0', gap:4 }}>
          <NotificationBell maintenance={maintenance} aircraft={aircraft} crew={crew} documents={crewDocs} setPage={page => { setPage(page); }} />
        </div>
        <MigrationBanner onDone={reload} />
        {/* Global aircraft filter — visible when there are 2+ aircraft */}
        {aircraft.length > 1 && (
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 24px 0', flexWrap:'wrap' }}>
            <span style={{ fontSize:11, color:'var(--text3)', fontWeight:500, textTransform:'uppercase', letterSpacing:'.06em' }}>Aeronave:</span>
            <button onClick={() => { setGlobalAcFilter('all'); setSelectedAc(null); }}
              style={{ padding:'4px 12px', borderRadius:20, border:`1px solid ${globalAcFilter==='all'?'var(--blue)':'var(--border)'}`, background:globalAcFilter==='all'?'var(--blue-dim)':'transparent', color:globalAcFilter==='all'?'var(--blue)':'var(--text3)', fontSize:11, cursor:'pointer', fontWeight:globalAcFilter==='all'?600:400 }}>
              Todas ({aircraft.length})
            </button>
            {aircraft.map(ac => (
              <button key={ac.id} onClick={() => { setGlobalAcFilter(ac.id); setSelectedAc(ac); }}
                style={{ padding:'4px 12px', borderRadius:20, border:`1px solid ${globalAcFilter===ac.id?'var(--blue)':'var(--border)'}`, background:globalAcFilter===ac.id?'var(--blue-dim)':'transparent', color:globalAcFilter===ac.id?'var(--blue)':'var(--text3)', fontSize:11, cursor:'pointer', fontWeight:globalAcFilter===ac.id?600:400, fontFamily:'var(--font-mono)' }}>
                {ac.registration}
              </button>
            ))}
          </div>
        )}
        {user && user.email === 'victor_by@hotmail.com' && <SeedDataBanner onDone={reload} onStartOnboarding={() => setShowOnboarding(true)} />}
        {dataLoading && (
          <div style={{ padding:'6px 24px', fontSize:11, color:'var(--text3)', borderBottom:`1px solid var(--border)` }}>
            Sincronizando...
          </div>
        )}

        {/* UserProfile overlay */}
        {showProfile && (
          <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'40px 16px', overflowY:'auto' }}>
            <div style={{ background:'var(--bg1)', borderRadius:16, minWidth:400, maxWidth:580, width:'100%', boxShadow:'0 20px 60px rgba(0,0,0,.4)' }}>
              <UserProfile onClose={() => setShowProfile(false)} />
            </div>
          </div>
        )}

        <React.Suspense fallback={<div style={{ padding:40, color:'var(--text3)', textAlign:'center', fontSize:13 }}>Carregando...</div>}>
          <ErrorBoundary key={page}>
          {/* Aircraft detail overlay */}
          {selectedAc ? (
            <AircraftDetail
              ac={selectedAc}
              flights={filteredFlights}
              costs={costs}
              maintenance={maintenance}
              crew={crew}
              onBack={() => setSelectedAc(null)}
              setPage={p => { setSelectedAc(null); setPage(p); }}
              onViewDocs={() => { setPage('aircraft_docs'); }}
            />
          ) : (
            <>
          {page==='crew'          && <CrewModule flights={flights} onGenerateGD={() => setShowGD(true)} />}
          {page==='fbo'           && <FBOModule aircraft={filteredAircraft} />}
          {page==='data'          && <DataPortability onDone={reload} />}
          {page==='logbook'       && <Logbook onClose={() => go('flights')} />}
          {page==='civ'           && <CIV onClose={() => go('flights')} />}
          {page==='components'    && <ComponentMap aircraft={filteredAircraft} reload={reload} />}
          {page==='airports'      && <AirportManager />}
          {page==='engineevents'  && <EngineEvents aircraft={filteredAircraft} />}
          {page==='costcategories'&& <CostCategories onClose={() => go('costs')} />}
          {page==='flightmap'     && <FlightMap flights={filteredFlights} aircraft={filteredAircraft} crew={crew} />}
          {page==='journey'       && <FlightJourney aircraft={filteredAircraft} reload={reload} setPage={go} />}
          {page==='aircraft_docs' && <AircraftDocuments aircraft={(globalAcFilter !== 'all' ? filteredAircraft[0] : null) || selectedAc || aircraft[0]} onClose={() => go('aircraft')} onImportBatch={() => setShowDocImport(true)} />}
          {page==='cost_split'   && <CostSplitting aircraft={(globalAcFilter !== 'all' ? filteredAircraft[0] : null) || selectedAc || aircraft[0]} />}
          {page==='credit_ledger' && <CreditLedger aircraft={(globalAcFilter !== 'all' ? filteredAircraft[0] : null) || selectedAc || aircraft[0]} allAircraft={filteredAircraft} />}
          {page==='email_templates' && <EmailTemplates onClose={() => go('dashboard')} />}
          {page==='custom_alerts'   && <CustomAlerts   onClose={() => go('dashboard')} />}
          {page==='tracker'       && <FlightTracker reload={reload} setPage={setPage} />}
          {page==='dashboard'     && <Dashboard aircraft={filteredAircraft} flights={filteredFlights} costs={filteredCosts} maintenance={filteredMaint} setPage={go} onAircraftClick={ac => { setSelectedAc(ac); setGlobalAcFilter(ac.id); }} />}
          {page==='aircraft'      && <Aircraft aircraft={aircraft} reload={reload} onImportPOH={() => setShowPOH(true)} onNewAircraft={() => setShowOnboarding(true)} />}
          {page==='missions'      && <Missions aircraft={filteredAircraft} reload={reload} onGenerateGD={() => setShowGD(true)} />}
          {page==='flights'       && <Flights flights={filteredFlights} aircraft={filteredAircraft} costs={filteredCosts} reload={reload} setPage={go} setPreselFlight={setPreselFlight} />}
          {page==='costs'         && <Costs costs={filteredCosts} aircraft={filteredAircraft} flights={filteredFlights} reload={reload} preselFlight={preselFlight} onScanReceipt={() => setShowReceipt(true)} />}
          {page==='flightcosts'   && <Costs costs={filteredCosts} aircraft={filteredAircraft} flights={filteredFlights} reload={reload} preselFlight={preselFlight} onScanReceipt={() => setShowReceipt(true)} initialFilter="flight" />}
          {page==='maintenance'   && <Maintenance maintenance={filteredMaint} aircraft={filteredAircraft} reload={reload} />}
          {page==='mxtimeline'    && <Maintenance maintenance={filteredMaint} aircraft={filteredAircraft} flights={filteredFlights} reload={reload} initialTab="timeline" />}
          {page==='oil'           && <Maintenance maintenance={filteredMaint} aircraft={filteredAircraft} flights={filteredFlights} reload={reload} initialTab="oil" />}
          {page==='costindex'     && <CostIndex aircraft={filteredAircraft} />}
          {page==='pricing'       && <AircraftPricing aircraft={filteredAircraft} />}
          {page==='range'         && <RangeCalculator aircraft={filteredAircraft} />}
          {page==='integrations'  && <Integrations reload={reload} />}
          {page==='fuelprices'    && <FuelPrices aircraft={filteredAircraft} />}
          {page==='performance'   && <div style={{padding:'40px 32px',color:'var(--text3)',textAlign:'center'}}><div style={{fontSize:40,marginBottom:16}}>📊</div><div style={{fontFamily:'var(--font-serif)',fontSize:20,marginBottom:8}}>Performance</div><div style={{fontSize:13}}>Em construção — tabelas POH por aeronave.<br/>Importe um POH para começar.</div><button className="primary" style={{marginTop:20}} onClick={()=>setShowPOH(true)}>Importar POH</button></div>}
          {page==='benchmark'     && <div style={{padding:'40px 32px',color:'var(--text3)',textAlign:'center'}}><div style={{fontSize:40,marginBottom:16}}>📈</div><div style={{fontFamily:'var(--font-serif)',fontSize:20,marginBottom:8}}>Benchmark Conklin & de Decker</div><div style={{fontSize:13}}>Em construção — custo real vs. média de mercado por tipo de aeronave.</div></div>}
          </>)}
          </ErrorBoundary>
        </React.Suspense>
      </main>

      {showAI && <AIAgent onClose={() => setShowAI(false)} />}
      {showGD && (
        <React.Suspense fallback={null}>
          <GeneralDeclaration aircraft={aircraft} onClose={() => setShowGD(false)} />
        </React.Suspense>
      )}
      {showPOH && (
        <React.Suspense fallback={null}>
          <POHImporter onClose={() => { setShowPOH(false); reload(); }} />
        </React.Suspense>
      )}
      {showDocImport && selectedAc && (
        <React.Suspense fallback={null}>
          <DocumentImportWizard
            aircraft={selectedAc}
            onClose={() => setShowDocImport(false)}
            onComplete={() => { setShowDocImport(false); reload(); }}
          />
        </React.Suspense>
      )}
      {showOnboarding && (
        <React.Suspense fallback={null}>
          <AircraftOnboarding
            onClose={() => { setShowOnboarding(false); localStorage.setItem('am_onboarding_dismissed','1'); reload(); }}
            onComplete={() => { setShowOnboarding(false); localStorage.setItem('am_onboarding_dismissed','1'); reload(); go('dashboard'); }}
          />
        </React.Suspense>
      )}
      {showReceipt && (
        <React.Suspense fallback={null}>
          <ReceiptScanner onClose={() => setShowReceipt(false)} onSaved={() => { reload(); }} />
        </React.Suspense>
      )}
    </div>
  );
}
