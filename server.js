// server.js
// Node/Express backend for Recall Trader Dashboard
// Support: Local simulated trades + Recall API integration + Simple transactions

const axios = require("axios");
const express = require("express");
const path = require("path");
const cors = require("cors");
const fs = require("fs-extra");
const bodyParser = require("body-parser");
require("dotenv").config();

// -------------------------
// Config
// -------------------------
const app = express();
app.use(cors());
app.use(express.json());
app.use(bodyParser.json()); // redundant with express.json but harmless
app.use(express.urlencoded({ extended: true }));

// Serve static frontend if exists
app.use(express.static(path.join(__dirname, "public")));

const DATA_DIR = path.join(__dirname, "data");
const TRADES_FILE = path.join(DATA_DIR, "trades.json");

fs.ensureDirSync(DATA_DIR);
if (!fs.existsSync(TRADES_FILE)) {
  fs.writeJsonSync(TRADES_FILE, { trades: [] }, { spaces: 2 });
}

// Environment variables (consistent names)
const RECALL_API_KEY = process.env.RECALL_API_KEY || "";
const RECALL_API_BASE = process.env.RECALL_API_BASE || "https://api.recall.network";

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
  if (!["buy", "sell"].includes((body.action || "").toLowerCase()))
    return "action must be buy or sell";
  if (isNaN(Number(body.amount)) || Number(body.amount) <= 0)
    return "amount must be positive number";
  return null;
}

async function apiFetch(path, opts = {}) {
  if (!RECALL_API_KEY) {
    throw new Error("RECALL_API_KEY is not set");
  }
  try {
    const res = await axios({
      url: `${RECALL_API_BASE}${path}`,
      headers: { Authorization: `Bearer ${RECALL_API_KEY}` },
      ...opts,
    });
    return res.data;
  } catch (err) {
    // bubble up with more info
    const message = err.response?.data || err.message;
    const status = err.response?.status || 500;
    const e = new Error(`API fetch error: ${JSON.stringify(message)}`);
    e.status = status;
    throw e;
  }
}

