// server.js
const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs-extra');
require('dotenv').config();

const DATA_DIR = path.join(__dirname, 'data');
const TRADES_FILE = path.join(DATA_DIR, 'trades.json');

fs.ensureDirSync(DATA_DIR);
if (!fs.existsSync(TRADES_FILE)) fs.writeJsonSync(TRADES_FILE, { trades: [] }, { spaces: 2 });

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// helpers
async function readTrades() {
  return fs.readJson(TRADES_FILE);
}
async function writeTrades(data) {
  return fs.writeJson(TRADES_FILE, data, { spaces: 2 });
}

// Validate simple shape for trade
function validateTrade(body) {
  const required = ['fromChainType','fromSpecific','toChainType','toSpecific','action','fromToken','toToken','amount','reason'];
  for (const r of required) if (!(r in body)) return `Missing field ${r}`;
  if (!['buy','sell'].includes(body.action)) return 'action must be buy or sell';
  if (isNaN(Number(body.amount)) || Number(body.amount) <= 0) return 'amount must be positive number';
  return null;
}

// POST manual trade
app.post('/api/trade', async (req, res) => {
  try {
    const err = validateTrade(req.body);
    if (err) return res.status(400).json({ ok:false, error: err });

    const payload = {
      id: `t_${Date.now()}`,
      timestamp: new Date().toISOString(),
      ...req.body,
      status: 'executed', // simulation: executed immediately
      simPrice: req.body.simPrice || null
    };

    const data = await readTrades();
    data.trades.push(payload);
    await writeTrades(data);
    return res.json({ ok:true, trade: payload });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok:false, error: String(e) });
  }
});

// POST bridge (simulate cross-chain transfer)
app.post('/api/bridge', async (req, res) => {
  try {
    const required = ['fromChainType','fromSpecific','toChainType','toSpecific','token','amount','reason'];
    for (const r of required) if (!(r in req.body)) return res.status(400).json({ ok:false, error: `Missing ${r}`});
    if (isNaN(Number(req.body.amount)) || Number(req.body.amount) <= 0) return res.status(400).json({ ok:false, error: 'amount must be positive number'});

    const payload = {
      id: `b_${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'bridge',
      ...req.body,
      status: 'completed' // simulation
    };
    const data = await readTrades();
    data.trades.push(payload);
    await writeTrades(data);
    return res.json({ ok:true, bridge: payload });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok:false, error: String(e) });
  }
});

// GET all trades
app.get('/api/trades', async (req, res) => {
  const data = await readTrades();
  return res.json({ ok:true, trades: data.trades });
});

// GET portfolio — aggregate from executed buy/sell trades (simple model)
// We'll assume: buy increases token balances, sell decreases; amount is in 'fromToken' for sells, or in 'toToken' for buys depending on action.
// For simplicity: treat 'buy' as adding `toToken: amount`, and 'sell' as subtracting `fromToken: amount`.
// This is a simulation; adapt to your real accounting.
app.get('/api/portfolio', async (req, res) => {
  const data = await readTrades();
  const balances = {}; // { token: { balance: number, lastUpdated: iso } }

  for (const t of data.trades) {
    if (t.type === 'bridge') {
      // bridging does not change total supply here (we'll not alter balances), but could be logged if needed
      continue;
    }
    const action = (t.action || '').toLowerCase();
    const amt = Number(t.amount) || 0;

    if (action === 'buy') {
      // add toToken
      const token = t.toToken;
      balances[token] = balances[token] || { balance: 0, lastUpdated: null, chain: t.toSpecific };
      balances[token].balance += amt;
      balances[token].lastUpdated = t.timestamp;
    } else if (action === 'sell') {
      const token = t.fromToken;
      balances[token] = balances[token] || { balance: 0, lastUpdated: null, chain: t.fromSpecific };
      balances[token].balance -= amt;
      balances[token].lastUpdated = t.timestamp;
    }
  }

  // convert to array
  const arr = Object.entries(balances).map(([token, info]) => ({
    token,
    balance: Number(info.balance.toFixed(8)),
    lastUpdated: info.lastUpdated,
    chain: info.chain
  }));

  return res.json({ ok:true, portfolio: arr });
});

// fallback to serve index.html
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
