# 未実装CLIオプションの実装

## 現状
comment listおよびcomment showコマンドで`--label`、`--comment-filter`、`--detail`オプションが定義されているが、実装されていない。

現在は、これらのオプションが指定された場合にエラーメッセージを返すことで、ユーザーに未実装であることを明示している。

## 問題点
以下の便利な機能が使えない状態：
- PRのlabelによるフィルタリング
- コメント内容によるフィルタリング
- 詳細情報の表示

## 実装すべき機能

### 1. `--label` オプション (comment list)
PRに付けられたlabelでフィルタリング。カンマ区切りで複数指定可能。

```bash
gh-reply comment list 13 --label "bug,security"
```

### 2. `--comment-filter` オプション (comment list)
コメント内容でフィルタリング。以下の形式をサポート：
- `author:NAME` - 特定の著者のコメントのみ
- `contains:TEXT` - 特定のテキストを含むコメントのみ
- `severity:LEVEL` - 特定の重要度のコメントのみ

```bash
gh-reply comment list 13 --comment-filter "author:gemini-code-assist"
gh-reply comment list 13 --comment-filter "contains:security"
gh-reply comment list 13 --comment-filter "severity:high"
```

### 3. `--detail` オプション (comment list, comment show)
詳細情報を含める。カンマ区切りで複数指定可能：
- `url` - コメントのURL
- `bodyHTML` - コメントのHTML形式
- `diffHunk` - 差分情報
- `commitOid` - コミットハッシュ

```bash
gh-reply comment list 13 --detail "url,diffHunk"
gh-reply comment show 13 1 --detail "bodyHTML,commitOid"
```

## 実装方針

### label フィルタ
1. `client.get_pr_details()`でPRのlabelを取得
2. 指定されたlabelとマッチするかチェック

### comment-filter フィルタ
1. フィルタ文字列をパース（`filter_type:value`形式）
2. 各threadのcommentsを走査してフィルタ適用

### detail オプション
1. GraphQLクエリに追加フィールドを含める
2. 出力JSONに追加フィールドを含める
3. パフォーマンスのため、デフォルトでは除外

## 優先度
medium

## 関連
- PR: #13
- Thread ID: PRRT_kwDOQZVIxM5nYdju
- 関連ファイル:
  - src/commands/comment.rs
  - src/github/client.rs
