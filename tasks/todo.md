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

---

## gh CLI 互換オプション追加

### list コマンド（gh pr list 互換）

- [ ] `--author <login>` - 作者でフィルター（`@me` サポート）
- [ ] `--label <label>` - ラベルでフィルター（複数指定可能）
- [ ] `--limit <n>` - 取得数制限（デフォルト30）
- [ ] `--assignee <login>` - アサインでフィルター
- [ ] `--base <branch>` - ベースブランチでフィルター
- [ ] `--draft` - ドラフト状態でフィルター
- [ ] `--search <query>` - 高度な検索クエリ

### show コマンド（gh pr view 互換）

- [ ] `--fields <cols>` - 出力フィールド選択（現在は固定）
- [ ] `--comments` - レビューコメントも含めて表示

### comment list コマンド

- [x] `--all` - resolved含む（実装済み）
- [x] `--label` - PRラベルフィルター（実装済み）
- [x] `--comment-filter` - コメントフィルター（実装済み）
- [x] `--detail` - 詳細フィールド選択（実装済み）
- [x] `--page`, `--per-page` - ページネーション（実装済み）
- [ ] `--author <login>` - コメント作者でフィルター（`--comment-filter author:NAME` の簡略化）
- [ ] `--path <file>` - 特定ファイルのコメントのみ表示
- [ ] `--sort <field>` - 並び替え（createdAt, path）

### comment show コマンド

- [x] `--detail` - 詳細フィールド選択（実装済み）
- [ ] `--replies-limit <n>` - 返信の取得数制限
- [ ] `--with-context` - 前後のコード行も表示

### draft コマンド（独自機能）

- [x] draft add: `-r, --resolve`（実装済み）
- [x] draft send: `-f, --force`, `--dry-run`（実装済み）
- [ ] draft clear: `--all` - 全PRのドラフトをクリア
- [ ] draft send: `--thread <id>` - 特定スレッドのみ送信
