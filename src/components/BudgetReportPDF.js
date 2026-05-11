// BudgetReportPDF.js — gerador de PDF do relatório de orçamento (followup planejado vs realizado)
import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet, pdf } from '@react-pdf/renderer';

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const CATEGORY_LABELS = {
  scheduled_mx: 'Manutenção',
  crew: 'Pessoal & Tripulação',
  insurance: 'Seguros',
  hangar: 'Hangar & Infra',
  fuel: 'Combustível',
  airport_fees: 'Taxas Aeroportuárias',
  nav_fees: 'Taxas ATC/Nav',
  engine_reserve: 'Reserva de Motor',
  other: 'Outros',
};

const fmtBRL = (v) => `R$ ${(parseFloat(v)||0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtBRLShort = (v) => {
  const n = parseFloat(v)||0;
  if (Math.abs(n) >= 1_000_000) return `R$${(n/1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `R$${(n/1_000).toFixed(0)}k`;
  return `R$${n.toFixed(0)}`;
};

function styles(primary) {
  return StyleSheet.create({
    page: { padding: 36, fontSize: 9, fontFamily: 'Helvetica', color: '#1c1c1c' },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottom: `2px solid ${primary}` },
    logo: { width: 80, height: 'auto', maxHeight: 50, marginRight: 14 },
    headerText: { flex: 1 },
    companyName: { fontSize: 13, fontWeight: 'bold', color: primary },
    companyDetails: { fontSize: 8, color: '#666', marginTop: 2 },
    headerRight: { textAlign: 'right' },
    docTitle: { fontSize: 11, fontWeight: 'bold' },
    docMeta: { fontSize: 8, color: '#666', marginTop: 2 },

    section: { marginBottom: 16 },
    sectionTitle: { fontSize: 11, fontWeight: 'bold', color: primary, marginBottom: 6, paddingBottom: 3, borderBottom: '1pt solid #ddd' },

    kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
    kpiBox: { flex: 1, padding: 8, backgroundColor: '#f7f8fa', borderRadius: 4 },
    kpiLabel: { fontSize: 7, color: '#666', textTransform: 'uppercase', letterSpacing: 0.4 },
    kpiValue: { fontSize: 14, fontWeight: 'bold', marginTop: 3 },
    kpiSub: { fontSize: 7, color: '#888', marginTop: 1 },

    table: { display: 'table', width: 'auto' },
    th: { backgroundColor: '#eef0f4', padding: 4, fontSize: 7, fontWeight: 'bold', color: '#555', textTransform: 'uppercase', borderBottom: '1pt solid #ddd' },
    td: { padding: 4, fontSize: 8, borderBottom: '0.5pt solid #eee' },
    tdMono: { padding: 4, fontSize: 8, fontFamily: 'Courier', borderBottom: '0.5pt solid #eee' },

    alertRow: { flexDirection: 'row', padding: 5, borderRadius: 3, marginBottom: 3, fontSize: 8 },
    alertCritical: { backgroundColor: '#fee2e2' },
    alertWarn: { backgroundColor: '#fef3c7' },

    footer: { position: 'absolute', bottom: 24, left: 36, right: 36, paddingTop: 8, borderTop: '0.5pt solid #ccc', fontSize: 7, color: '#888', flexDirection: 'row', justifyContent: 'space-between' },
    pageNum: { fontSize: 7, color: '#888' },
  });
}

function varianceColor(pct) {
  if (pct === null || pct === undefined) return '#666';
  if (pct <= 0) return '#10b981';
  if (pct <= 10) return '#444';
  if (pct <= 25) return '#f59e0b';
  return '#ef4444';
}

function Header({ s, company, budget, period }) {
  return (
    <View style={s.header}>
      {company.logo_url ? <Image src={company.logo_url} style={s.logo} /> : <View style={s.logo} />}
      <View style={s.headerText}>
        <Text style={s.companyName}>{company.name || 'Sua Empresa'}</Text>
        {(company.cnpj || company.email || company.phone) && (
          <Text style={s.companyDetails}>
            {[company.cnpj && `CNPJ ${company.cnpj}`, company.phone, company.email].filter(Boolean).join(' · ')}
          </Text>
        )}
        {company.address && <Text style={s.companyDetails}>{company.address}</Text>}
      </View>
      <View style={s.headerRight}>
        <Text style={s.docTitle}>Followup de Orçamento</Text>
        <Text style={s.docMeta}>{budget.name}</Text>
        <Text style={s.docMeta}>{period}</Text>
      </View>
    </View>
  );
}

