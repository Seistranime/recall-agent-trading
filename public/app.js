// app.js - simple frontend interactions
async function postJSON(url, body) {
  const res = await fetch(url, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body) });
  return res.json();
}

document.getElementById('tradeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fm = e.target;
  const data = {
    fromChainType: fm.fromChainType.value,
    fromSpecific: fm.fromSpecific.value.trim(),
    toChainType: fm.toChainType.value,
    toSpecific: fm.toSpecific.value.trim(),
    action: fm.action.value,
    fromToken: fm.fromToken.value.trim(),
    toToken: fm.toToken.value.trim(),
    amount: fm.amount.value,
    reason: fm.reason.value.trim()
  };
  const res = await postJSON('/api/trade', data);
  const el = document.getElementById('tradeResult');
  if (res.ok) {
    el.textContent = 'Trade recorded: ' + res.trade.id;
    fm.reset();
    refreshPortfolio();
    refreshTrades();
  } else {
    el.textContent = 'Error: ' + (res.error || 'unknown');
  }
});

document.getElementById('bridgeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fm = e.target;
  const data = {
    fromChainType: 'evm',
    fromSpecific: fm.fromSpecific.value.trim(),
    toChainType: 'evm',
    toSpecific: fm.toSpecific.value.trim(),
    token: fm.token.value.trim(),
    amount: fm.amount.value,
    reason: fm.reason.value.trim()
  };
  const res = await postJSON('/api/bridge', data);
  const el = document.getElementById('bridgeResult');
  if (res.ok) {
    el.textContent = 'Bridge completed: ' + res.bridge.id;
    fm.reset();
    refreshPortfolio();
    refreshTrades();
  } else {
    el.textContent = 'Error: ' + (res.error || 'unknown');
  }
});

document.getElementById('refreshBtn').addEventListener('click', refreshPortfolio);

async function refreshPortfolio() {
  const res = await fetch('/api/portfolio');
  const body = await res.json();
  if (!body.ok) return;
  const tbody = document.querySelector('#portfolioTable tbody');
  tbody.innerHTML = '';
  for (const row of body.portfolio) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${row.token}</td><td>${row.balance}</td><td>${row.chain || ''}</td><td>${row.lastUpdated || ''}</td>`;
    tbody.appendChild(tr);
  }
}

async function refreshTrades() {
  const res = await fetch('/api/trades');
  const body = await res.json();
  if (!body.ok) return;
  document.getElementById('allTrades').textContent = JSON.stringify(body.trades, null, 2);
}

// initial
refreshPortfolio();
refreshTrades();
