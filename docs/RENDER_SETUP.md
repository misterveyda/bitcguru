Render Deployment Quick Setup

Backend service (Node.js)

- Create a Web Service in Render and connect your GitHub repository.
- If using a monorepo, set the "Root Directory" to `server/`.
- Build Command: `npm install`
- Start Command: `npm run migrate && npm start`
- Environment variables to add (Render Dashboard -> Service -> Environment):
  - `PORT` (Render will provide one; server reads `PORT` env; default 10000 if not set)
  - `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME` (if using a Render DB)
  - `GITHUB_TOKEN` (GitHub PAT used by the backend `@octokit/rest`)
  - `BACKEND_API_KEY` (secret key used by your frontend to call protected endpoints; send in `x-api-key` header)
  - `CORS_ORIGIN` (set to your frontend URL, e.g. `https://your-frontend.onrender.com`)
  - Optional: `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH`

Frontend (Static Site)

- Create a Static Site in Render and connect the same repository.
- If using a monorepo, set the "Root Directory" to `docs/`.
- Build Command: `npm install && npm run build` (this will create a `dist/` folder containing the final static site).
- Publish Directory: `dist` (Render should serve the files from `docs/dist`).
- Add an environment variable (Render Static Site -> Environment):
  - `BACKEND_BASE` = `https://your-backend-service.onrender.com`

Notes on using `BACKEND_BASE` for plain static sites:
- `docs/script.js` checks `window.BACKEND_BASE` or `window.__BACKEND_BASE__` at runtime. To set this for a plain static site, add a small inline script in `docs/index.html` before other scripts:

  <script>
    window.BACKEND_BASE = 'https://your-backend-service.onrender.com';
  </script>

- Alternatively, if you use a frontend build step (React/Next/Vite), set the appropriate build-time env var (e.g., `REACT_APP_BACKEND_URL` or `NEXT_PUBLIC_BACKEND_URL`) and read `process.env` during build.

CORS

- Set `CORS_ORIGIN` in the backend service to your frontend URL so the backend only accepts requests from your frontend domain.

Auto-deploy

- Enable "Auto-Deploy" in Render to deploy on push to your chosen branch (e.g., `main`).

Testing locally

```bash
# from workspace root
cd server
npm install
export GITHUB_TOKEN=ghp_xxx
export BACKEND_API_KEY=localkey
export CORS_ORIGIN=http://localhost:3000
node index.js
```

Sample frontend request (include `x-api-key` header):

```javascript
fetch(`${window.BACKEND_BASE || 'https://bitcgurub.onrender.com'}/api/github/update-data`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'your-backend-key'
  },
  body: JSON.stringify({ filePath: 'docs/data.json', content: JSON.stringify({ updated: true }, null, 2), message: 'Update from frontend' })
});
```

Security reminders

- Never commit secrets to the repository. Use Render's environment settings.
- Protect the GitHub token and use a scoped PAT.
- Use `BACKEND_API_KEY` to authenticate frontend calls and add further user-based auth as needed.
