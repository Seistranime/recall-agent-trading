// -------------------------
// File: server.js
// -------------------------
// Node/Express backend for Recall Trader Dashboard
// Support: Local simulated trades + Recall API integration + Simple transactions
// -------------------------

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
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

const DATA_DIR = path.join(__dirname, "data");
const TRADES_FILE = path.join(DATA_DIR, "trades.json");

fs.ensureDirSync(DATA_DIR);
if (!fs.existsSync(TRADES_FILE))
fs.writeJsonSync(TRADES_FILE, { trades: [] }, { spaces: 2 });

const RECALL_API_KEY = process.env.RECALL_API_KEY || "";
const RECALL_API_BASE = process.env.RECALL_API_BASE || "[https://api.recall.network](https://api.recall.network)";

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
url: `${RECALL_API_BASE}${path}`,
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
// Recall API helpers
// -------------------------
async function fetchCompetitions() {
const url = `${RECALL_API_BASE}/competitions`;
const resp = await axios.get(url, {
headers: {
Authorization: `Bearer ${RECALL_API_KEY}`,
"Content-Type": "application/json",
},
});
return resp.data;
}

async function submitTransaction(submitData) {
const url = `${RECALL_API_BASE}/competitions/submit`; // ganti jika endpoint berbeda
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
const data = await readTrades();
return res.json({ ok: true, trades: data.trades });
});

app.get("/api/portfolio", async (req, res) => {
if (RECALL_API_KEY) {
const data = await apiFetch("/portfolio");
if (data) return res.json(data);
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
});

// -------------------------
// Recall API routes
// -------------------------
app.get("/api/competitions", async (req, res) => {
try {
const data = await fetchCompetitions();
res.json(data);
} catch (err) {
console.error("Error fetch competitions:", err.response?.data || err.message);
res.status(500).json({ error: "Failed fetch competitions" });
}
});

app.post("/api/submit", async (req, res) => {
const submitData = req.body;
try {
const result = await submitTransaction(submitData);
res.json(result);
} catch (err) {
console.error("Error submit transaction:", err.response?.data || err.message);
res.status(500).json({ error: "Submit failed" });
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
  return res.status(400).json({ success: false, error: "Parameter tidak lengkap" });
}

const id = transactions.length + 1;
const total = quantity * price;
const tx = {
  id,
  asset,
  quantity,
  price,
  action,
  total,
  timestamp: new Date(),
};

transactions.push(tx);
return res.json({ success: true, transaction: tx });


} catch (err) {
console.error("Error submit transaksi:", err);
return res.status(500).json({ success: false, error: "Internal server error" });
}
});

app.get("/api/transactions", (req, res) => {
res.json({ transactions });
});

// -------------------------
// Manual Trade with Recall API (integrasi dari snippet 2)
// -------------------------
app.post("/manual-trade", async (req, res) => {
try {
const { fromChain, toChain, token, amount, action } = req.body;
if (!fromChain || !toChain || !token || !amount || !action) {
return res.status(400).json({ error: "Invalid parameters" });
}


const response = await axios.post(
  `${RECALL_API_BASE}/competitions`,
  { fromChain, toChain, token, amount, action },
  {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RECALL_API_KEY}`,
    },
  }
);

res.json({ success: true, tx: response.data });


} catch (err) {
console.error("Trade error:", err.response?.data || err.message);
res.status(500).json({ error: err.message });
}
});

// -------------------------
// Fallback -> serve frontend
// -------------------------
app.get("*", (req, res) =>
res.sendFile(path.join(__dirname, "public", "index.html"))
);

// -------------------------
// Start Server
// -------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
console.log(`🚀 Server berjalan di http://localhost:${PORT}`)
);