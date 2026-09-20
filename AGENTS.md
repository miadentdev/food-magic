# Release Versioning

For every user-facing feature, fix, or interface change, update the application version and changelog as part of the same change unless the user explicitly asks not to.

## Version bump

- Use semantic versioning. Increment the patch version for fixes and small interface changes; use minor or major versions only when appropriate or explicitly requested.
- Keep these version values identical:
  - `package.json`
  - The root package entry and `packages[""].version` in `package-lock.json`
  - `public/manifest.webmanifest`
  - The visible footer version in `src/app/app.html`
- Update `public/sw.js` to use a new cache name containing the new app version, so deployed clients receive the latest assets.

## Changelog

- Add an entry to `CHANGELOG.md` for every version bump, using the current date and concise, user-facing change descriptions.
- Place the newest release directly below the introductory text.
- Do not alter historical release entries except to correct factual errors.
- When the in-app Change Log viewer is present, keep its release notes in `src/app/app.ts` aligned with `CHANGELOG.md`.

## Verification

- Run `npm.cmd run build` after a version or changelog update, unless the environment prevents it. Report the verification result.
