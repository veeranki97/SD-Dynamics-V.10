# Apply update-check URLs (one-time)

In `server.js`, find `app.get('/api/check-update'` and change:

FROM:
  veeranki97/Bharatbill2
TO:
  veeranki97/SD-Dynamics

Both:
  raw.githubusercontent.com/.../main/package.json
  api.github.com/repos/.../releases/latest

In `package.json`:
  "version": "2.1.0",
  "repository": { "url": "https://github.com/veeranki97/SD-Dynamics.git" }

Also search App.jsx / userGuide for Bharatbill2 links if any remain.
