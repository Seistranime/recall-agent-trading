// ========== Helper fetch wrapper ==========
async function apiFetch(url, opts = {}) {
  try {
    const res = await fetch(url, opts);
    return await res.json();
  } catch (err) {
    console.error("API error", url, err);
    return null;
  }
}

// ========== Portfolio & Assets ==========
async function loadPortfolio() {
  const data = await apiFetch("/api/portfolio");
  if (!data) return;

  document.getElementById("totalBalance").textContent = `$${data.totalBalanceUsd.toFixed(2)}`;
  document.getElementById("dailyPnL").textContent = `${data.dailyPnL >= 0 ? "+" : ""}${data.dailyPnL.toFixed(2)} USD`;

  if (data.assets) {
    document.getElementById("activeAssets").textContent = data.assets.length;

    const assetList = document.getElementById("assetList");
    if (assetList) {
      assetList.innerHTML = "";
      data.assets.forEach(a => {
        const li = document.createElement("li");
        li.innerHTML = `<span>${a.symbol} (${a.balance})</span><span>$${a.usd.toFixed(2)}</span>`;
        assetList.appendChild(li);
      });
    }
  }
}

// ========== Recent Trades ==========
async function loadRecentTrades() {
  const trades = await apiFetch("/api/recent-trades");
  const list = document.getElementById("recentTrades");
  if (!trades || !list) return;

  list.innerHTML = "";
  trades.forEach(t => {
    const li = document.createElement("li");
    li.textContent = `[${new Date(t.ts || t.timestamp).toLocaleTimeString()}] ${t.side || t.from} → ${t.to || ""} ${t.amount} @ ${t.price} (${t.status})`;
    list.appendChild(li);
  });
}

// ========== Price Chart ==========
let priceChart;

async function loadPriceChart(symbol = "ETH") {
  const data = await apiFetch(`/api/price?symbol=${symbol}`);
  if (!data || !data.candles) return;

  const ctx = document.getElementById("candlestickChart").getContext("2d");
  if (priceChart) priceChart.destroy();

  priceChart = new Chart(ctx, {
    type: "candlestick",
    data: {
      datasets: [{
        label: `${symbol} / USD`,
        data: data.candles.map(c => ({
          x: new Date(c.t),
          o: c.o,
          h: c.h,
          l: c.l,
          c: c.c
        })),
        borderColor: "#00c896",
        color: {
          up: "#00c896",
          down: "#ff5c5c",
          unchanged: "#999"
        }
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: "#e6edf3" } }
      },
      scales: {
        x: {
          ticks: { color: "#8b949e" },
          grid: { color: "#30363d" }
        },
        y: {
          ticks: { color: "#8b949e" },
          grid: { color: "#30363d" }
        }
      }
    }
  });
}

// ========== Manual Trading ==========
function setupTradeForm() {
  const form = document.getElementById("tradeForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = Object.fromEntries(new FormData(form).entries());

    const resp = await apiFetch("/api/trade/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData)
    });

    alert(resp?.success ? "Trade executed ✅" : `Trade failed ❌: ${resp?.message || "unknown"}`);
    loadRecentTrades();
  });
}

// ========== Agent Status ==========
function updateAgentStatus() {
  const el = document.getElementById("agentState");
  if (!el) return;

  // contoh random status (bisa diganti dengan API nanti)
  const states = ["active", "stopped", "error", "pending"];
  const state = states[Math.floor(Math.random() * states.length)];

  el.textContent = state;
  el.className = "status-pill " + state;
}

// ========== Init ==========
async function init() {
  await loadPortfolio();
  await loadRecentTrades();
  await loadPriceChart("ETH");
  setupTradeForm();
  updateAgentStatus();

  // refresh setiap 30 detik
  setInterval(loadPortfolio, 30000);
  setInterval(loadRecentTrades, 30000);
  setInterval(() => loadPriceChart("ETH"), 60000);
  setInterval(updateAgentStatus, 20000);
}

document.addEventListener("DOMContentLoaded", init);

// contoh memanggil price untuk WETH on EVM/eth
const tokenWETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const priceResp = await fetch(`/api/price?token=${encodeURIComponent(tokenWETH)}&chain=evm&specificChain=eth`).then(r=>r.json());
