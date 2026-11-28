# KAKI Studio Read-only View

Public, no-index viewer for short-lived KAKI Studio release snapshots.

Each shared link contains only a random snapshot ID, for example:

`https://kakirui.github.io/kaki-studio-view/?s=AbC123XyZ`

The viewer fetches the snapshot from the same GitHub Pages origin, with raw GitHub and jsDelivr fallbacks for regions where one route is unavailable. A scheduled GitHub Action removes snapshots after seven days.

- Snapshot directory: `snapshots/`
- Cleanup workflow: `.github/workflows/prune-snapshots.yml`
- The legacy Worker is kept as a compatibility fallback for links created before the GitHub storage migration.
