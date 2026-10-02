# How to publish SD Dynamics so the app shows “Update available”

## Rule
Notification = remote `package.json` version **>** local `package.json` version.

Pushing commits without bumping `version` does **nothing** for the banner.

## Steps (v2.1.0 example)

1. Locally set version in `package.json` to `2.1.0`.
2. Paste `CHANGELOG_SNIPPET.md` into top of `CHANGELOG.md`.
3. Fix update URLs in `server.js` to `SD-Dynamics` (see patches/).
4. Commit & push to `main`:

```bat
git add package.json CHANGELOG.md server.js
git commit -m "release: v2.1.0"
git push origin main
```

5. GitHub website:
   - Open https://github.com/veeranki97/SD-Dynamics/releases
   - **Draft a new release**
   - Choose tag: create new tag `v2.1.0` on `main`
   - Release title: `SD Dynamics v2.1.0`
   - Description: paste changelog section
   - (Optional) Attach a ZIP of the release
   - **Publish release**

6. On any machine still on 2.0.0, open the app (with internet).
   Within a few seconds `/api/check-update` should report
   `updateAvailable: true` and the banner appears.

## Semver suggestion for this product
- **2.0.x** — bugfix only
- **2.1.0** — launcher + update-check repo fix (this pack)
- **2.2.0** — larger ERP modules

Current repo version observed: **2.0.0** → next recommended: **2.1.0**