function Footer({ s, company, pageNumber }) {
  return (
    <View style={s.footer} fixed>
      <Text style={{ flex: 1 }}>{company.footer_text || `Gerado pelo AeroManager · ${new Date().toLocaleDateString('pt-BR')}`}</Text>
      <Text style={s.pageNum} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

export function BudgetReportPDF({ company, budget, aircraftLabel, table, monthSums, snapshots, currentMonth }) {
  const primary = company.primary_color || '#4a9eff';
  const s = styles(primary);
  const period = `AF ${budget.fiscalYear} · ${aircraftLabel || 'sem aeronave'}`;
  const totals = table.reduce((acc, r) => ({
    planned: acc.planned + r.plannedTotal,
    actual: acc.actual + r.actualTotal,
  }), { planned:0, actual:0 });
  const ytdActual = monthSums.slice(0, currentMonth).reduce((s, m) => s + m.actual, 0);
  const ytdPlanned = monthSums.slice(0, currentMonth).reduce((s, m) => s + m.planned, 0);
  const yeProjection = currentMonth > 0 ? (ytdActual / currentMonth) * 12 : 0;
  const totalPct = totals.planned > 0 ? ((totals.actual/totals.planned - 1)*100) : null;

  // Alertas
  const alerts = [];
  const monthIdx = Math.max(0, currentMonth - 1);
  for (const row of table) {
    const cur = row.months[monthIdx];
    if (cur && cur.planned > 0 && cur.actual > 0 && cur.pct !== null && cur.pct > 10) {
      alerts.push({ severity: cur.pct > 25 ? 'critical' : 'warning', category: row.category, scope: `${MONTHS[monthIdx]}/mês`, pct: cur.pct, planned: cur.planned, actual: cur.actual });
    }
    const plannedYtd = row.months.slice(0, currentMonth).reduce((s,c)=>s+c.planned,0);
    const actualYtd = row.months.slice(0, currentMonth).reduce((s,c)=>s+c.actual,0);
    if (plannedYtd > 0 && actualYtd > 0) {
      const pctYtd = ((actualYtd/plannedYtd - 1) * 100);
      if (pctYtd > 10) {
        alerts.push({ severity: pctYtd > 25 ? 'critical' : 'warning', category: row.category, scope: 'YTD', pct: pctYtd, planned: plannedYtd, actual: actualYtd });
      }
    }
  }
  alerts.sort((a,b) => (b.severity==='critical'?2:1) - (a.severity==='critical'?2:1) || b.pct - a.pct);

  return (
    <Document
      title={`Followup ${budget.name}`}
      author={company.name || 'AeroManager'}
      subject="Followup de orçamento"
    >
      {/* Página 1: Capa + KPIs + Curva mensal */}
      <Page size="A4" style={s.page}>
        <Header s={s} company={company} budget={budget} period={period} />

        <View style={s.section}>
          <Text style={s.sectionTitle}>Resumo executivo</Text>
          <View style={s.kpiRow}>
            <View style={s.kpiBox}>
              <Text style={s.kpiLabel}>Orçado/ano</Text>
              <Text style={s.kpiValue}>{fmtBRL(totals.planned)}</Text>
              <Text style={s.kpiSub}>Premissa anual</Text>
            </View>
            <View style={s.kpiBox}>
              <Text style={s.kpiLabel}>Realizado YTD</Text>
              <Text style={s.kpiValue}>{fmtBRL(ytdActual)}</Text>
              <Text style={s.kpiSub}>até {MONTHS[currentMonth-1]}</Text>
            </View>
            <View style={s.kpiBox}>
              <Text style={s.kpiLabel}>Projeção YE</Text>
              <Text style={[s.kpiValue, { color: yeProjection > totals.planned*1.05 ? '#ef4444' : (yeProjection < totals.planned*0.95 ? '#10b981' : '#444') }]}>{fmtBRL(yeProjection)}</Text>
              <Text style={s.kpiSub}>vs orçado {fmtBRL(totals.planned)}</Text>
            </View>
            <View style={s.kpiBox}>
              <Text style={s.kpiLabel}>Variação YTD</Text>
              <Text style={[s.kpiValue, { color: varianceColor(totalPct) }]}>{totalPct!==null?`${totalPct>=0?'+':''}${totalPct.toFixed(1)}%`:'—'}</Text>
              <Text style={s.kpiSub}>{totals.actual-totals.planned>=0?'+':''}{fmtBRL(totals.actual - totals.planned)}</Text>
            </View>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Curva mensal acumulada</Text>
          <MonthlyChart s={s} months={monthSums} currentMonth={currentMonth} primary={primary} />
        </View>

        <View style={s.section} wrap={false}>
          <Text style={s.sectionTitle}>Premissas do orçamento</Text>
          <View style={{ flexDirection:'row', gap:14, fontSize:8 }}>
            <Text>Câmbio: <Text style={{ fontWeight:'bold' }}>R$ {budget.fxUsdBrl.toFixed(2)}</Text></Text>
            <Text>Jet-A1: <Text style={{ fontWeight:'bold' }}>USD {budget.fuelUsdGal}/gal</Text></Text>
            <Text>Contingência: <Text style={{ fontWeight:'bold' }}>{(budget.contingencyPct*100).toFixed(1)}%</Text></Text>
            <Text>Horas/ano: <Text style={{ fontWeight:'bold' }}>{budget.hoursYearAssumed}h</Text></Text>
            <Text>Voos/ano: <Text style={{ fontWeight:'bold' }}>{budget.flightsYearAssumed}</Text></Text>
            <Text>Pernoites/ano: <Text style={{ fontWeight:'bold' }}>{budget.overnightsYearAssumed}</Text></Text>
          </View>
        </View>

        {alerts.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Alertas ativos ({alerts.length})</Text>
            {alerts.slice(0, 8).map((a, i) => (
              <View key={i} style={[s.alertRow, a.severity==='critical'?s.alertCritical:s.alertWarn]}>
                <Text style={{ width: 12 }}>{a.severity==='critical'?'!!':'! '}</Text>
                <Text style={{ flex: 1 }}>{CATEGORY_LABELS[a.category]||a.category} · {a.scope}</Text>
                <Text style={{ width: 60, color: varianceColor(a.pct), fontWeight:'bold', textAlign:'right' }}>+{a.pct.toFixed(1)}%</Text>
                <Text style={{ width: 130, fontFamily:'Courier', textAlign:'right' }}>{fmtBRL(a.actual)} / {fmtBRL(a.planned)}</Text>
              </View>
            ))}
          </View>
        )}

        <Footer s={s} company={company} />
      </Page>

      {/* Página 2: Tabela mensal por categoria */}
      <Page size="A4" style={s.page} orientation="landscape">
        <Header s={s} company={company} budget={budget} period={period} />
        <View style={s.section}>
          <Text style={s.sectionTitle}>Planejado × Realizado por categoria · {budget.fiscalYear}</Text>
          <View style={s.table}>
            <View style={{ flexDirection:'row' }}>
              <Text style={[s.th, { width: 110 }]}>Categoria</Text>
              {MONTHS.map((m, idx) => (
                <Text key={m} style={[s.th, { width: 50, textAlign:'right', borderLeft: idx+1===currentMonth ? `2pt solid ${primary}`:'none' }]}>{m}</Text>
              ))}
              <Text style={[s.th, { width: 70, textAlign:'right' }]}>Total</Text>
            </View>
            {table.map(row => (
              <View key={row.category} style={{ flexDirection:'row' }}>
                <Text style={[s.td, { width: 110, fontWeight:'bold' }]}>{CATEGORY_LABELS[row.category]||row.category}</Text>
                {row.months.map((cell, idx) => (
                  <View key={idx} style={[s.td, { width: 50, borderLeft: idx+1===currentMonth ? `2pt solid ${primary}`:'none' }]}>
                    <Text style={{ fontSize:7, color:'#888', textAlign:'right', fontFamily:'Courier' }}>{cell.planned>0?fmtBRLShort(cell.planned):'—'}</Text>
                    <Text style={{ fontSize:7, color: cell.pct!==null?varianceColor(cell.pct):'#444', fontWeight:'bold', textAlign:'right', fontFamily:'Courier' }}>{cell.actual>0?fmtBRLShort(cell.actual):'·'}</Text>
                  </View>
                ))}
                <View style={[s.td, { width: 70 }]}>
                  <Text style={{ fontSize:7, color:'#888', textAlign:'right', fontFamily:'Courier' }}>{fmtBRLShort(row.plannedTotal)}</Text>
                  <Text style={{ fontSize:7, color: varianceColor(row.pctTotal), fontWeight:'bold', textAlign:'right', fontFamily:'Courier' }}>{fmtBRLShort(row.actualTotal)}{row.pctTotal!==null?` (${row.pctTotal>=0?'+':''}${row.pctTotal.toFixed(0)}%)`:''}</Text>
                </View>
              </View>
            ))}
          </View>
          <Text style={{ fontSize:7, color:'#888', marginTop:8 }}>
            Por célula: linha superior em cinza = planejado · linha inferior colorida = realizado. Mês corrente destacado.
          </Text>
        </View>
        <Footer s={s} company={company} />
      </Page>

      {/* Página 3: Histórico de snapshots (se houver) */}
      {snapshots && snapshots.length > 0 && (
        <Page size="A4" style={s.page}>
          <Header s={s} company={company} budget={budget} period={period} />
          <View style={s.section}>
            <Text style={s.sectionTitle}>Histórico de snapshots</Text>
            <Text style={{ fontSize:7, color:'#888', marginBottom:6 }}>
              Cada snapshot congela o estado do orçamento no momento em que foi tirado (mensalmente via cron).
            </Text>
            <View style={s.table}>
              <View style={{ flexDirection:'row' }}>
                <Text style={[s.th, { width: 70 }]}>Data</Text>
                <Text style={[s.th, { width: 50 }]}>Mês</Text>
                <Text style={[s.th, { width: 80, textAlign:'right' }]}>Plan. mês</Text>
                <Text style={[s.th, { width: 80, textAlign:'right' }]}>Real. mês</Text>
                <Text style={[s.th, { width: 50, textAlign:'right' }]}>Δ%</Text>
                <Text style={[s.th, { width: 80, textAlign:'right' }]}>YTD plan</Text>
                <Text style={[s.th, { width: 80, textAlign:'right' }]}>YTD real</Text>
                <Text style={[s.th, { width: 80, textAlign:'right' }]}>Proj. YE</Text>
                <Text style={[s.th, { width: 50, textAlign:'right' }]}>Alerts</Text>
              </View>
              {snapshots.map(snap => (
                <View key={snap.id} style={{ flexDirection:'row' }}>
                  <Text style={[s.tdMono, { width: 70 }]}>{snap.snapshot_date}</Text>
                  <Text style={[s.td, { width: 50 }]}>{MONTHS[(snap.fiscal_month||1)-1]}</Text>
                  <Text style={[s.tdMono, { width: 80, textAlign:'right' }]}>{fmtBRL(snap.planned_total)}</Text>
                  <Text style={[s.tdMono, { width: 80, textAlign:'right' }]}>{fmtBRL(snap.actual_total)}</Text>
                  <Text style={[s.tdMono, { width: 50, textAlign:'right', color: varianceColor(parseFloat(snap.variance_pct)) }]}>{snap.variance_pct!==null?`${parseFloat(snap.variance_pct)>=0?'+':''}${parseFloat(snap.variance_pct).toFixed(1)}%`:'—'}</Text>
                  <Text style={[s.tdMono, { width: 80, textAlign:'right' }]}>{fmtBRLShort(snap.ytd_planned)}</Text>
                  <Text style={[s.tdMono, { width: 80, textAlign:'right' }]}>{fmtBRLShort(snap.ytd_actual)}</Text>
                  <Text style={[s.tdMono, { width: 80, textAlign:'right', color: primary }]}>{fmtBRLShort(snap.ye_projection)}</Text>
                  <Text style={[s.td, { width: 50, textAlign:'right' }]}>{snap.alerts_created||0}</Text>
                </View>
              ))}
            </View>
          </View>
          <Footer s={s} company={company} />
        </Page>
      )}
    </Document>
  );
}

function MonthlyChart({ s, months, currentMonth, primary }) {
  const max = Math.max(...months.map(m => Math.max(m.planned, m.actual)), 1);
  return (
    <View style={{ flexDirection:'row', alignItems:'flex-end', height:110, marginTop:8, gap:4 }}>
      {months.map((m, idx) => {
        const planH = (m.planned / max) * 100;
        const actH = (m.actual / max) * 100;
        const isFuture = idx+1 > currentMonth;
        return (
          <View key={idx} style={{ flex:1, alignItems:'center' }}>
            <View style={{ height: 100, flexDirection:'row', alignItems:'flex-end', gap:1 }}>
              <View style={{ width:7, height: planH, backgroundColor:'#e5e7eb' }} />
              {!isFuture && <View style={{ width:7, height: actH, backgroundColor: primary }} />}
            </View>
            <Text style={{ fontSize:6, marginTop:3, color: idx+1===currentMonth ? primary : '#666' }}>{MONTHS[idx]}</Text>
          </View>
        );
      })}
    </View>
  );
}

// Helper: gera o blob do PDF
export async function generateBudgetPdfBlob(props) {
  return await pdf(<BudgetReportPDF {...props} />).toBlob();
}

// Helper: dispara download
export async function downloadBudgetPdf(props) {
  const blob = await generateBudgetPdfBlob(props);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Followup ${props.budget.name} - ${new Date().toISOString().slice(0,10)}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Helper: converte blob para base64 puro (sem prefixo data:)
export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      const base64 = typeof result === 'string' ? result.split(',')[1] : '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
