# Recall Dashboard (Standalone)

This is a lightweight standalone dashboard that reads from the existing Express backend (if running) and falls back to the local `data/trades.json` sample when the backend or API key isn't available.

How to use

- If the main server is running (npm start) visit: http://localhost:3000/dashboard/index.html (or copy files into any static server)
- Or open `dashboard/index.html` directly in a browser; some features that call `/api/*` will fail when opened as file:// and the dashboard will use local fallback data.

Endpoints used

- GET /api/trades — trade history
- GET /api/portfolio — portfolio (falls back to local computation)
- POST /api/trade — manual trade submission
- POST /api/transaction — simple transaction submit
- GET /api/competitions — recall competitions (requires RECALL_API_KEY)

Notes

- The dashboard is intentionally small and self-contained. It includes dark mode, refresh, and basic forms.
- You can move or copy files into `public/dashboard/` if you prefer the server to serve them under `/dashboard`.
