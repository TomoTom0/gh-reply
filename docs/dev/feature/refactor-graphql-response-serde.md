# GraphQLレスポンスのserde化

## 現状
GraphQLのレスポンスを手動でパースしている（src/github/client.rs:366付近）。

`serde_json::Value`から`.get()`や`.and_then()`を連鎖させてフィールドを取り出しており、レスポンスの構造が変更された場合に壊れやすく、メンテナンス性が低い。

## 問題点
- レスポンス構造の変更に脆弱
- 型安全性が低い
- コードの可読性が低い
- エラーハンドリングが不十分

## 改善案
レスポンスに対応するstructを`serde`を用いて定義し、`serde_json::from_value`などでデシリアライズする方法を推奨。

例：
```rust
#[derive(Debug, Deserialize)]
struct ReviewThreadResponse {
    data: ReviewThreadData,
}

#[derive(Debug, Deserialize)]
struct ReviewThreadData {
    node: ReviewThreadNode,
}

#[derive(Debug, Deserialize)]
struct ReviewThreadNode {
    id: String,
    #[serde(rename = "isResolved")]
    is_resolved: bool,
    comments: Comments,
}

#[derive(Debug, Deserialize)]
struct Comments {
    nodes: Vec<Comment>,
}

#[derive(Debug, Deserialize)]
struct Comment {
    #[serde(rename = "databaseId")]
    database_id: i64,
    author: Author,
    body: String,
}

#[derive(Debug, Deserialize)]
struct Author {
    login: String,
}

// 使用例
let response: ReviewThreadResponse = serde_json::from_value(response)?;
let author = response.data.node.comments.nodes
    .first()
    .map(|c| &c.author.login);
```

これにより、型安全性が向上し、コードがより堅牢で読みやすくなる。

## 優先度
medium

## 関連
- PR: #13
- Thread ID: PRRT_kwDOQZVIxM5nYdjy
- 関連ファイル: src/github/client.rs
