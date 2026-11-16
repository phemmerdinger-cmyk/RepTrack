# Shared coding instructions — RepTrack

## Project
RepTrack is a mobile/desktop workout tracker with a Node.js 20+ backend (`server.js`) and WHOOP OAuth integration. Workout history is stored locally in each browser; export/import backups are the current cross-device transfer method. The application is deployed as a Node web service on Render.

## Commands
- `npm start` or `node server.js`: run the server.
- `npm install`: documented Render build/install command.
- No `npm test` or frontend build script is defined in the current `package.json`; do not claim automated tests passed unless added and run.

## Conventions and safeguards
- Inspect the affected server and browser files before editing; prefer small, isolated changes that preserve existing functionality.
- Preserve existing workout storage keys, saved exercise records, and backup import/export formats unless a migration is explicitly designed and tested.
- Keep planned workouts, live/past logging, saved sets, and pending draft entries distinct; do not silently rewrite historical workouts.
- Preserve mobile/desktop accessibility: keyboard operation, dialog focus, date navigation, and reduced-motion support.
- WHOOP OAuth tokens, client secrets, and session secrets must never be committed or exposed to browser code. Use environment variables for `WHOOP_CLIENT_ID`, `WHOOP_CLIENT_SECRET`, `PUBLIC_URL`, and `SESSION_SECRET`.
- Treat WHOOP sync as external and fallible; do not overwrite workout history when a sync fails.
- Keep the project on its existing Node.js architecture; avoid adding paid services or unnecessary dependencies.
- Manually verify affected flows when no automated test exists; describe what was and was not tested.

## Claude Code and Codex
Both assistants must follow this file. Claude Code loads it via `CLAUDE.md` (`@AGENTS.md`). Coordinate changes and review diffs before accepting delegated work.
