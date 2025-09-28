// -------------------------
// File: server.js
// -------------------------
// Node/Express backend for Recall Trader Dashboard
// Support: Local simulated trades + Recall API integration
// -------------------------

const express = require("express");
const path = require("path");
const cors = require("cors");
const fs = require("fs-extra");
const axios = require("axios");
require("dotenv").config();

// -------------------------
// Config
// -------------------------
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const DATA_DIR = path.join(__dirname, "data");
const TRADES_FILE = path.join(DATA_DIR, "trades.json");

fs.ensureDirSync(DATA_DIR);
if (!fs.existsSync(TRADES_FILE))
  fs.writeJsonSync(TRADES_FILE, { trades: [] }, { spaces: 2 });

const RECALL_API_KEY = process.env.RECALL_API_KEY || "";
const RECALL_BASE = "https://api.recall.network";

// -------------------------
// Helpers
// -------------------------
async function readTrades() {
  return fs.readJson(TRADES_FILE);
}
async function writeTrades(data) {
  return fs.writeJson(TRADES_FILE, data, { spaces: 2 });
}

function validateTrade(body) {
  const required = [
    "fromChainType",
    "fromSpecific",
    "toChainType",
    "toSpecific",
    "action",
    "fromToken",
    "toToken",
    "amount",
    "reason",
  ];
  for (const r of required) if (!(r in body)) return `Missing field ${r}`;
  if (!["buy", "sell"].includes(body.action))
    return "action must be buy or sell";
  if (isNaN(Number(body.amount)) || Number(body.amount) <= 0)
    return "amount must be positive number";
  return null;
}

async function apiFetch(path, opts = {}) {
  try {
    const res = await axios({
      url: `${RECALL_BASE}${path}`,
      headers: { Authorization: `Bearer ${RECALL_API_KEY}` },
      ...opts,
    });
    return res.data;
  } catch (err) {
    console.error("API fetch error:", err.message);
    return null;
  }
}

// -------------------------
// Routes
// -------------------------

// POST manual trade
app.post("/api/trade", async (req, res) => {
  try {
    const err = validateTrade(req.body);
    if (err) return res.status(400).json({ ok: false, error: err });

    const payload = {
      id: `t_${Date.now()}`,
      timestamp: new Date().toISOString(),
      ...req.body,
      status: "executed", // simulation
      simPrice: req.body.simPrice || null,
    };

    const data = await readTrades();
    data.trades.push(payload);
    await writeTrades(data);

    return res.json({ ok: true, trade: payload });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

// POST bridge (simulate cross-chain transfer)
app.post("/api/bridge", async (req, res) => {
  try {
    const required = [
      "fromChainType",
      "fromSpecific",
      "toChainType",
      "toSpecific",
      "token",
      "amount",
      "reason",
    ];
    for (const r of required)
      if (!(r in req.body))
        return res.status(400).json({ ok: false, error: `Missing ${r}` });
    if (isNaN(Number(req.body.amount)) || Number(req.body.amount) <= 0)
      return res
        .status(400)
        .json({ ok: false, error: "amount must be positive number" });

    const payload = {
      id: `b_${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: "bridge",
      ...req.body,
      status: "completed", // simulation
    };

    const data = await readTrades();
    data.trades.push(payload);
    await writeTrades(data);

    return res.json({ ok: true, bridge: payload });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

// GET all trades
app.get("/api/trades", async (req, res) => {
  const data = await readTrades();
  return res.json({ ok: true, trades: data.trades });
});

// GET portfolio
app.get("/api/portfolio", async (req, res) => {
  // Try Recall API first
  if (RECALL_API_KEY) {
    const data = await apiFetch("/portfolio");
    if (data) return res.json(data);
  }

  // Fallback: local portfolio simulation
  const data = await readTrades();
  const balances = {};

  for (const t of data.trades) {
    if (t.type === "bridge") continue;

    const action = (t.action || "").toLowerCase();
    const amt = Number(t.amount) || 0;

    if (action === "buy") {
      const token = t.toToken;
      balances[token] = balances[token] || {
        balance: 0,
        lastUpdated: null,
        chain: t.toSpecific,
      };
      balances[token].balance += amt;
      balances[token].lastUpdated = t.timestamp;
    } else if (action === "sell") {
      const token = t.fromToken;
      balances[token] = balances[token] || {
        balance: 0,
        lastUpdated: null,
        chain: t.fromSpecific,
      };
      balances[token].balance -= amt;
      balances[token].lastUpdated = t.timestamp;
    }
  }

  const arr = Object.entries(balances).map(([token, info]) => ({
    token,
    balance: Number(info.balance.toFixed(8)),
    lastUpdated: info.lastUpdated,
    chain: info.chain,
  }));

  return res.json({ ok: true, portfolio: arr });
});

// fallback -> serve frontend
app.get("*", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html"))
);

// -------------------------
// Start Server
// -------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`✅ Server running at http://localhost:${PORT}`)
);
