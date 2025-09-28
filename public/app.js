// -------------------------
// File: src/App.js
// -------------------------
import React, { useEffect, useState } from "react";

function App() {
  const [portfolio, setPortfolio] = useState([]);
  const [trades, setTrades] = useState([]);
  const [tradeForm, setTradeForm] = useState({
    fromChainType: "evm",
    fromSpecific: "",
    toChainType: "evm",
    toSpecific: "",
    action: "buy",
    fromToken: "",
    toToken: "",
    amount: "",
    reason: "",
  });
  const [bridgeForm, setBridgeForm] = useState({
    fromSpecific: "",
    toSpecific: "",
    token: "",
    amount: "",
    reason: "",
  });
  const [msg, setMsg] = useState("");

  // Load portfolio & trades
  const refreshPortfolio = async () => {
    try {
      const res = await fetch("/api/portfolio");
      const body = await res.json();
      if (body.ok) setPortfolio(body.portfolio || body.assets || []);
    } catch (err) {
      console.error("Portfolio load error:", err);
    }
  };

  const refreshTrades = async () => {
    try {
      const res = await fetch("/api/trades");
      const body = await res.json();
      if (body.ok) setTrades(body.trades || []);
    } catch (err) {
      console.error("Trades load error:", err);
    }
  };

  useEffect(() => {
    refreshPortfolio();
    refreshTrades();
  }, []);

  // Handle trade form submit
  const submitTrade = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tradeForm),
      });
      const data = await res.json();
      if (data.ok) {
        setMsg(`✅ Trade recorded: ${data.trade.id}`);
        setTradeForm({
          fromChainType: "evm",
          fromSpecific: "",
          toChainType: "evm",
          toSpecific: "",
          action: "buy",
          fromToken: "",
          toToken: "",
          amount: "",
          reason: "",
        });
        refreshPortfolio();
        refreshTrades();
      } else {
        setMsg(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      setMsg(`❌ Network error: ${err.message}`);
    }
  };

  // Handle bridge form submit
  const submitBridge = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        fromChainType: "evm",
        fromSpecific: bridgeForm.fromSpecific,
        toChainType: "evm",
        toSpecific: bridgeForm.toSpecific,
        token: bridgeForm.token,
        amount: bridgeForm.amount,
        reason: bridgeForm.reason,
      };
      const res = await fetch("/api/bridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        setMsg(`✅ Bridge completed: ${data.bridge.id}`);
        setBridgeForm({ fromSpecific: "", toSpecific: "", token: "", amount: "", reason: "" });
        refreshPortfolio();
        refreshTrades();
      } else {
        setMsg(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      setMsg(`❌ Network error: ${err.message}`);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">📊 Recall Agent Trading Dashboard</h1>

      {/* Message */}
      {msg && <div className="p-2 bg-yellow-100 rounded">{msg}</div>}

      {/* Trade Form */}
      <div className="bg-white shadow rounded p-4">
        <h2 className="text-lg font-semibold mb-2">Manual Trade</h2>
        <form onSubmit={submitTrade} className="grid gap-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              placeholder="From Specific"
              value={tradeForm.fromSpecific}
              onChange={(e) => setTradeForm({ ...tradeForm, fromSpecific: e.target.value })}
              className="border p-2 rounded"
            />
            <input
              placeholder="To Specific"
              value={tradeForm.toSpecific}
              onChange={(e) => setTradeForm({ ...tradeForm, toSpecific: e.target.value })}
              className="border p-2 rounded"
            />
            <input
              placeholder="From Token"
              value={tradeForm.fromToken}
              onChange={(e) => setTradeForm({ ...tradeForm, fromToken: e.target.value })}
              className="border p-2 rounded"
            />
            <input
              placeholder="To Token"
              value={tradeForm.toToken}
              onChange={(e) => setTradeForm({ ...tradeForm, toToken: e.target.value })}
              className="border p-2 rounded"
            />
            <input
              placeholder="Amount"
              value={tradeForm.amount}
              onChange={(e) => setTradeForm({ ...tradeForm, amount: e.target.value })}
              className="border p-2 rounded"
            />
            <select
              value={tradeForm.action}
              onChange={(e) => setTradeForm({ ...tradeForm, action: e.target.value })}
              className="border p-2 rounded"
            >
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </select>
          </div>
          <input
            placeholder="Reason"
            value={tradeForm.reason}
            onChange={(e) => setTradeForm({ ...tradeForm, reason: e.target.value })}
            className="border p-2 rounded"
          />
          <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
            Submit Trade
          </button>
        </form>
      </div>

      {/* Bridge Form */}
      <div className="bg-white shadow rounded p-4">
        <h2 className="text-lg font-semibold mb-2">Bridge</h2>
        <form onSubmit={submitBridge} className="grid gap-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              placeholder="From Specific"
              value={bridgeForm.fromSpecific}
              onChange={(e) => setBridgeForm({ ...bridgeForm, fromSpecific: e.target.value })}
              className="border p-2 rounded"
            />
            <input
              placeholder="To Specific"
              value={bridgeForm.toSpecific}
              onChange={(e) => setBridgeForm({ ...bridgeForm, toSpecific: e.target.value })}
              className="border p-2 rounded"
            />
            <input
              placeholder="Token"
              value={bridgeForm.token}
              onChange={(e) => setBridgeForm({ ...bridgeForm, token: e.target.value })}
              className="border p-2 rounded"
            />
            <input
              placeholder="Amount"
              value={bridgeForm.amount}
              onChange={(e) => setBridgeForm({ ...bridgeForm, amount: e.target.value })}
              className="border p-2 rounded"
            />
          </div>
          <input
            placeholder="Reason"
            value={bridgeForm.reason}
            onChange={(e) => setBridgeForm({ ...bridgeForm, reason: e.target.value })}
            className="border p-2 rounded"
          />
          <button type="submit" className="bg-green-500 text-white px-4 py-2 rounded">
            Submit Bridge
          </button>
        </form>
      </div>

      {/* Portfolio Table */}
      <div className="bg-white shadow rounded p-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-semibold">Portfolio</h2>
          <button onClick={refreshPortfolio} className="bg-gray-200 px-3 py-1 rounded">
            Refresh
          </button>
        </div>
        {portfolio.length === 0 ? (
          <p className="text-gray-500">No assets found</p>
        ) : (
          <table className="w-full border-collapse border border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-2 py-1">Token</th>
                <th className="border px-2 py-1">Balance</th>
                <th className="border px-2 py-1">Chain</th>
                <th className="border px-2 py-1">Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="border px-2 py-1">{row.token || row.symbol}</td>
                  <td className="border px-2 py-1 text-right">{row.balance || row.amount}</td>
                  <td className="border px-2 py-1">{row.chain || ""}</td>
                  <td className="border px-2 py-1">{row.lastUpdated || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Trades Log */}
      <div className="bg-white shadow rounded p-4">
        <h2 className="text-lg font-semibold mb-2">All Trades</h2>
        <pre className="bg-gray-100 p-2 rounded text-sm overflow-x-auto max-h-64">
          {JSON.stringify(trades, null, 2)}
        </pre>
      </div>
    </div>
  );
}

export default App;
