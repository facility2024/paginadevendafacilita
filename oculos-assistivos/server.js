const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const port = Number(process.env.PORT) || 3000;
const mimeTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8', '.svg': 'image/svg+xml' };
const configFailures = new Map();
const configurableKeys = ['SETUP_PASSWORD', 'AI_PROVIDER', 'ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL', 'OPENAI_API_KEY', 'OPENAI_MODEL', 'GEMINI_API_KEY', 'GEMINI_MODEL', 'WAPI_API_URL', 'WAPI_INSTANCE_ID', 'WAPI_TOKEN'];

function loadLocalEnv() {
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || match[2].startsWith('#') || process.env[match[1]] !== undefined) continue;
    const value = match[2].replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, (_, doubleQuoted, singleQuoted) => doubleQuoted ?? singleQuoted);
    process.env[match[1]] = value;
  }
}

loadLocalEnv();

function sendJson(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(data));
}

function saveLocalEnv(values) {
  const envPath = path.join(root, '.env');
  const current = new Map();
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
      if (match) current.set(match[1], line.slice(line.indexOf('=') + 1).trim());
    }
  }
  for (const key of configurableKeys) {
    if (values[key] !== undefined && values[key] !== '') current.set(key, JSON.stringify(values[key]));
  }
  const content = [...current.entries()].map(([key, value]) => `${key}=${value}`).join('\n') + '\n';
  fs.writeFileSync(envPath, content, { encoding: 'utf8', mode: 0o600 });
  for (const key of configurableKeys) {
    const raw = current.get(key);
    if (raw !== undefined) {
      try { process.env[key] = JSON.parse(raw); }
      catch { process.env[key] = raw.replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, (_, doubleQuoted, singleQuoted) => doubleQuoted ?? singleQuoted); }
    }
  }
}

function configurationStatus() {
  const configuredProvider = process.env.AI_PROVIDER || 'anthropic';
  const provider = ['openai', 'anthropic', 'gemini'].includes(configuredProvider) ? configuredProvider : 'anthropic';
  const keyByProvider = { anthropic: 'ANTHROPIC_API_KEY', openai: 'OPENAI_API_KEY', gemini: 'GEMINI_API_KEY' };
  const modelByProvider = { anthropic: 'ANTHROPIC_MODEL', openai: 'OPENAI_MODEL', gemini: 'GEMINI_MODEL' };
  return {
    setupConfigured: Boolean(process.env.SETUP_PASSWORD),
    aiProvider: provider,
    aiModel: process.env[modelByProvider[provider]] || '',
    aiConfigured: Boolean(process.env[keyByProvider[provider]]),
    wapiCredentialsPresent: Boolean(process.env.WAPI_INSTANCE_ID && process.env.WAPI_TOKEN && process.env.WAPI_API_URL)
  };
}

function verifySetupPassword(request) {
  const expected = process.env.SETUP_PASSWORD || '';
  const provided = request.headers['x-setup-password'] || '';
  if (!expected || typeof provided !== 'string') return false;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length && require('node:crypto').timingSafeEqual(expectedBuffer, providedBuffer);
}

function isLoopbackAddress(address = '') {
  return address === '::1' || address === '127.0.0.1' || address.startsWith('::ffff:127.');
}

function readBody(request, limit = 7_000_000) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', chunk => {
      body += chunk;
      if (Buffer.byteLength(body) > limit) {
        reject(Object.assign(new Error('Requisição muito grande.'), { status: 413 }));
        request.destroy();
      }
    });
    request.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch { reject(Object.assign(new Error('JSON inválido.'), { status: 400 })); }
    });
    request.on('error', reject);
  });
}

