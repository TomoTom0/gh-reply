# gh-reply

CLI to manage draft replies to GitHub PR review comments.

Prerequisites
- `gh` (GitHub CLI) installed and authenticated (`gh auth login`).
- Node.js >= 18 (ESM support)

Note on ESM
- This project has migrated to ECMAScript Modules (ESM). The built CLI is an ESM bundle in `dist/`. The `bin/gh-reply.js` shim dynamically imports the ESM bundle so you can run `node ./bin/gh-reply.js` after `npm run build`.

Publishing
-----------

To publish to npm from a release tag, create a tag like `v0.1.0` and push it. The GitHub Actions `Release` workflow will publish the package to npm when a tag matching `v*.*.*` is pushed. Ensure you have added `NPM_TOKEN` to the repository secrets for publishing.

Contributing
------------

1. Fork the repo and create a feature branch.
2. Make changes and run `npm run build` and `npm run test`.
3. Open a PR against `dev`.

Development scripts (in `scripts/`) are for maintainers only. See `tools/README.scripts.md` for details.

Quick start
- Build: `npm run build`
- Run locally (shim): `node node_modules/.bin/gh-reply list --repo owner/name`

Installation
------------

Install and build locally:

```
npm run setup
```

This runs `npm install` and builds the TypeScript sources.

Running the CLI
---------------

After building the project (`npm run build`), run the CLI shim:

```
node ./bin/gh-reply.js --help
```

Or use the built JS directly (Node must support ESM):

```
npm run dev -- --help
```


Commands
- `list [--repo owner/name] [--state <state>]` - list PRs (JSON)
  - `--state`: open, closed, merged, all (default: open)
- `show <prNumber> [--repo owner/name]` - show PR details (JSON)
- `comment list <prNumber> [options]` - list review threads (JSON)
  - `--all` - include resolved threads
  - `--label <label>` - filter by PR label (comma-separated)
  - `--comment-filter <filters>` - filter by author:NAME, contains:TEXT, severity:LEVEL
  - `--detail <cols>` - include fields: url, bodyHTML, diffHunk, commitOid
  - `--page <n>` - page number (default: 1)
  - `--per-page <n>` - items per page (default: 10)
  - Returns: `{ total, page, perPage, items: [{ threadId, path, line, isResolved, comment: {...} }] }`
  - Note: Heavy fields (bodyHTML, diffHunk, commitOid, url) are excluded by default for performance.
- `comment show <prNumber> <threadId> [--detail <cols>]` - show thread details (JSON)
  - `--detail <cols>` - include fields: url, bodyHTML, diffHunk, commitOid
  - Returns: `{ threadId, path, line, isResolved, comments: [...] }`
- `draft add <prNumber> <threadId|main> <body> [-r|--resolve]` - add a draft reply (use `main` to post PR-level comment). Status messages printed to stderr.
- `draft show <prNumber>` - show saved drafts (JSON)
- `draft send <prNumber> [-f|--force]` - send drafts and optionally resolve. `--dry-run` can be used to preview actions without making any changes. Status messages printed to stderr.
- `draft clear <prNumber>` - clear drafts

Storage
- Drafts are stored in `.git/info/gh-reply-drafts.json` in the repository.

Notes
- Thread IDs used are GraphQL Node IDs (base64). Use `comment list` to get them.
- `draft send` will `addComment` to threads and `resolveReviewThread` when `--resolve` was set when saving the draft.

返信（レビューコメントへの直接返信）
---------------------------------

このツールはレビューの指摘（review thread）に対してローカルで下書きを作成し、一括で返信・解決できます。基本的な流れ:

- `gh-reply comment list <prNumber>` — PR の未解決スレッドを一覧表示します。出力される `id` は GraphQL の Node ID（例: `PRRT_kw...`）です。
- `gh-reply draft add <prNumber> <threadId|main> <body> [-r|--resolve]` — 指定スレッド（または `main`）に対する下書きを保存します。`-r` を付けると送信後にそのスレッドを「解決（resolve）」します。
- `gh-reply draft show <prNumber>` — 下書きを確認します。
- `gh-reply draft send <prNumber> [-f|--force]` — 下書きを送信します。`-f` は本文が空でも強制的に解決を行います。

GraphQL Node ID を直接使うことで、該当スレッドを特定して返信できます。ツールは可能な限りスレッドへ直接返信することを試みます（GraphQL/REST の状況に依存します）。

フォールバック動作
- 一部の環境や API の差異により、スレッドへ直接返信が行えない場合があります（ID の種類や権限による制約など）。その場合、本ツールは安全策として「PR 全体へのコメントで対象者をメンション」し、続けて GraphQL でスレッドを `resolve` します。これにより、相手に返信が伝わり、スレッドは解決状態になります。

マジック変数
下書き本文中に `{{...}}` 形式で次の変数を使えます（送信時に展開されます）：

- `repo_owner` — リポジトリの owner
- `repo_name` — リポジトリ名
- `pr_number` — PR 番号
- `reply_to` — 返信先のユーザ名（スレッド先頭の投稿者の login）
- `repo_url` — リポジトリの URL
- `date` — 現在日時（ISO）
- `username` — 認証ユーザ（`gh api user` の login）
- `base_branch` / `head_branch` — PR のマージ先/元ブランチ名
- `pr_title` — PR のタイトル
- `author` — PR の作成者 login
- `local_commit` — 現在のローカル HEAD のコミットID（存在する場合）

例:

`gh-reply draft add 42 PRRT_kwDOQY1Lo85irSuR "@{{reply_to}} Thanks — merging {{head_branch}} into {{base_branch}} (commit {{local_commit}})" -r`

注意事項
- `gh` CLI のインストールと `gh auth login` による認証が必要です。
- スレッドへの直接返信を確実に行うには GraphQL の適切な mutation（例: `addPullRequestReviewThreadReply`）が使えることが前提になります。API の差異や権限の関係で直接返信が使えない場合はフォールバック動作となる点に注意してください。
