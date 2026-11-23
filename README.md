# KAKI Studio Read-only View

Public, no-index viewer for short-lived KAKI Studio release snapshots.

Each shared link contains only a random snapshot ID, for example:

`https://kakirui.github.io/kaki-studio-view/?s=AbC123XyZ`

The viewer fetches the snapshot from the KAKI Studio short-link Worker. Snapshots expire automatically after seven days.

- Worker: `https://kaki-studio-share.meowruii1010.workers.dev`
- Source: `worker.js`
- KV binding: `SNAPSHOTS`
- Temporary write limit: 20 snapshots per IP per day