// -------------------------
// Recall API helpers
// -------------------------
async function fetchCompetitions() {
  if (!RECALL_API_KEY) {
    // If no API key, fail fast: caller can fallback to seed data
    throw new Error("RECALL_API_KEY is not configured");
  }
  const url = `${RECALL_API_BASE}/competitions`;
  const resp = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${RECALL_API_KEY}`,
      "Content-Type": "application/json",
    },
  });
  return resp.data;
}

async function submitTransactionToRecall(submitData) {
  if (!RECALL_API_KEY) {
    throw new Error("RECALL_API_KEY is not configured");
  }
  const url = `${RECALL_API_BASE}/competitions/submit`; // adjust if Recall endpoint differs
  const resp = await axios.post(url, submitData, {
    headers: {
      Authorization: `Bearer ${RECALL_API_KEY}`,
      "Content-Type": "application/json",
    },
  });
  return resp.data;
}

// -------------------------
// Routes (Trade / Bridge / Portfolio)
// -------------------------
app.post("/api/trade", async (req, res) => {
  try {
    const err = validateTrade(req.body);
    if (err) return res.status(400).json({ ok: false, error: err });

    const payload = {
      id: `t_${Date.now()}`,
      timestamp: new Date().toISOString(),
      ...req.body,
      status: "executed",
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
      status: "completed",
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

app.get("/api/trades", async (req, res) => {
  try {
    const data = await readTrades();
    return res.json({ ok: true, trades: data.trades });
  } catch (err) {
    console.error("Error reading trades:", err);
    return res.status(500).json({ ok: false, error: "Failed to read trades" });
  }
});

app.get("/api/portfolio", async (req, res) => {
  try {
    if (RECALL_API_KEY) {
      try {
        const data = await apiFetch("/portfolio");
        return res.json(data);
      } catch (e) {
        // Log and fallback to local computed portfolio
        console.warn("Recall portfolio fetch failed, falling back to local:", e.message);
      }
    }

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
  } catch (err) {
    console.error("Portfolio error:", err);
    return res.status(500).json({ ok: false, error: "Failed to compute portfolio" });
  }
});

// -------------------------
// Recall API routes
// - GET /api/competitions  -> fetch competitions (proxy)
// - POST /api/submit       -> submit a competition/trade payload to Recall API
// -------------------------
app.get("/api/competitions", async (req, res) => {
  try {
    // If no API key, return helpful message so frontend can fallback to seed data
    if (!RECALL_API_KEY) {
      return res.status(400).json({
        ok: false,
        error: "RECALL_API_KEY is not configured. Provide RECALL_API_KEY to fetch live competitions.",
      });
    }
    const data = await fetchCompetitions();
    return res.json({ ok: true, data });
  } catch (err) {
    console.error("Error fetch competitions:", err.message || err);
    const status = err.status || 500;
    return res.status(status).json({ ok: false, error: String(err.message || err) });
  }
});

/**
 * POST /api/submit
 * Accepts either a generic submit payload or the common fields:
 * { competitionId, tradeType, asset, amount } and forwards to Recall submit endpoint.
 */
app.post("/api/submit", async (req, res) => {
  try {
    const submitData = req.body || {};

    if (!RECALL_API_KEY) {
      return res.status(400).json({ ok: false, error: "RECALL_API_KEY is not configured" });
    }

    // Basic validation for common shorthand payload
    if (!submitData.competitionId && (submitData.competition_id || submitData.id)) {
      submitData.competitionId = submitData.competition_id || submitData.id;
    }

    // At minimum require some identifying fields (this is flexible; adapt to Recall API spec)
    if (!submitData || Object.keys(submitData).length === 0) {
      return res.status(400).json({ ok: false, error: "Empty submit payload" });
    }

    const result = await submitTransactionToRecall(submitData);
    return res.json({ ok: true, result });
  } catch (err) {
    console.error("Error submit transaction:", err.response?.data || err.message || err);
    const status = err.status || err.response?.status || 500;
    return res.status(status).json({ ok: false, error: err.response?.data || String(err.message) });
  }
});

// -------------------------
// Simple in-memory transaction endpoints
// -------------------------
let transactions = [];

app.post("/api/transaction", (req, res) => {
  try {
    const { asset, quantity, price, action } = req.body;

    if (!asset || !quantity || !price || !action) {
      return res
        .status(400)
        .json({ success: false, error: "Parameter tidak lengkap" });
    }

    const id = transactions.length + 1;
    const total = Number(quantity) * Number(price);
    const tx = {
      id,
      asset,
      quantity: Number(quantity),
      price: Number(price),
      action,
      total,
      timestamp: new Date().toISOString(),
    };

    transactions.push(tx);
    return res.json({ success: true, transaction: tx });
  } catch (err) {
    console.error("Error submit transaksi:", err);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
});

app.get("/api/transactions", (req, res) => {
  res.json({ transactions });
});

// -------------------------
// Manual Trade with Recall API (kept as separate endpoint for clarity)
// - POST /manual-trade
// -------------------------
app.post("/manual-trade", async (req, res) => {
  try {
    const { competitionId, fromChain, toChain, token, amount, action } =
      req.body || {};

    if (!competitionId || !fromChain || !toChain || !token || !amount || !action) {
      return res.status(400).json({ error: "Invalid parameters" });
    }

    if (!RECALL_API_KEY) {
      return res.status(400).json({ error: "RECALL_API_KEY is not configured" });
    }

    // Build payload for Recall API - adapt fields to the actual Recall schema as needed
    const payload = {
      competitionId,
      fromChain,
      toChain,
      token,
      amount,
      action,
    };

    const response = await axios.post(
      `${RECALL_API_BASE}/competitions/submit`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RECALL_API_KEY}`,
        },
      }
    );

    // Simpan hasil transaksi ke trades.json
    const tradePayload = {
      id: `m_${Date.now()}`,
      timestamp: new Date().toISOString(),
      competitionId,
      fromChain,
      toChain,
      token,
      amount,
      action,
      result: response.data,
      status: "submitted",
    };

    const data = await readTrades();
    data.trades.push(tradePayload);
    await writeTrades(data);

    res.json({ success: true, trade: tradePayload });
  } catch (err) {
    console.error("Manual trade error:", err.response?.data || err.message || err);
    const status = err.response?.status || 500;
    return res.status(status).json({ error: err.response?.data || String(err.message) });
  }
});

// -------------------------
// Get all manual trades
// -------------------------
app.get("/manual-trades", async (req, res) => {
  try {
    const data = await readTrades();
    const manualTrades = data.trades.filter((t) => typeof t.id === "string" && t.id.startsWith("m_"));
    res.json({ ok: true, manualTrades });
  } catch (err) {
    console.error("Failed to load manual trades:", err);
    res.status(500).json({ error: "Failed to load manual trades" });
  }
});

// -------------------------
// Fallback -> serve frontend (index.html)
// -------------------------
app.get("*", (req, res) => {
  const indexPath = path.join(__dirname, "public", "index.html");
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  return res.status(404).send("Not Found");
});

// -------------------------
// Start Server
// -------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
});
