Scripts and tooling

Temporary helper scripts used during development are stored in the `scripts/` directory. These are not part of the public CLI API; they are development utilities.

If you want to promote any script to a supported tool, move it under `tools/` and add tests/documentation.

Current scripts include:
- `scripts/check_threads_and_reply.js` — checks PR review threads and posts replies for missing/detailed responses.
- `scripts/add_followups.js` — helper to post follow-up replies in bulk (development utility).

Keep these scripts under review and consider removing or reorganizing them before publishing the package.

