// server.js
// Recall Competitions proxy + static frontend
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Config
const PORT = process.env.PORT || 3000;
// Default to competitions API (production). Use sandbox by setting RECALL_API_URL to sandbox URL in .env
const DEFAULT_RECALL_API_URL = 'https://api.competitions.recall.network/api';
const RECALL_API_URL = process.env.RECALL_API_URL || DEFAULT_RECALL_API_URL;
const RECALL_API_KEY = process.env.RECALL_API_KEY || '';

// Serve frontend static files
app.use('/', express.static(path.join(__dirname, 'frontend')));

// Helper: call Recall Competitions API with proper headers
async function recallRequest(method, endpoint, data = {}, params = {}) {
  if (!RECALL_API_URL) return { error: true, message: 'no_api' };
  const url = (endpoint.startsWith('http')) ? endpoint : `${RECALL_API_URL}${endpoint}`;
  const headers = { 'Content-Type': 'application/json' };
  if (RECALL_API_KEY) headers['Authorization'] = `Bearer ${RECALL_API_KEY}`;
  try {
    const resp = await axios({ method, url, headers, data, params, timeout: 10000 });
    return resp.data;
  } catch (err) {
    // unify error
    return { error: true, message: err.response?.data || err.message || 'request_err' };
  }
}

/*
  Routes implemented (aligned with docs):
  - GET  /api/health                  -> GET ${RECALL_API_URL}/health
  - GET  /api/price?token=...&chain=evm&specificChain=eth
  - GET  /api/portfolio               -> GET /agent/portfolio  (best-effort)
  - GET  /api/recent-trades
  - POST /api/trade/execute
*/

// Health check
app.get('/api/health', async (req, res) => {
  const r = await recallRequest('get', '/health');
  if (!r.error) return res.json(r);
  res.status(502).json(r);
});

// Price endpoint: proxy to /price?token=...&chain=...&specificChain=...
app.get('/api/price', async (req, res) => {
  const { token, chain, specificChain } = req.query;
  // If no token provided, return error (docs require token)
  if (!token) {
    return res.status(400).json({ error: 'missing_param', message: 'token query param required' });
  }
  const params = { token, chain, specificChain };
  const r = await recallRequest('get', '/price', {}, params);
  if (!r.error) return res.json(r);

  // fallback: simple mocked shape (candles)
  const now = Date.now();
  const candles = Array.from({ length: 80 }).map((_,i) => {
    const t = new Date(now - (80 - i) * 60 * 1000).toISOString();
    const base = 100 + i * 0.2 + Math.sin(i / 6);
    const o = +(base + (Math.random()-0.5)*1.2).toFixed(4);
    const c = +(base + (Math.random()-0.5)*1.2).toFixed(4);
    const h = Math.max(o, c) + +(Math.random()*1.2).toFixed(4);
    const l = Math.min(o, c) - +(Math.random()*1.2).toFixed(4);
    const v = Math.round(500 + Math.random()*4000);
    return { t, o, h, l, c, v };
  });
  res.json({ success: true, token, chain, specificChain, candles });
});

// Portfolio endpoint (best-effort)
app.get('/api/portfolio', async (req, res) => {
  // Docs show portfolio accessible via competition API (patterns differ per integration)
  // We'll try candidate endpoint then fallback
  const tryPaths = ['/agent/portfolio', '/portfolio', '/agent'];
  for (const p of tryPaths) {
    const r = await recallRequest('get', p);
    if (!r.error) return res.json(r);
  }

  // fallback sample
  res.json({
    totalBalanceUsd: 15840.75,
    dailyPnL: -32.41,
    assets: [
      { symbol: 'ETH', balance: 1.18, usd: 3250.25 },
      { symbol: 'BTC', balance: 0.045, usd: 2700.00 },
      { symbol: 'USDC', balance: 8600.5, usd: 8600.5 }
    ]
  });
});

// Recent trades (proxy)
app.get('/api/recent-trades', async (req, res) => {
  const r = await recallRequest('get', '/trade/recent');
  if (!r.error) return res.json(r);

  const now = Date.now();
  res.json([
    { id: 'r1', ts: new Date(now - 2 * 60 * 60 * 1000).toISOString(), pair: 'USDC/ETH', amount: 100, price: 3200, side: 'buy', status: 'filled' },
    { id: 'r2', ts: new Date(now - 5 * 60 * 60 * 1000).toISOString(), pair: 'ETH/BTC', amount: 0.05, price: 21000, side: 'sell', status: 'filled' }
  ]);
});

// Execute trade (per docs: POST /api/trade/execute)
app.post('/api/trade/execute', async (req, res) => {
  const body = req.body || {};
  const required = ['fromToken','toToken','amount','reason'];
  for (const k of required) if (!body[k]) return res.status(400).json({ error: 'missing_field', field: k });

  const r = await recallRequest('post', '/trade/execute', body);
  if (!r.error) return res.json(r);

  // fallback simulation
  res.json({
    success: true,
    tx: {
      id: 'sim-' + Date.now(),
      fromToken: body.fromToken,
      toToken: body.toToken,
      fromAmount: body.amount,
      toAmount: (Number(body.amount) * (Math.random()*0.9 + 0.4)).toFixed(6),
      price: (Math.random() * 100 + 100).toFixed(4),
      ts: new Date().toISOString()
    }
  });
});

// SPA fallback
app.get('*', (req,res) => res.sendFile(path.join(__dirname, 'frontend', 'index.html')));

// Start
app.listen(PORT, () => {
  console.log(`Dashboard server running on http://localhost:${PORT}`);
  if (!RECALL_API_KEY) console.log('⚠️  RECALL_API_KEY not set — fallback/mock data will be used.');
  console.log('Using Recall API base URL:', RECALL_API_URL);
});