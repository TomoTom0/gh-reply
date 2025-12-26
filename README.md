# gh-reply

CLI to manage draft replies to GitHub PR review comments.

## Rust Implementation

This project now includes a Rust implementation alongside the original Node.js version. The Rust version offers significant performance improvements and a much smaller binary size.

### Why Rust?

- **Smaller binary**: ~2.2MB (vs ~43MB debug build in Node.js)
- **Faster execution**: Native performance without JIT warmup
- **Single binary**: No Node.js runtime required

### Prerequisites (Rust)
- `gh` (GitHub CLI) installed and authenticated (`gh auth login`)
- Rust toolchain (install from https://rustup.rs/)

### Building (Rust)

```bash
# Debug build
cargo build

# Release build (optimized for size)
cargo build --release
```

The optimized release build is configured with:
- `opt-level = "z"` - Optimize for binary size
- `lto = true` - Link-time optimization
- `codegen-units = 1` - Better optimization
- `strip = true` - Strip debug symbols

### Running (Rust)

```bash
# Using debug build
cargo run -- list --help

# Using release build
./target/release/gh-reply list --help
```

## Node.js Implementation

The original Node.js implementation is still available and fully supported.

### Prerequisites (Node.js)
- `gh` (GitHub CLI) installed and authenticated (`gh auth login`).
- Node.js >= 18 (ESM support)

### Note on ESM
- This project has migrated to ECMAScript Modules (ESM). The built CLI is an ESM bundle in `dist/`. The `bin/gh-reply.js` shim dynamically imports the ESM bundle so you can run `node ./bin/gh-reply.js` after `npm run build`.

Environment Variables
- `GHREPLY_RESOLVE`: Set to `false` to disable the `--resolve` option. This prevents accidentally resolving review threads. Default is enabled.

Publishing
-----------

To publish to npm from a release tag, create a tag like `v0.1.0` and push it. The GitHub Actions `Release` workflow will publish the package to npm when a tag matching `v*.*.*` is pushed. Ensure you have added `NPM_TOKEN` to the repository secrets for publishing.

Contributing
------------

1. Fork the repo and create a feature branch.
2. Make changes and run `npm run build` and `npm run test`.
3. Open a PR against `dev`.

Development scripts (in `scripts/`) are for maintainers only. See `tools/README.scripts.md` for details.

### Quick start (Node.js)
- Build: `npm run build`
- Run locally (shim): `node node_modules/.bin/gh-reply list --repo owner/name`

### Installation (Node.js)

Install and build locally:

```
npm run setup
```

This runs `npm install` and builds the TypeScript sources.

### Running the CLI (Node.js)

After building the project (`npm run build`), run the CLI shim:

```
node ./bin/gh-reply.js --help
```

Or use the built JS directly (Node must support ESM):

```
npm run dev -- --help
```

## Commands

The following commands are available in both Rust and Node.js implementations:

### Available Commands
- `list [--repo owner/name] [--state <state>]` - list PRs (JSON)
  - `--state`: open, closed, merged, all (default: open)
- `show <prNumber> [--repo owner/name]` - show PR details (JSON)
- `comment list <prNumber> [options]` - list review threads (JSON)
  - `--all` - include resolved threads
  - `--label <label>` - filter by PR label (comma-separated)
  - `--comment-filter <filters>` - filter by `author:NAME`, `contains:TEXT`, `severity:LEVEL`
  - `--detail <cols>` - include fields: `url`, `bodyHTML`, `diffHunk`, `commitOid`
  - `--page <n>` - page number (default: 1)
  - `--per-page <n>` - items per page (default: 10)
  - Returns: `{ total, page, perPage, items: [{ id, path, line, isResolved, comment: {...} }] }`
  - Note: Heavy fields (bodyHTML, diffHunk, commitOid, url) are excluded by default for performance.
- `comment show <prNumber> <threadId|index> [--detail <cols>]` - show thread details (JSON)
  - `<threadId|index>` - Thread ID or 1-based index (e.g., `1`, `2`, etc.)
  - `--detail <cols>` - include fields: `url`, `bodyHTML`, `diffHunk`, `commitOid`
  - Returns: `{ threadId, path, line, isResolved, comments: [...] }`
- `comment reply <prNumber> <threadId|index|main> <body> [-r|--resolve] [--dry-run]` - reply to review thread (immediate send). Status messages printed to stderr.
  - `<threadId|index|main>` - Thread ID, 1-based index, or `main` for PR-level comment
- `comment draft <prNumber> <threadId|index|main> <body> [-r|--resolve]` - add a draft reply (use `main` to post PR-level comment). Status messages printed to stderr.
  - `<threadId|index|main>` - Thread ID, 1-based index, or `main` for PR-level comment
- `comment draft <prNumber> --show` - show saved drafts (JSON)
- `comment draft <prNumber> --send [-f|--force] [--dry-run]` - send all saved drafts and optionally resolve. `--dry-run` can be used to preview actions without making any changes. Status messages printed to stderr.
- `comment draft <prNumber> --clear` - clear all drafts

Storage
- Drafts are stored in `.git/info/gh-reply-drafts.json` in the repository.

Notes
- Thread identifiers can be either:
  - GraphQL Node IDs (base64, e.g., `PRRT_kwDOQY1Lo85irSuR`) - use `comment list` to get them
  - 1-based index numbers (e.g., `1`, `2`, `3`) - corresponds to the order in `comment list` output (includes resolved threads)
- `comment reply` immediately sends the reply to the specified thread.
- `comment draft <prNumber> <threadId|index> <body>` saves a draft locally; use `comment draft <prNumber> --send` to send all saved drafts.
- Both reply methods will `resolveReviewThread` when `--resolve` or `-r` is specified.

返信（レビューコメントへの直接返信）
---------------------------------

このツールはレビューの指摘（review thread）に対して即座に返信、または下書きを作成して一括送信できます。

### 即座に返信する場合

- `gh-reply comment list <prNumber>` — PR のスレッドを一覧表示します。出力される `id` は GraphQL の Node ID（例: `PRRT_kw...`）です。
- `gh-reply comment reply <prNumber> <threadId|index|main> <body> [-r|--resolve]` — 指定スレッド（または `main`）に即座に返信します。
  - `<threadId|index|main>` には、Thread ID、1から始まるインデックス番号、または `main` を指定できます
  - `-r` を付けるとスレッドを「解決（resolve）」します

### 下書きを使う場合

- `gh-reply comment draft <prNumber> <threadId|index|main> <body> [-r|--resolve]` — 指定スレッド（または `main`）に対する下書きを保存します。
  - `<threadId|index|main>` には、Thread ID、1から始まるインデックス番号、または `main` を指定できます
  - `-r` を付けると送信後にそのスレッドを「解決（resolve）」します
- `gh-reply comment draft <prNumber> --show` — 下書きを確認します。
- `gh-reply comment draft <prNumber> --send [-f|--force] [--dry-run]` — 保存済みの全下書きを送信します。`-f` は本文が空でも強制的に解決を行います。
- `gh-reply comment draft <prNumber> --clear` — 全下書きをクリアします。

### スレッドの指定方法

- **Thread ID（GraphQL Node ID）**: `PRRT_kwDOQY1Lo85irSuR` のような形式で指定
- **インデックス番号**: `1`, `2`, `3` など、1から始まる番号で指定（`comment list` の表示順に対応、resolved済みも含む）

### 環境変数

- `GHREPLY_RESOLVE=false` — `--resolve` オプションを無効化します。誤ってスレッドを解決してしまうのを防ぎます。デフォルトは有効です。

GraphQL Node ID またはインデックス番号を使うことで、該当スレッドを特定して返信できます。ツールは可能な限りスレッドへ直接返信することを試みます（GraphQL/REST の状況に依存します）。

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
