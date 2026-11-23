const SNAPSHOT_TTL_SECONDS = 7 * 24 * 60 * 60;
const MAX_PAYLOAD_LENGTH = 20000;
const RATE_LIMIT_PER_DAY = 20;
const ALLOWED_ORIGINS = new Set([
  'https://kakirui.github.io',
  'http://127.0.0.1:8768',
  'http://localhost:8768'
]);

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://kakirui.github.io',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Vary': 'Origin'
  };
}

function json(request, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      'Content-Type': 'application/json; charset=utf-8'
    }
  });
}

function randomId() {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function validId(value) {
  return /^[A-Za-z0-9_-]{10,32}$/.test(value);
}

async function belowDailyRateLimit(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
  const hash = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '').slice(0, 20);
  const day = new Date().toISOString().slice(0, 10);
  const key = `rate:${hash}:${day}`;
  const used = Number(await env.SNAPSHOTS.get(key) || 0);
  if(used >= RATE_LIMIT_PER_DAY) return false;
  await env.SNAPSHOTS.put(key, String(used + 1), { expirationTtl: 24 * 60 * 60 });
  return true;
}

async function createSnapshot(request, env) {
  const origin = request.headers.get('Origin') || '';
  if(!ALLOWED_ORIGINS.has(origin)) return json(request, { error: 'origin_not_allowed' }, 403);
  if(!env.SNAPSHOTS) return json(request, { error: 'storage_not_configured' }, 503);
  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if(contentLength > MAX_PAYLOAD_LENGTH) return json(request, { error: 'payload_too_large' }, 413);
  if(!await belowDailyRateLimit(request, env)) {
    return json(request, { error: 'rate_limit' }, 429);
  }

  let raw;
  let body;
  try {
    raw = await request.text();
    if(raw.length > MAX_PAYLOAD_LENGTH) return json(request, { error: 'payload_too_large' }, 413);
    body = JSON.parse(raw);
  } catch (_) {
    return json(request, { error: 'invalid_json' }, 400);
  }
  const data = String(body?.d || '');
  if(data.length < 20 || data.length > MAX_PAYLOAD_LENGTH || !/^[A-Za-z0-9_-]+$/.test(data)) {
    return json(request, { error: 'invalid_payload' }, 400);
  }

  let id = randomId();
  for(let attempt = 0; attempt < 3; attempt++) {
    if(!await env.SNAPSHOTS.get(`snapshot:${id}`)) break;
    id = randomId();
  }
  await env.SNAPSHOTS.put(`snapshot:${id}`, data, { expirationTtl: SNAPSHOT_TTL_SECONDS });
  return json(request, { id, expiresIn: SNAPSHOT_TTL_SECONDS }, 201);
}

async function readSnapshot(request, env, id) {
  if(!env.SNAPSHOTS) return json(request, { error: 'storage_not_configured' }, 503);
  if(!validId(id)) return json(request, { error: 'invalid_id' }, 400);
  const data = await env.SNAPSHOTS.get(`snapshot:${id}`);
  if(!data) return json(request, { error: 'not_found' }, 404);
  return json(request, { d: data });
}

export default {
  async fetch(request, env) {
    if(request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
    const url = new URL(request.url);
    if(request.method === 'GET' && url.pathname === '/health') {
      return json(request, { ok: true, service: 'kaki-studio-shortlink' });
    }
    if(request.method === 'POST' && url.pathname === '/api/snapshot') {
      return createSnapshot(request, env);
    }
    const readMatch = url.pathname.match(/^\/api\/snapshot\/([A-Za-z0-9_-]+)$/);
    if(request.method === 'GET' && readMatch) {
      return readSnapshot(request, env, readMatch[1]);
    }
    return json(request, { error: 'not_found' }, 404);
  }
};
