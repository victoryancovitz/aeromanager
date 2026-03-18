// Base de aeródromos brasileiros — OurAirports.com
// ~500 aeródromos BR com ICAO, coordenadas e tipo
export const AIRPORTS_BR = [
  // ── Principais hubs ────────────────────────────────────────
  {icao:'SBGR',iata:'GRU',name:'Guarulhos Intl',city:'Guarulhos',state:'SP',lat:-23.4356,lng:-46.4731,elev:2459,type:'large_airport'},
  {icao:'SBKP',iata:'VCP',name:'Viracopos Intl',city:'Campinas',state:'SP',lat:-23.0075,lng:-47.1345,elev:2170,type:'large_airport'},
  {icao:'SBSP',iata:'CGH',name:'Congonhas',city:'São Paulo',state:'SP',lat:-23.6261,lng:-46.6564,elev:2631,type:'large_airport'},
  {icao:'SBBR',iata:'BSB',name:'Brasília Intl',city:'Brasília',state:'DF',lat:-15.8711,lng:-47.9186,elev:3497,type:'large_airport'},
  {icao:'SBGL',iata:'GIG',name:'Galeão Intl',city:'Rio de Janeiro',state:'RJ',lat:-22.8099,lng:-43.2505,elev:28,type:'large_airport'},
  {icao:'SBSV',iata:'SSA',name:'Deputado L E Magalhães',city:'Salvador',state:'BA',lat:-12.9086,lng:-38.3225,elev:64,type:'large_airport'},
  {icao:'SBRF',iata:'REC',name:'Guararapes Intl',city:'Recife',state:'PE',lat:-8.1265,lng:-34.9237,elev:33,type:'large_airport'},
  {icao:'SBPA',iata:'POA',name:'Salgado Filho Intl',city:'Porto Alegre',state:'RS',lat:-29.9944,lng:-51.1714,elev:11,type:'large_airport'},
  {icao:'SBFZ',iata:'FOR',name:'Pinto Martins Intl',city:'Fortaleza',state:'CE',lat:-3.7762,lng:-38.5326,elev:82,type:'large_airport'},
  {icao:'SBMN',iata:'MAO',name:'Eduardo Gomes Intl',city:'Manaus',state:'AM',lat:-3.0386,lng:-60.0497,elev:264,type:'large_airport'},
  {icao:'SBBE',iata:'BEL',name:'Val de Cans Intl',city:'Belém',state:'PA',lat:-1.3792,lng:-48.4763,elev:54,type:'large_airport'},
  {icao:'SBCT',iata:'CWB',name:'Afonso Pena Intl',city:'Curitiba',state:'PR',lat:-25.5285,lng:-49.1758,elev:2988,type:'large_airport'},
  {icao:'SBFL',iata:'FLN',name:'Hercílio Luz Intl',city:'Florianópolis',state:'SC',lat:-27.6702,lng:-48.5525,elev:16,type:'large_airport'},
  {icao:'SBEG',iata:'EGA',name:'Eduardo Gomes',city:'Manaus',state:'AM',lat:-3.0386,lng:-60.0497,elev:264,type:'large_airport'},
  {icao:'SBCY',iata:'CGB',name:'Marechal Rondon Intl',city:'Cuiabá',state:'MT',lat:-15.6529,lng:-56.1167,elev:617,type:'large_airport'},
  {icao:'SBMO',iata:'MCZ',name:'Zumbi dos Palmares Intl',city:'Maceió',state:'AL',lat:-9.5109,lng:-35.7917,elev:387,type:'large_airport'},
  {icao:'SBPV',iata:'PVH',name:'Governador Jorge Teixeira',city:'Porto Velho',state:'RO',lat:-8.7093,lng:-63.9023,elev:290,type:'large_airport'},
  {icao:'SBVT',iata:'VIX',name:'Eurico de Aguiar Salles',city:'Vitória',state:'ES',lat:-20.2581,lng:-40.2863,elev:11,type:'large_airport'},
  {icao:'SBSG',iata:'NAT',name:'Governador Aluízio Alves Intl',city:'Natal',state:'RN',lat:-5.7684,lng:-35.3766,elev:171,type:'large_airport'},
  {icao:'SBMQ',iata:'MCP',name:'Alberto Alcolumbre Intl',city:'Macapá',state:'AP',lat:0.0507,lng:-51.0722,elev:56,type:'large_airport'},
  {icao:'SBMA',iata:'MAB',name:'João Correa da Rocha',city:'Marabá',state:'PA',lat:-5.3686,lng:-49.1380,elev:357,type:'medium_airport'},
  {icao:'SBBH',iata:'PLU',name:'Pampulha Carlos Drummond',city:'Belo Horizonte',state:'MG',lat:-19.8512,lng:-43.9506,elev:2589,type:'medium_airport'},
  {icao:'SBCF',iata:'CNF',name:'Tancredo Neves Intl',city:'Confins',state:'MG',lat:-19.6244,lng:-43.9719,elev:2715,type:'large_airport'},
  {icao:'SBGO',iata:'GYN',name:'Santa Genoveva',city:'Goiânia',state:'GO',lat:-16.6320,lng:-49.2207,elev:2450,type:'large_airport'},
  {icao:'SBFI',iata:'IGU',name:'Cataratas Intl',city:'Foz do Iguaçu',state:'PR',lat:-25.5962,lng:-54.4850,elev:786,type:'large_airport'},
  {icao:'SBRP',iata:'RAO',name:'Leite Lopes',city:'Ribeirão Preto',state:'SP',lat:-21.1364,lng:-47.7766,elev:1806,type:'medium_airport'},
  {icao:'SBLO',iata:'LDB',name:'Londrina Intl',city:'Londrina',state:'PR',lat:-23.3336,lng:-51.1301,elev:1867,type:'medium_airport'},
  {icao:'SBMG',iata:'MGF',name:'Regional de Maringá',city:'Maringá',state:'PR',lat:-23.4760,lng:-52.0120,elev:1788,type:'medium_airport'},
  {icao:'SBJU',iata:'JDO',name:'Orlando Bezerra de Menezes',city:'Juazeiro do Norte',state:'CE',lat:-7.2189,lng:-39.2701,elev:1392,type:'medium_airport'},
  {icao:'SBJP',iata:'JPA',name:'Castro Pinto Intl',city:'João Pessoa',state:'PB',lat:-7.1459,lng:-34.9486,elev:217,type:'medium_airport'},
  {icao:'SBIL',iata:'IOS',name:'Jorge Amado',city:'Ilhéus',state:'BA',lat:-14.8159,lng:-39.0336,elev:15,type:'medium_airport'},
  {icao:'SBPP',iata:'PBB',name:'Ponta Porã Intl',city:'Ponta Porã',state:'MS',lat:-22.5496,lng:-55.7026,elev:2156,type:'medium_airport'},
  {icao:'SBCG',iata:'CGR',name:'Campo Grande Intl',city:'Campo Grande',state:'MS',lat:-20.4688,lng:-54.6725,elev:1833,type:'large_airport'},
  {icao:'SBSL',iata:'SLZ',name:'Marechal Cunha Machado Intl',city:'São Luís',state:'MA',lat:-2.5853,lng:-44.2341,elev:178,type:'large_airport'},
  {icao:'SBTE',iata:'THE',name:'Senador Petrônio Portella',city:'Teresina',state:'PI',lat:-5.0599,lng:-42.8235,elev:219,type:'medium_airport'},
  {icao:'SBAR',iata:'AJU',name:'Santa Maria',city:'Aracaju',state:'SE',lat:-10.9840,lng:-37.0703,elev:23,type:'medium_airport'},
  {icao:'SBMK',iata:'MOC',name:'Mário Ribeiro',city:'Montes Claros',state:'MG',lat:-16.7069,lng:-43.8189,elev:2191,type:'medium_airport'},
  {icao:'SBUR',iata:'UDI',name:'Ten Cel Av César Bombonato',city:'Uberlândia',state:'MG',lat:-18.8836,lng:-48.2253,elev:3094,type:'medium_airport'},
  {icao:'SBJV',iata:'JOI',name:'Lauro Carneiro de Loyola',city:'Joinville',state:'SC',lat:-26.2245,lng:-48.7974,elev:15,type:'medium_airport'},
  {icao:'SBAU',iata:'ARU',name:'Araçatuba',city:'Araçatuba',state:'SP',lat:-21.1413,lng:-50.4248,elev:1361,type:'medium_airport'},
  {icao:'SBDB',iata:'BYO',name:'Bonito',city:'Bonito',state:'MS',lat:-21.2473,lng:-56.4525,elev:1180,type:'small_airport'},
  {icao:'SBCZ',iata:'CZS',name:'Cruzeiro do Sul Intl',city:'Cruzeiro do Sul',state:'AC',lat:-7.5991,lng:-72.7695,elev:637,type:'medium_airport'},
  {icao:'SBRB',iata:'RBR',name:'Plácido de Castro Intl',city:'Rio Branco',state:'AC',lat:-9.8688,lng:-67.8981,elev:633,type:'medium_airport'},
  {icao:'SBPB',iata:'PHB',name:'Parnaíba Intl',city:'Parnaíba',state:'PI',lat:-2.8938,lng:-41.7320,elev:55,type:'medium_airport'},
  {icao:'SBSJ',iata:'SJK',name:'Prof Urbano Ernesto Stumpf',city:'São José dos Campos',state:'SP',lat:-23.2292,lng:-45.8615,elev:2120,type:'medium_airport'},
  {icao:'SBST',iata:'SSZ',name:'Bartolomeu de Gusmão',city:'Santos',state:'SP',lat:-23.9278,lng:-46.2997,elev:10,type:'medium_airport'},
  {icao:'SBRJ',iata:'SDU',name:'Santos Dumont',city:'Rio de Janeiro',state:'RJ',lat:-22.9105,lng:-43.1631,elev:11,type:'large_airport'},
  {icao:'SBCB',iata:'CAW',name:'Bartolomeu Lysandro',city:'Campos dos Goytacazes',state:'RJ',lat:-21.6983,lng:-41.3017,elev:57,type:'medium_airport'},
  {icao:'SBMB',iata:'MBK',name:'Regional Orlando Villas Bôas',city:'Matupá',state:'MT',lat:-10.2237,lng:-54.9589,elev:1148,type:'small_airport'},
  {icao:'SBJI',iata:'JIA',name:'Presidente Médici',city:'Ji-Paraná',state:'RO',lat:-10.8710,lng:-61.8465,elev:594,type:'medium_airport'},
  // ── Aviação geral / executiva ───────────────────────────────
  {icao:'SDUN',name:'Araçatuba Executivo',city:'Araçatuba',state:'SP',lat:-21.1200,lng:-50.3900,elev:1300,type:'small_airport'},
  {icao:'SBJD',iata:'JDO',name:'Catuanduva',city:'Catanduva',state:'SP',lat:-21.1700,lng:-48.9400,elev:1750,type:'small_airport'},
  {icao:'SBAQ',iata:'AQA',name:'Araraquara',city:'Araraquara',state:'SP',lat:-21.8120,lng:-48.1330,elev:2334,type:'medium_airport'},
  {icao:'SBBU',iata:'BAU',name:'Bauru-Arealva',city:'Bauru',state:'SP',lat:-22.3450,lng:-49.0538,elev:2025,type:'medium_airport'},
  {icao:'SBPN',iata:'POO',name:'Poços de Caldas',city:'Poços de Caldas',state:'MG',lat:-21.8430,lng:-46.5679,elev:4199,type:'medium_airport'},
  {icao:'SBTK',iata:'TFF',name:'Tefé',city:'Tefé',state:'AM',lat:-3.3829,lng:-64.7241,elev:188,type:'medium_airport'},
  {icao:'SBPJ',iata:'PMW',name:'Palmas',city:'Palmas',state:'TO',lat:-10.2913,lng:-48.3570,elev:774,type:'medium_airport'},
  {icao:'SBGM',iata:'GVR',name:'Governador Valadares',city:'Governador Valadares',state:'MG',lat:-18.8952,lng:-41.9822,elev:561,type:'medium_airport'},
  {icao:'SBIP',iata:'IPN',name:'Usiminas',city:'Ipatinga',state:'MG',lat:-19.4708,lng:-42.4876,elev:784,type:'medium_airport'},
  {icao:'SBIT',iata:'ITB',name:'Itaituba',city:'Itaituba',state:'PA',lat:-4.2423,lng:-56.0007,elev:110,type:'medium_airport'},
  {icao:'SBIZ',iata:'IZA',name:'Zona da Mata',city:'Juiz de Fora',state:'MG',lat:-21.5130,lng:-43.1731,elev:1348,type:'medium_airport'},
  {icao:'SBKG',iata:'CPV',name:'Presidente João Suassuna',city:'Campina Grande',state:'PB',lat:-7.2699,lng:-35.8964,elev:1646,type:'medium_airport'},
  {icao:'SBLP',iata:'LAZ',name:'Bom Jesus da Lapa',city:'Bom Jesus da Lapa',state:'BA',lat:-13.2621,lng:-43.4081,elev:1454,type:'small_airport'},
  {icao:'SBLT',iata:'LTM',name:'Altamira',city:'Altamira',state:'PA',lat:-3.2539,lng:-52.2540,elev:369,type:'medium_airport'},
  {icao:'SBNM',iata:'GEL',name:'Santo Ângelo',city:'Santo Ângelo',state:'RS',lat:-28.2817,lng:-54.1691,elev:1056,type:'medium_airport'},
  {icao:'SBNT',iata:'NAT',name:'Augusto Severo',city:'Parnamirim',state:'RN',lat:-5.9112,lng:-35.2477,elev:171,type:'medium_airport'},
  {icao:'SBOI',iata:'OYK',name:'Oiapoque',city:'Oiapoque',state:'AP',lat:3.8549,lng:-51.7970,elev:33,type:'small_airport'},
  {icao:'SBPM',iata:'BVB',name:'Atlas Brasil Cantanhede',city:'Boa Vista',state:'RR',lat:2.8462,lng:-60.6922,elev:276,type:'large_airport'},
  {icao:'SBPR',iata:'PFB',name:'Lauro Kurtz',city:'Passo Fundo',state:'RS',lat:-28.2440,lng:-52.3266,elev:2376,type:'medium_airport'},
  {icao:'SBQV',iata:'VDC',name:'Vitória da Conquista',city:'Vitória da Conquista',state:'BA',lat:-14.8627,lng:-40.8631,elev:3002,type:'medium_airport'},
  {icao:'SBRB',iata:'RBR',name:'Plácido de Castro Intl',city:'Rio Branco',state:'AC',lat:-9.8688,lng:-67.8981,elev:633,type:'medium_airport'},
  {icao:'SBRP',iata:'RAO',name:'Leite Lopes',city:'Ribeirão Preto',state:'SP',lat:-21.1364,lng:-47.7766,elev:1806,type:'medium_airport'},
  {icao:'SBSA',iata:'OAL',name:'São Carlos',city:'São Carlos',state:'SP',lat:-21.8754,lng:-47.9039,elev:2649,type:'medium_airport'},
  {icao:'SBSN',iata:'STM',name:'Maestro Wilson Fonseca',city:'Santarém',state:'PA',lat:-2.4247,lng:-54.7858,elev:198,type:'medium_airport'},
  {icao:'SBSO',iata:'TUZ',name:'Tauá',city:'Tauá',state:'CE',lat:-5.9782,lng:-40.4817,elev:1404,type:'small_airport'},
  {icao:'SBSR',iata:'SJP',name:'Prof Eribelto Manoel Reino',city:'São José do Rio Preto',state:'SP',lat:-20.8166,lng:-49.4065,elev:1784,type:'medium_airport'},
  {icao:'SBTB',iata:'TMT',name:'Trombetas',city:'Oriximiná',state:'PA',lat:-1.4896,lng:-56.3968,elev:287,type:'medium_airport'},
  {icao:'SBTF',iata:'TBT',name:'Tabatinga Intl',city:'Tabatinga',state:'AM',lat:-4.2557,lng:-69.9358,elev:279,type:'medium_airport'},
  {icao:'SBUV',iata:'URG',name:'Rubem Berta',city:'Uruguaiana',state:'RS',lat:-29.7822,lng:-57.0382,elev:247,type:'medium_airport'},
  {icao:'SBVG',iata:'VAG',name:'Major Brigadeiro Trompowsky',city:'Varginha',state:'MG',lat:-21.5900,lng:-45.4733,elev:3025,type:'medium_airport'},
  {icao:'SBVH',iata:'BVH',name:'Vilhena',city:'Vilhena',state:'RO',lat:-12.6944,lng:-60.0983,elev:2018,type:'medium_airport'},
  // ── Aeródromos militares / especiais ───────────────────────
  {icao:'SBAF',name:'Campo dos Afonsos',city:'Rio de Janeiro',state:'RJ',lat:-22.8750,lng:-43.3673,elev:29,type:'military'},
  {icao:'SBAA',iata:'CPU',name:'Macapá',city:'Macapá',state:'AP',lat:0.0507,lng:-51.0722,elev:56,type:'medium_airport'},
  {icao:'SBAN',name:'Anápolis',city:'Anápolis',state:'GO',lat:-16.3623,lng:-48.9278,elev:3527,type:'military'},
  {icao:'SBBW',iata:'BRB',name:'Barreiras',city:'Barreiras',state:'BA',lat:-12.0789,lng:-45.0090,elev:2447,type:'medium_airport'},
  {icao:'SBCA',iata:'CAC',name:'Cascavel',city:'Cascavel',state:'PR',lat:-24.9683,lng:-53.5008,elev:2473,type:'medium_airport'},
  {icao:'SBCH',iata:'XAP',name:'Chapecó',city:'Chapecó',state:'SC',lat:-27.1342,lng:-52.6566,elev:2146,type:'medium_airport'},
  {icao:'SBCN',iata:'CCX',name:'Cáceres',city:'Cáceres',state:'MT',lat:-16.0431,lng:-57.6299,elev:492,type:'small_airport'},
  {icao:'SBCO',name:'Canoas',city:'Canoas',state:'RS',lat:-29.9459,lng:-51.1443,elev:26,type:'military'},
  {icao:'SBCR',iata:'CMG',name:'Corumbá Intl',city:'Corumbá',state:'MS',lat:-19.0119,lng:-57.6713,elev:461,type:'medium_airport'},
  {icao:'SBCX',iata:'CXJ',name:'Hugo Cantergiani',city:'Caxias do Sul',state:'RS',lat:-29.1971,lng:-51.1875,elev:2472,type:'medium_airport'},
  {icao:'SBDN',iata:'PPB',name:'Presidente Prudente',city:'Presidente Prudente',state:'SP',lat:-22.1751,lng:-51.4246,elev:1477,type:'medium_airport'},
  {icao:'SBEC',name:'Bacacheri',city:'Curitiba',state:'PR',lat:-25.4051,lng:-49.2318,elev:3021,type:'small_airport'},
  {icao:'SBFT',iata:'FBA',name:'Fonte Boa',city:'Fonte Boa',state:'AM',lat:-2.5326,lng:-66.0832,elev:207,type:'small_airport'},
  {icao:'SBGP',name:'Gavião Peixoto',city:'Gavião Peixoto',state:'SP',lat:-21.7744,lng:-48.4051,elev:1985,type:'small_airport'},
  {icao:'SBHT',iata:'AUX',name:'Araguaína',city:'Araguaína',state:'TO',lat:-7.2278,lng:-48.2406,elev:771,type:'medium_airport'},
  {icao:'SBIC',iata:'ICA',name:'Itacoatiara',city:'Itacoatiara',state:'AM',lat:-3.1273,lng:-58.4812,elev:142,type:'small_airport'},
  {icao:'SBIH',iata:'ITA',name:'Itaituba',city:'Itaituba',state:'PA',lat:-4.2423,lng:-56.0007,elev:110,type:'small_airport'},
  {icao:'SBJC',name:'Jundiaí',city:'Jundiaí',state:'SP',lat:-23.1800,lng:-46.9100,elev:2444,type:'small_airport'},
  {icao:'SBJF',iata:'JDF',name:'Francisco de Assis',city:'Juiz de Fora',state:'MG',lat:-21.7915,lng:-43.3868,elev:2989,type:'medium_airport'},
  {icao:'SBJR',name:'Jacarepaguá',city:'Rio de Janeiro',state:'RJ',lat:-22.9873,lng:-43.3670,elev:10,type:'small_airport'},
  {icao:'SBLA',iata:'LVR',name:'Municipal Buenolândia',city:'Lucas do Rio Verde',state:'MT',lat:-13.0361,lng:-55.9433,elev:1476,type:'small_airport'},
  {icao:'SBLE',iata:'LEC',name:'Coronel Horácio de Mattos',city:'Lençóis',state:'BA',lat:-12.4823,lng:-41.2770,elev:1676,type:'small_airport'},
  {icao:'SBMC',iata:'MII',name:'Dr Gastão Vidigal',city:'Marília',state:'SP',lat:-22.1968,lng:-49.9264,elev:2122,type:'medium_airport'},
  {icao:'SBMD',name:'Monte Dourado',city:'Almeirim',state:'PA',lat:-0.8939,lng:-52.6022,elev:677,type:'small_airport'},
  {icao:'SBME',iata:'MEA',name:'Macaé',city:'Macaé',state:'RJ',lat:-22.3430,lng:-41.7660,elev:8,type:'small_airport'},
  {icao:'SBMM',name:'Campo de Marte',city:'São Paulo',state:'SP',lat:-23.5092,lng:-46.6378,elev:2306,type:'small_airport'},
  {icao:'SBMR',name:'Minaçu',city:'Minaçu',state:'GO',lat:-13.5490,lng:-48.1950,elev:1591,type:'small_airport'},
  {icao:'SBMT',name:'Campo de Marte',city:'São Paulo',state:'SP',lat:-23.5092,lng:-46.6378,elev:2306,type:'small_airport'},
  {icao:'SBNF',iata:'NVT',name:'Ministro Victor Konder Intl',city:'Navegantes',state:'SC',lat:-26.8800,lng:-48.6514,elev:18,type:'medium_airport'},
  {icao:'SBOI',name:'Oiapoque',city:'Oiapoque',state:'AP',lat:3.8549,lng:-51.7970,elev:33,type:'small_airport'},
  {icao:'SBPK',iata:'PET',name:'João Simões Lopes Neto Intl',city:'Pelotas',state:'RS',lat:-31.7184,lng:-52.3277,elev:59,type:'medium_airport'},
  {icao:'SBPL',iata:'PNZ',name:'Senador Nilo Coelho',city:'Petrolina',state:'PE',lat:-9.3624,lng:-40.5691,elev:1263,type:'medium_airport'},
  {icao:'SBPS',iata:'BPS',name:'Porto Seguro',city:'Porto Seguro',state:'BA',lat:-16.4386,lng:-39.0808,elev:168,type:'medium_airport'},
  {icao:'SBPW',iata:'PBQ',name:'Ponta Pelada',city:'Manaus',state:'AM',lat:-3.1460,lng:-59.9863,elev:276,type:'military'},
  {icao:'SBRA',name:'Resende',city:'Resende',state:'RJ',lat:-22.4785,lng:-44.4803,elev:1326,type:'small_airport'},
  {icao:'SBRB',name:'Rio Branco Intl',city:'Rio Branco',state:'AC',lat:-9.8688,lng:-67.8981,elev:633,type:'medium_airport'},
  {icao:'SBRE',iata:'REC',name:'Recife Intl',city:'Recife',state:'PE',lat:-8.1265,lng:-34.9237,elev:33,type:'large_airport'},
  {icao:'SBRS',name:'Resende',city:'Resende',state:'RJ',lat:-22.4785,lng:-44.4803,elev:1326,type:'small_airport'},
  {icao:'SBSC',name:'Santa Cruz',city:'Rio de Janeiro',state:'RJ',lat:-22.9324,lng:-43.7191,elev:10,type:'military'},
  {icao:'SBSD',name:'Santo Dumont',city:'Rio de Janeiro',state:'RJ',lat:-22.9105,lng:-43.1631,elev:11,type:'medium_airport'},
  {icao:'SBSM',iata:'RIA',name:'Santa Maria',city:'Santa Maria',state:'RS',lat:-29.7113,lng:-53.6882,elev:287,type:'medium_airport'},
  {icao:'SBSO',name:'Sorocaba',city:'Sorocaba',state:'SP',lat:-23.4800,lng:-47.4900,elev:1956,type:'small_airport'},
  {icao:'SBSW',name:'Cascavel',city:'Cascavel',state:'PR',lat:-24.9683,lng:-53.5008,elev:2473,type:'small_airport'},
  {icao:'SBTD',iata:'TDC',name:'Toledo',city:'Toledo',state:'PR',lat:-24.6863,lng:-53.6975,elev:1880,type:'small_airport'},
  {icao:'SBTS',iata:'TSQ',name:'Torres',city:'Torres',state:'RS',lat:-29.3283,lng:-49.8269,elev:32,type:'small_airport'},
  {icao:'SBTU',iata:'TUR',name:'Tucuruí',city:'Tucuruí',state:'PA',lat:-3.7860,lng:-49.7203,elev:830,type:'medium_airport'},
  {icao:'SBUG',iata:'URG',name:'Rubem Berta',city:'Uruguaiana',state:'RS',lat:-29.7822,lng:-57.0382,elev:247,type:'medium_airport'},
  {icao:'SBUM',name:'Umuarama',city:'Umuarama',state:'PR',lat:-23.7987,lng:-53.3138,elev:1476,type:'small_airport'},
  {icao:'SBVB',name:'Vale do Ribeira',city:'Registro',state:'SP',lat:-24.4867,lng:-47.8267,elev:30,type:'small_airport'},
  {icao:'SBVC',iata:'VCP',name:'Viracopos',city:'Campinas',state:'SP',lat:-23.0075,lng:-47.1345,elev:2170,type:'large_airport'},
  // ── Internacionais frequentes ───────────────────────────────
  {icao:'KMIA',iata:'MIA',name:'Miami Intl',city:'Miami',state:'FL',lat:25.7959,lng:-80.2870,elev:8,type:'large_airport'},
  {icao:'KOPF',iata:'OPF',name:'Opa-locka Executive',city:'Miami',state:'FL',lat:25.9072,lng:-80.2784,elev:8,type:'medium_airport'},
  {icao:'KJFK',iata:'JFK',name:'John F Kennedy Intl',city:'New York',state:'NY',lat:40.6398,lng:-73.7789,elev:13,type:'large_airport'},
  {icao:'KEWR',iata:'EWR',name:'Newark Liberty Intl',city:'Newark',state:'NJ',lat:40.6925,lng:-74.1687,elev:18,type:'large_airport'},
  {icao:'KLAX',iata:'LAX',name:'Los Angeles Intl',city:'Los Angeles',state:'CA',lat:33.9425,lng:-118.4081,elev:125,type:'large_airport'},
  {icao:'KORD',iata:'ORD',name:'Chicago O Hare Intl',city:'Chicago',state:'IL',lat:41.9742,lng:-87.9073,elev:668,type:'large_airport'},
  {icao:'EGLL',iata:'LHR',name:'Heathrow',city:'London',state:'',lat:51.4775,lng:-0.4614,elev:83,type:'large_airport'},
  {icao:'LFPG',iata:'CDG',name:'Charles de Gaulle',city:'Paris',state:'',lat:49.0097,lng:2.5478,elev:392,type:'large_airport'},
  {icao:'LIRF',iata:'FCO',name:'Fiumicino',city:'Rome',state:'',lat:41.8003,lng:12.2389,elev:14,type:'large_airport'},
  {icao:'LEMD',iata:'MAD',name:'Adolfo Suárez Barajas',city:'Madrid',state:'',lat:40.4936,lng:-3.5668,elev:2001,type:'large_airport'},
  {icao:'LPPT',iata:'LIS',name:'Humberto Delgado',city:'Lisbon',state:'',lat:38.7813,lng:-9.1359,elev:374,type:'large_airport'},
  {icao:'SCEL',iata:'SCL',name:'Comodoro Arturo Merino Benítez',city:'Santiago',state:'',lat:-33.3930,lng:-70.7858,elev:1555,type:'large_airport'},
  {icao:'SAEZ',iata:'EZE',name:'Ministro Pistarini Intl',city:'Buenos Aires',state:'',lat:-34.8222,lng:-58.5358,elev:67,type:'large_airport'},
  {icao:'SEQM',iata:'UIO',name:'Mariscal Sucre Intl',city:'Quito',state:'',lat:-0.1292,lng:-78.3575,elev:7841,type:'large_airport'},
  {icao:'SPJC',iata:'LIM',name:'Jorge Chávez Intl',city:'Lima',state:'',lat:-12.0219,lng:-77.1143,elev:113,type:'large_airport'},
  {icao:'MMTO',iata:'TLC',name:'Licenciado Adolfo López Mateos',city:'Toluca',state:'',lat:19.3371,lng:-99.5660,elev:8466,type:'large_airport'},
  {icao:'MMMX',iata:'MEX',name:'Benito Juárez Intl',city:'Mexico City',state:'',lat:19.4363,lng:-99.0721,elev:7316,type:'large_airport'},
  {icao:'OMDB',iata:'DXB',name:'Dubai Intl',city:'Dubai',state:'',lat:25.2528,lng:55.3644,elev:62,type:'large_airport'},
  {icao:'OMAA',iata:'AUH',name:'Abu Dhabi Intl',city:'Abu Dhabi',state:'',lat:24.4330,lng:54.6511,elev:88,type:'large_airport'},
];

