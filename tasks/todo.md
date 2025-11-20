# TODO

- Add unit tests for `src/lib/store.ts` and `src/lib/vars.ts`.
- Add integration/e2e tests for `draft send` using `--dry-run` mode.
- Improve error reporting and logging for GraphQL failures.
- Add CI workflow to run tests and build on push (GitHub Actions).
- Add packaging and npm publish configuration (if desired).
- Harden `ghGraphql` retry/backoff and rate-limit handling.
- Document contributor setup: `npm install`, `npm run build`, `gh auth login`.

Note: JSON-first outputs and full comment/thread metadata have been implemented; adjust tests/docs accordingly.

Remaining review items to address (from PR #1):

- Update `README.md` to reflect ESM change and new usage with `node`/`bin` shim.
- Remove or document any helper scripts in `scripts/` (decide whether they are part of the project or temporary).
- Implement `draftClear` and related draft commands to ensure edge cases are handled (some threads indicated issues with clearing drafts).

Next steps (this session):

- Update README to document ESM usage and CLI shim (done).
- Move development scripts into `tools/` and add documentation (scripts documented under `tools/README.scripts.md`).
- Harden `draftClear` behavior and add unit tests for edge cases (next).

Plan: I will add tasks for these items and prioritize small, non-breaking fixes first (README, docs, safety around scripts). If you agree, I will update `tasks/` and create branches for each large task.
