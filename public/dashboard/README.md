# Recall Dashboard (Served)

This is the dashboard copied into `public/dashboard/` so the Express server can serve it at `/dashboard/index.html`.

Open in browser:

http://localhost:3000/dashboard/index.html

Notes:
- The dashboard will call the server's `/api/*` endpoints when available. When the server is not running, it will fallback to `data/trades.json` for sample data.
- If you want the dashboard accessible at the root path, move or symlink these files into `public/`.
