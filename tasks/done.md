# Done

- Project scaffolding and TypeScript implementation.
- Implemented CLI commands: list, show, comment list/show, draft add/show/send/clear.
- Implemented local draft store at `.git/info/gh-reply-drafts.json`.
- Implemented GraphQL wrapper and direct reply attempt (now working via stdin JSON body).
- README added and updated with usage and magic variables.
 - All command outputs standardized to JSON on stdout; logs and status messages written to stderr.
 - `comment list` now supports `--all` to include resolved threads and returns detailed comment metadata (id, databaseId, body, bodyText, bodyHTML, createdAt, commit oid, originalCommit oid, diffHunk, line, path, author, url).
 - `comment show` returns thread details including `line` and full comment objects with metadata.
