# AeroManager v2.0 ✈

Sistema de gestão de aeronaves privadas — redesenhado com tema cockpit escuro, instrumentos analógicos digitais, agente IA integrado e suporte a importação do ForeFlight e PlaneIT.

## Novidades da v2

- **Tema cockpit escuro** com instrumentos analógicos digitais (gauge circular)
- **CoPiloto IA** com acesso aos seus dados reais (requer chave API Anthropic)
- **Importação ForeFlight** — importe seu logbook CSV diretamente
- **Importação PlaneIT** — suporte ao diário de bordo homologado pela ANAC
- **Dashboard com instrumentos** — horímetro, TBO e ciclos em gauges visuais
- **Cálculo de custo/hora real** por aeronave baseado nos seus lançamentos
- **Reserva de TBO automática** com barra de progresso visual

## Como rodar localmente

```bash
cd ~/Downloads/aeromanager
npm install
npm start
```

Acesse: http://localhost:3000

## Como configurar o CoPiloto IA

1. Acesse **console.anthropic.com**
2. Crie uma conta (gratuita para começar)
3. Gere uma API Key em "API Keys"
4. No app, clique em **CoPiloto IA** na barra lateral
5. Clique no ícone 🔑 e cole sua chave
6. Comece a perguntar sobre seus voos e custos!

## Deploy no Vercel (grátis)

```bash
# 1. Inicializar git
git init
git add .
git commit -m "feat: AeroManager v2.0"
git branch -M main

# 2. Criar repositório em github.com e conectar
git remote add origin https://github.com/SEU_USUARIO/aeromanager.git
git push -u origin main

# 3. Em vercel.com: Add New Project → selecionar aeromanager → Deploy
```

## Integrações suportadas

| App | Status | Como importar |
|-----|--------|---------------|
| ForeFlight | ✅ Disponível | Logbook → Export → CSV |
| PlaneIT | ✅ Disponível | Exportar CSV separado por ; |
| Garmin Pilot | 🔜 Em breve | — |
| FlightAware | 🔜 Em breve | — |
| OpenSky ADS-B | 🔜 Em breve | — |
| REDEMET | 🔜 Em breve | — |
