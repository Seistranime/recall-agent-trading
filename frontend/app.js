// frontend/App.js
import React, { useState, useEffect } from "react";

export default function App() {
  const [portfolio, setPortfolio] = useState(null);
  const [tokenAddr, setTokenAddr] = useState("");
  const [priceInfo, setPriceInfo] = useState(null);
  const [fromToken, setFromToken] = useState("");
  const [toToken, setToToken] = useState("");
  const [amount, setAmount] = useState("");
  const [log, setLog] = useState("");

  useEffect(() => {
    fetch("/api/portfolio")
      .then((r) => r.json())
      .then(setPortfolio)
      .catch((e) => setLog("portfolio error: " + e.message));
  }, []);

  const checkPrice = async () => {
    setPriceInfo(null);
    setLog("fetching price...");
    try {
      const params = new URLSearchParams({
        token: tokenAddr,
        chain: "evm",
        specificChain: "eth",
      });
      const res = await fetch("/api/price?" + params.toString());
      const data = await res.json();
      setPriceInfo(data);
      setLog("price fetched");
    } catch (e) {
      setLog("price error: " + e.message);
    }
  };

  const executeTrade = async () => {
    setLog("sending trade...");
    try {
      const res = await fetch("/api/trade/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromToken, toToken, amount }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLog("trade failed: " + JSON.stringify(data));
        return;
      }
      setLog("trade success: " + JSON.stringify(data));
    } catch (e) {
      setLog("trade error: " + e.message);
    }
  };

  return (
    <div style={{ padding: 18, fontFamily: "system-ui, Arial" }}>
      <h2>Recall Trading — Quicktest UI</h2>

      <section>
        <h3>Portfolio</h3>
        <pre style={{ maxHeight: 220, overflow: "auto", background: "#f7f7f7", padding: 10 }}>
          {portfolio ? JSON.stringify(portfolio, null, 2) : "loading..."}
        </pre>
      </section>

      <section>
        <h3>Price check</h3>
        <input
          placeholder="token address (0x...)"
          value={tokenAddr}
          onChange={(e) => setTokenAddr(e.target.value)}
          style={{ width: 480 }}
        />
        <button onClick={checkPrice} style={{ marginLeft: 8 }}>Check Price</button>
        <pre style={{ background: "#f7f7f7", padding: 10 }}>
          {priceInfo ? JSON.stringify(priceInfo, null, 2) : "—"}
        </pre>
      </section>

      <section>
        <h3>Execute trade</h3>
        <input
          placeholder="fromToken (0x...)"
          value={fromToken}
          onChange={(e) => setFromToken(e.target.value)}
          style={{ width: 320 }}
        />
        <input
          placeholder="toToken (0x...)"
          value={toToken}
          onChange={(e) => setToToken(e.target.value)}
          style={{ width: 320, marginLeft: 8 }}
        />
        <input
          placeholder="amount (e.g. 0.5)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ width: 160, marginLeft: 8 }}
        />
        <div style={{ marginTop: 8 }}>
          <button onClick={executeTrade}>Send Trade</button>
        </div>
      </section>

      <section>
        <h3>Log</h3>
        <pre style={{ background: "#fafafa", padding: 10 }}>{log}</pre>
      </section>
    </div>
  );
}
