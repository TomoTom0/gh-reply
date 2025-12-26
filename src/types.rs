use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Base context for PR replies containing common PR information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BaseReplyContext {
    pub repo_owner: String,
    pub repo_name: String,
    pub pr_number: String,
    pub date: String,
    pub username: String,
    pub repo_url: String,
    pub base_branch: String,
    pub head_branch: String,
    pub pr_title: String,
    pub author: String,
    pub local_commit: String,
}

/// Reply context extending BaseReplyContext with reply target
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplyContext {
    #[serde(flatten)]
    pub base: BaseReplyContext,
    pub reply_to: String,
}

/// A single draft reply entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DraftEntry {
    pub body: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub original_comment: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resolve: Option<bool>,
    pub timestamp: String,
}

/// Drafts storage: PR number -> thread ID -> DraftEntry
pub type Drafts = HashMap<String, HashMap<String, DraftEntry>>;

/// PR review thread information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReviewThread {
    pub id: String,
    pub path: String,
    pub line: Option<u32>,
    pub diff_side: Option<String>,
    pub body: String,
    pub is_resolved: bool,
}
