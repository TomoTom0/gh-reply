# gh-reply

CLI to manage draft replies to GitHub PR review comments.

Prerequisites
- `gh` (GitHub CLI) installed and authenticated (`gh auth login`).

Quick start
- Build: `npm run build`
- Run locally (shim): `node node_modules/.bin/gh-reply list --repo owner/name`

Commands
- `list [--repo owner/name]` - list open PRs
- `show <prNumber> [--repo owner/name]` - show PR details
- `comment list <prNumber>` - list unresolved review threads (shows thread Node IDs)
- `comment show <prNumber> <threadId>` - show thread details
- `draft add <prNumber> <threadId|main> <body> [-r|--resolve]` - add a draft reply (use `main` to post PR-level comment)
- `draft show <prNumber>` - show saved drafts
 - `draft send <prNumber> [-f|--force]` - send drafts and optionally resolve
  - `--dry-run` can be used to preview actions without making any changes.
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
