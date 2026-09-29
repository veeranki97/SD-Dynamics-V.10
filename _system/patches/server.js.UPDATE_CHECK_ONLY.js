// DROP-IN: replace the fetch URLs inside app.get('/api/check-update' ...)
// with these two lines:

fetch('https://raw.githubusercontent.com/veeranki97/SD-Dynamics/main/package.json', { signal: ctrl.signal }),
fetch('https://api.github.com/repos/veeranki97/SD-Dynamics/releases/latest', {
  signal: ctrl.signal,
  headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'SD-Dynamics-update-check' },
}).catch(() => null),
