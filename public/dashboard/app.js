const api = {
  trades: '/api/trades',
  portfolio: '/api/portfolio',
  transaction: '/api/transaction',
  trade: '/api/trade',
  bridge: '/api/bridge',
  competitions: '/api/competitions'
};

function el(id){return document.getElementById(id)}

async function fetchJson(url){
  try{
    const res = await fetch(url);
    if(!res.ok) throw new Error('HTTP '+res.status);
    return await res.json();
  }catch(err){
    console.warn('Fetch failed', url, err.message);
    return null;
  }
}

async function loadTrades(){
  const loading = el('trades-loading');
  const table = el('trades-table');
  const tbody = table.querySelector('tbody');
  loading.classList.remove('hidden'); table.classList.add('hidden');

  let data = await fetchJson(api.trades);
  if(!data){
    // fallback: load static sample bundled in project data
    try{
      const local = await fetch('../../data/trades.json');
      data = await local.json();
    }catch(e){
      data = { trades: [] };
    }
  }

  tbody.innerHTML = '';
  const trades = data.trades || [];
  trades.forEach(t => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${t.id || '-'}</td>
      <td>${new Date(t.timestamp || '').toLocaleString() || '-'}</td>
      <td>${(t.fromSpecific||'')} → ${(t.toSpecific||'')}</td>
      <td>${t.toToken||t.fromToken||'-'}</td>
      <td>${t.amount||'-'}</td>
      <td>${t.action||'-'}</td>
      <td>${t.status||'-'}</td>
    `;
    tbody.appendChild(tr);
  });

  loading.classList.add('hidden'); table.classList.remove('hidden');
}

async function loadPortfolio(){
  const loading = el('portfolio-loading');
  const table = el('portfolio-table');
  const tbody = table.querySelector('tbody');
  loading.classList.remove('hidden'); table.classList.add('hidden');

  let data = await fetchJson(api.portfolio);
  if(!data){
    // compute locally from trades.json
    try{
      const local = await fetch('../../data/trades.json');
      const d = await local.json();
      const balances = {};
      (d.trades||[]).forEach(t => {
        const action = (t.action||'').toLowerCase();
        const amt = Number(t.amount)||0;
        if(action==='buy'){
          const token = t.toToken||'UNKNOWN';
          balances[token]=balances[token]||{balance:0,chain:t.toSpecific};
          balances[token].balance += amt;
        }else if(action==='sell'){
          const token = t.fromToken||'UNKNOWN';
          balances[token]=balances[token]||{balance:0,chain:t.fromSpecific};
          balances[token].balance -= amt;
        }
      });
      data = { ok:true, portfolio: Object.entries(balances).map(([token,i])=>({token,balance:i.balance,chain:i.chain})) };
    }catch(e){ data = { ok:true, portfolio: [] }; }
  }

  tbody.innerHTML = '';
  const list = data.portfolio || [];
  if(list.length===0){
    loading.textContent = 'Tidak ada aset.';
  }else{
    list.forEach(p=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${p.token}</td><td>${p.balance}</td><td>${p.chain||'-'}</td><td>${p.lastUpdated||'-'}</td>`;
      tbody.appendChild(tr);
    });
    loading.classList.add('hidden'); table.classList.remove('hidden');
  }
}

async function loadCompetitions(){
  const loading = el('competitions-loading');
  const list = el('competitions-list');
  loading.classList.remove('hidden'); list.textContent = '';

  const data = await fetchJson(api.competitions);
  if(!data || !data.ok){
    loading.textContent = 'Competitions unavailable (no API key).';
    return;
  }

  const items = data.data || [];
  if(items.length===0){ loading.textContent = 'No competitions found.'; return; }
  loading.classList.add('hidden');
  const ul = document.createElement('ul');
  items.forEach(c=>{
    const li = document.createElement('li');
    li.textContent = `${c.id||c.name||'-'} — ${c.description||''}`;
    ul.appendChild(li);
  });
  list.appendChild(ul);
}

async function loadTransactions(){
  const res = await fetchJson(api.transaction.replace('/api/','/api/'));
  const elList = el('tx-list');
  try{
    const r = await fetch('/api/transactions');
    const d = await r.json();
    if(d.transactions && d.transactions.length>0){
      elList.innerHTML = '';
      d.transactions.forEach(tx=>{
        const div = document.createElement('div');
        div.textContent = `${tx.id}: ${tx.asset} ${tx.quantity} @ ${tx.price} (${tx.action})`;
        elList.appendChild(div);
      });
    }
  }catch(e){ elList.textContent = 'Tidak ada transaksi.' }
}

// wire forms
document.addEventListener('DOMContentLoaded', ()=>{
  // dark toggle
  document.getElementById('toggle-dark').addEventListener('click', (e)=>{
    document.body.classList.toggle('dark');
    e.target.textContent = document.body.classList.contains('dark') ? '☀ Light' : '🌙 Dark';
  });

  document.getElementById('refresh-all').addEventListener('click', ()=>{ loadAll(); });

  // tx form
  const txForm = document.getElementById('tx-form');
  txForm.addEventListener('submit', async e=>{
    e.preventDefault();
    const payload = { asset: el('asset').value, quantity: Number(el('quantity').value), price: Number(el('price').value), action: el('action').value };
    el('tx-result').textContent = 'Mengirim...';
    try{
      const r = await fetch(api.transaction, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
      const d = await r.json();
      if(d.success){ el('tx-result').textContent = '✔ Transaksi berhasil'; loadTransactions(); }
      else el('tx-result').textContent = '❌ '+(d.error||'failed');
    }catch(err){ el('tx-result').textContent = '❌ '+err.message }
  });

  // manual trade form
  const mform = document.getElementById('manual-trade-form');
  mform.addEventListener('submit', async e=>{
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(mform).entries());
    el('manual-output').textContent = 'Submitting...';
    try{
      const r = await fetch(api.trade, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
      const d = await r.json();
      el('manual-output').textContent = JSON.stringify(d, null, 2);
      loadTrades(); loadPortfolio();
    }catch(err){ el('manual-output').textContent = 'Error: '+err.message }
  });

  // bridge form
  const bridgeForm = document.getElementById('bridge-form');
  if(bridgeForm){
    bridgeForm.addEventListener('submit', async e=>{
      e.preventDefault();
      const payload = Object.fromEntries(new FormData(bridgeForm).entries());
      const out = el('bridge-result'); out.textContent = 'Submitting...';
      try{
        const r = await fetch(api.bridge, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
        const d = await r.json();
        out.textContent = JSON.stringify(d, null, 2);
        loadTrades();
      }catch(err){ out.textContent = 'Error: '+err.message }
    });
  }

  loadAll();
});

async function loadAll(){
  await Promise.allSettled([loadTrades(), loadPortfolio(), loadCompetitions(), loadTransactions()]);
}