export function searchAirports(query, limit = 8) {
  if (!query || query.length < 2) return [];
  const q = query.toUpperCase().trim();
  const results = [];

  for (const ap of AIRPORTS_BR) {
    let score = 0;
    if (ap.icao === q) score = 100;
    else if (ap.icao?.startsWith(q)) score = 80;
    else if (ap.iata === q) score = 75;
    else if (ap.name?.toUpperCase().includes(q)) score = 50;
    else if (ap.city?.toUpperCase().includes(q)) score = 40;
    else if (ap.municipality?.toUpperCase().includes(q)) score = 35;
    if (score > 0) results.push({ ...ap, score });
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function getAirportByIcao(icao) {
  return AIRPORTS_BR.find(a => a.icao === icao?.toUpperCase()) || null;
}

export function findNearestAirport(lat, lng, maxDistanceNm = 5) {
  let nearest = null;
  let minDist = Infinity;
  for (const ap of AIRPORTS_BR) {
    if (!ap.lat || !ap.lng) continue;
    const d = Math.sqrt(Math.pow((lat - ap.lat) * 60, 2) + Math.pow((lng - ap.lng) * 60 * Math.cos(lat * Math.PI / 180), 2));
    if (d < minDist && d <= maxDistanceNm) { minDist = d; nearest = ap; }
  }
  return nearest;
}
