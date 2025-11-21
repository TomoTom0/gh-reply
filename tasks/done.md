# Done

- Project scaffolding and TypeScript implementation.
- Implemented CLI commands: list, show, comment list/show, draft add/show/send/clear.
- Implemented local draft store at `.git/info/gh-reply-drafts.json`.
- Implemented GraphQL wrapper and direct reply attempt (now working via stdin JSON body).
- README added and updated with usage and magic variables.
 - All command outputs standardized to JSON on stdout; logs and status messages written to stderr.
 - `comment list` now supports `--all` to include resolved threads and returns detailed comment metadata (id, databaseId, body, bodyText, bodyHTML, createdAt, commit oid, originalCommit oid, diffHunk, line, path, author, url).
- `comment show` returns thread details including `line` and full comment objects with metadata.
- ESM migration completed; CLI updated to load dist ESM bundle via shim.
- Added unit tests and CI workflow; tests cover store and mappers.
 - README updated with ESM notes and CLI shim usage.
 - Development scripts documented under `tools/README.scripts.md`.
- [2025-11-21] `comment list` に新オプション追加: `--page`, `--per-page` (ページネーション), `--detail` (詳細フィールド選択), `--comment-filter` (コメントフィルター), `--label` (PRラベルフィルター)
- [2025-11-21] `comment show` に `--detail` オプション追加
- [2025-11-21] デフォルトで重いフィールド (bodyHTML, diffHunk, commitOid, url) を除外し、出力を軽量化
- [2025-11-21] `list` コマンドに `--state` オプション追加 (open, closed, merged, all)
