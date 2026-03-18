export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, anthropic-version');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Prioridade: variável de ambiente do servidor → chave enviada pelo cliente
  const serverKey = process.env.ANTHROPIC_API_KEY;
  const clientKey = req.headers['x-api-key'] || req.body?.apiKey;
  const apiKey = serverKey || clientKey;

  if (!apiKey) {
    return res.status(401).json({
      error: {
        type: 'auth_error',
        message: 'API key não configurada. Adicione ANTHROPIC_API_KEY nas variáveis de ambiente do Vercel, ou configure sua chave no CoPiloto IA.'
      }
    });
  }

  // Remove campos que não devem ir para a API
  const { apiKey: _removed, ...bodyClean } = req.body || {};

  // Limite de tamanho do body: 10 MB
  const bodyStr = JSON.stringify(bodyClean);
  if (bodyStr.length > 10 * 1024 * 1024) {
    return res.status(413).json({
      error: {
        type: 'request_too_large',
        message: 'Requisição muito grande. Reduza o tamanho do PDF para menos de 4 MB.'
      }
    });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': req.headers['anthropic-version'] || '2023-06-01',
      },
      body: bodyStr,
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: { type: 'server_error', message: err.message } });
  }
}
