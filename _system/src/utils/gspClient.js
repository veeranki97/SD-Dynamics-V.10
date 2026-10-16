const KEY = 'sd_gsp_settings';

function getGspSettings() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') || {};
  } catch {
    return {};
  }
}

/**
 * Level-2 GSP client (generic REST).
 * Credentials live in localStorage key sd_gsp_settings (same as EinvoiceSettingsPanel).
 * All outbound calls go through POST /api/gsp/forward to avoid browser CORS.
 *
 * Path map is configurable per GSP vendor — adjust in Settings notes or pathOverrides.
 * Default paths match common GSP-style routes (auth / gstr1 save-file / status).
 * Sandbox + simulateSandbox=true returns a local mock ARN without calling the network.
 */

const DEFAULT_PATHS = {
  auth: '/authentication/authtoken',
  gstr1Save: '/gstr1/retsave',
  gstr1File: '/gstr1/retfile',
  gstr3bSave: '/gstr3b/retsave',
  gstr3bFile: '/gstr3b/retfile',
  retStatus: '/gstr/retstatus',
  ping: '/authentication/authtoken',
};

export function loadGspConfig() {
  const c = typeof getGspSettings === 'function' ? getGspSettings() : {};
  return {
    enabled: !!c.enabled,
    gspName: c.gspName || '',
    apiBaseUrl: (c.apiBaseUrl || '').replace(/\/$/, ''),
    clientId: c.clientId || '',
    clientSecret: c.clientSecret || '',
    gstin: (c.gstin || '').toUpperCase().trim(),
    environment: c.environment || 'sandbox',
    username: c.username || '',
    password: c.password || '',
    simulateSandbox: c.simulateSandbox !== false, // default ON for safety
    pathOverrides: c.pathOverrides || {},
  };
}

export function isGspFilingReady() {
  const c = loadGspConfig();
  return !!(
    c.enabled &&
    c.apiBaseUrl &&
    c.clientId &&
    c.gstin.length === 15 &&
    c.username
  );
}

function paths(cfg) {
  return { ...DEFAULT_PATHS, ...(cfg.pathOverrides || {}) };
}

async function forward(cfg, method, path, body, headers = {}) {
  const res = await fetch('/api/gsp/forward', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      baseUrl: cfg.apiBaseUrl,
      method: method || 'POST',
      path,
      body: body || null,
      headers: {
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret || '',
        gstin: cfg.gstin,
        ...headers,
      },
      environment: cfg.environment,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || data.message || `GSP HTTP ${res.status}`);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

/** Auth token from GSP (or mock). */
export async function gspAuthenticate(otp = '') {
  const cfg = loadGspConfig();
  if (!cfg.enabled) throw new Error('GSP is disabled in Settings → E-Invoice / GSP');
  if (!cfg.apiBaseUrl || !cfg.clientId || cfg.gstin.length !== 15) {
    throw new Error('Complete API URL, Client ID and 15-digit GSTIN first');
  }

  if (cfg.environment === 'sandbox' && cfg.simulateSandbox) {
    return {
      simulated: true,
      auth_token: 'SIM-TOKEN-' + Date.now(),
      sek: 'SIM-SEK',
      message: 'Sandbox simulate — no network call. Turn off “Simulate sandbox” to hit real GSP.',
    };
  }

  const p = paths(cfg);
  const payload = {
    username: cfg.username,
    password: cfg.password,
    gstin: cfg.gstin,
    otp: otp || undefined,
  };
  const data = await forward(cfg, 'POST', p.auth, payload);
  return data?.data || data;
}

/**
 * Save then file a return payload (GSTR-1 or GSTR-3B JSON object already built by GSTReturns).
 * returnType: 'gstr1' | 'gstr3b'
 */
export async function gspSubmitReturn({ returnType, retPeriod, payload, otp = '', authToken = '' }) {
  const cfg = loadGspConfig();
  if (!isGspFilingReady() && !(cfg.environment === 'sandbox' && cfg.simulateSandbox && cfg.enabled)) {
    throw new Error('Enable GSP and fill credentials (or use sandbox simulate)');
  }

  let token = authToken;
  if (!token) {
    const auth = await gspAuthenticate(otp);
    token = auth.auth_token || auth.AuthToken || auth.token || '';
  }

  if (cfg.environment === 'sandbox' && cfg.simulateSandbox) {
    const arn = `SB/${cfg.gstin || 'GSTIN'}/${retPeriod || '00'}/${returnType.toUpperCase()}/${Date.now().toString(36).toUpperCase()}`;
    return {
      simulated: true,
      status: 'filed-simulated',
      arn,
      retPeriod,
      returnType,
      message: 'Simulated sandbox file — not sent to GSTN. Disable simulate + use real GSP for production.',
    };
  }

  const p = paths(cfg);
  const savePath = returnType === 'gstr3b' ? p.gstr3bSave : p.gstr1Save;
  const filePath = returnType === 'gstr3b' ? p.gstr3bFile : p.gstr1File;

  const saveBody = {
    gstin: cfg.gstin,
    ret_period: retPeriod,
    data: payload,
  };

  await forward(cfg, 'PUT', savePath, saveBody, { Authorization: token, auth_token: token });
  const filed = await forward(cfg, 'POST', filePath, {
    gstin: cfg.gstin,
    ret_period: retPeriod,
  }, { Authorization: token, auth_token: token });

  const arn =
    filed?.arn ||
    filed?.ARN ||
    filed?.data?.arn ||
    filed?.reference_id ||
    filed?.data?.reference_id ||
    null;

  return {
    simulated: false,
    status: 'filed',
    arn,
    raw: filed,
    retPeriod,
    returnType,
  };
}

export async function gspTestConnectivity() {
  const cfg = loadGspConfig();
  if (!cfg.apiBaseUrl) throw new Error('API base URL missing');
  if (cfg.environment === 'sandbox' && cfg.simulateSandbox) {
    return { ok: true, simulated: true, message: 'Sandbox simulate mode — proxy not called' };
  }
  // HEAD/GET style via forward to auth path with empty body may 401 — treat reachable
  try {
    await forward(cfg, 'POST', paths(cfg).ping, {
      username: cfg.username || 'ping',
      password: cfg.password || '',
      gstin: cfg.gstin || '',
    });
    return { ok: true, simulated: false, message: 'GSP responded' };
  } catch (e) {
    // 401/400 still means host is reachable
    if (e.status && e.status < 500) {
      return { ok: true, simulated: false, message: `Host reachable (HTTP ${e.status}) — check username/OTP` };
    }
    throw e;
  }
}