async function askVisionAssistant(body) {
  if (typeof body.question !== 'string' || typeof body.image !== 'string' || body.image.length > 6_000_000) return { status: 400, data: { error: 'Pergunta ou imagem inválida.' } };
  const provider = process.env.AI_PROVIDER || 'anthropic';
  const system = 'Você é um assistente de acessibilidade visual para uma pessoa com baixa visão. Responda em português brasileiro, em frases curtas, com orientação espacial clara. Priorize riscos e obstáculos visíveis. Informe incertezas; nunca afirme que a cena está segura.';
  const question = body.question.slice(0, 1000);
  let upstream;

  if (provider === 'openai') {
    if (!process.env.OPENAI_API_KEY) return { status: 503, data: { error: 'Configure a chave OpenAI no painel de integrações.' } };
    upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        max_tokens: 300,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: [{ type: 'text', text: question }, { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${body.image}` } }] }
        ]
      })
    });
  } else if (provider === 'gemini') {
    if (!process.env.GEMINI_API_KEY) return { status: 503, data: { error: 'Configure a chave Gemini no painel de integrações.' } };
    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ parts: [{ text: question }, { inline_data: { mime_type: 'image/jpeg', data: body.image } }] }],
        generationConfig: { maxOutputTokens: 300 }
      })
    });
  } else {
    if (!process.env.ANTHROPIC_API_KEY) return { status: 503, data: { error: 'Configure a chave Anthropic/Claude no painel de integrações.' } };
    upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
        max_tokens: 300,
        system,
        messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: body.image } }, { type: 'text', text: question }] }]
      })
    });
  }
  const result = await upstream.json();
  if (!upstream.ok) return { status: upstream.status === 401 ? 502 : upstream.status, data: { error: result.error?.message || result.error?.status || 'A IA não conseguiu analisar a imagem.' } };
  const answer = provider === 'openai'
    ? result.choices?.[0]?.message?.content
    : provider === 'gemini'
      ? result.candidates?.[0]?.content?.parts?.map(part => part.text || '').join(' ')
      : result.content?.filter(item => item.type === 'text').map(item => item.text).join(' ');
  return { status: 200, data: { answer: answer?.trim() || 'Não consegui identificar detalhes na imagem.' } };
}

async function sendAlert(body) {
  if (typeof body.message !== 'string') return { status: 400, data: { error: 'Mensagem de alerta inválida.' } };
  const results = [];
  const allowedPhone = (process.env.CAREGIVER_PHONE || '').replace(/\D/g, '');
  const allowedEmail = (process.env.CAREGIVER_EMAIL || '').trim().toLowerCase();
  const requestedPhone = typeof body.phone === 'string' ? body.phone.replace(/\D/g, '') : '';
  const requestedEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (process.env.TWILIO_SID && process.env.TWILIO_TOKEN && process.env.TWILIO_WHATSAPP_FROM && allowedPhone && requestedPhone === allowedPhone) {
    const form = new URLSearchParams({ From: process.env.TWILIO_WHATSAPP_FROM, To: `whatsapp:+${allowedPhone}`, Body: body.message.slice(0, 1400) });
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(process.env.TWILIO_SID)}/Messages.json`, { method: 'POST', headers: { 'Authorization': `Basic ${Buffer.from(`${process.env.TWILIO_SID}:${process.env.TWILIO_TOKEN}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form });
    results.push(response.ok);
  }
  if (process.env.SENDGRID_KEY && process.env.MAIL_FROM && allowedEmail && requestedEmail === allowedEmail) {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', { method: 'POST', headers: { 'Authorization': `Bearer ${process.env.SENDGRID_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ personalizations: [{ to: [{ email: allowedEmail }] }], from: { email: process.env.MAIL_FROM }, subject: 'Pedido de ajuda', content: [{ type: 'text/plain', value: body.message.slice(0, 1400) }] }) });
    results.push(response.ok);
  }
  return { status: 200, data: { sent: results.some(Boolean), channels: results.filter(Boolean).length } };
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  if (request.method === 'GET' && url.pathname === '/api/status') {
    return sendJson(response, 200, { ...configurationStatus(), localSetupAllowed: isLoopbackAddress(request.socket.remoteAddress || '') });
  }
  if (request.method === 'POST' && url.pathname === '/api/config') {
    const now = Date.now();
    const address = request.socket.remoteAddress || 'unknown';
    const failures = configFailures.get(address);
    if (failures?.blockedUntil > now) return sendJson(response, 429, { error: 'Muitas tentativas. Aguarde 15 minutos.' });
    const providedPassword = request.headers['x-setup-password'] || '';
    let bootstrapping = false;
    if (!process.env.SETUP_PASSWORD) {
      if (!isLoopbackAddress(address)) return sendJson(response, 503, { error: 'Defina SETUP_PASSWORD no .env antes de configurar este servidor remotamente.' });
      if (typeof providedPassword !== 'string' || providedPassword.length < 16) return sendJson(response, 400, { error: 'Crie uma senha de administração com pelo menos 16 caracteres.' });
      bootstrapping = true;
    } else if (!verifySetupPassword(request)) {
      const count = (failures?.count || 0) + 1;
      configFailures.set(address, count >= 5 ? { count, blockedUntil: now + 15 * 60 * 1000 } : { count, blockedUntil: 0 });
      return sendJson(response, 401, { error: 'Senha de administração incorreta.' });
    }
    configFailures.delete(address);
    try {
      const body = await readBody(request, 30000);
      const values = {};
      for (const key of configurableKeys) {
        if (key === 'SETUP_PASSWORD' && !bootstrapping) continue;
        if (body[key] === undefined || body[key] === '') continue;
        if (typeof body[key] !== 'string' || body[key].length > 4096) return sendJson(response, 400, { error: `Valor inválido para ${key}.` });
        values[key] = body[key].trim();
      }
      if (bootstrapping) values.SETUP_PASSWORD = providedPassword;
      if (values.AI_PROVIDER && !['openai', 'anthropic', 'gemini'].includes(values.AI_PROVIDER)) return sendJson(response, 400, { error: 'Selecione OpenAI, Anthropic ou Gemini.' });
      if (values.WAPI_API_URL && !/^https:\/\//i.test(values.WAPI_API_URL)) return sendJson(response, 400, { error: 'A URL da WAPI precisa usar HTTPS.' });
      if (!Object.keys(values).length) return sendJson(response, 400, { error: 'Preencha ao menos um campo. Campos vazios mantêm a configuração atual.' });
      saveLocalEnv(values);
      return sendJson(response, 200, { saved: true, status: configurationStatus() });
    } catch (error) {
      return sendJson(response, error.status || 500, { error: error.message || 'Não foi possível salvar as configurações.' });
    }
  }
  if (request.method === 'POST' && ['/api/ask', '/api/alert'].includes(url.pathname)) {
    try {
      const body = await readBody(request);
      const result = url.pathname === '/api/ask' ? await askVisionAssistant(body) : await sendAlert(body);
      return sendJson(response, result.status, result.data);
    } catch (error) {
      return sendJson(response, error.status || 502, { error: error.message || 'Falha ao processar solicitação.' });
    }
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') return sendJson(response, 405, { error: 'Método não permitido.' });
  const requestedPath = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const filePath = path.resolve(root, `.${requestedPath}`);
  if (!filePath.startsWith(`${root}${path.sep}`) && filePath !== path.join(root, 'index.html')) return sendJson(response, 403, { error: 'Acesso negado.' });
  fs.stat(filePath, (error, stat) => {
    if (error || !stat.isFile()) return sendJson(response, 404, { error: 'Arquivo não encontrado.' });
    response.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store' });
    if (request.method === 'HEAD') return response.end();
    fs.createReadStream(filePath).pipe(response);
  });
});

server.listen(port, '0.0.0.0', () => console.log(`Óculos Assistivos disponível em http://localhost:${port}`));