use crate::error::Result;
use crate::types::{BaseReplyContext, ReplyContext};
use crate::github::GhClient;

pub struct ContextBuilder {
    client: GhClient,
}

impl ContextBuilder {
    pub fn new(client: GhClient) -> Self {
        Self { client }
    }

    pub async fn build_base_context(
        &self,
        pr_number: &str,
    ) -> Result<BaseReplyContext> {
        // Get repository information
        let (repo_owner, repo_name) = self.client.get_repo_info()?;

        // Get PR details
        let pr_details = self.client.get_pr_details(pr_number)?;

        // Get authenticated user
        let auth_user = self.client.get_authenticated_user()?;

        // Get local commit hash
        let local_commit = Self::get_local_commit().await.unwrap_or_default();

        // Determine username with fallback
        let username = if !auth_user.is_empty() {
            auth_user
        } else {
            Self::get_os_username()
        };

        Ok(BaseReplyContext {
            repo_owner: repo_owner.clone(),
            repo_name: repo_name.clone(),
            pr_number: pr_number.to_string(),
            date: chrono::Utc::now().to_rfc3339(),
            username,
            repo_url: format!("https://github.com/{}/{}", repo_owner, repo_name),
            base_branch: pr_details["baseRefName"].as_str().unwrap_or("").to_string(),
            head_branch: pr_details["headRefName"].as_str().unwrap_or("").to_string(),
            pr_title: pr_details["title"].as_str().unwrap_or("").to_string(),
            author: pr_details["author"]["login"].as_str().unwrap_or("").to_string(),
            local_commit,
        })
    }

    async fn get_local_commit() -> Option<String> {
        use tokio::process::Command;

        let output = Command::new("git")
            .args(&["rev-parse", "HEAD"])
            .output()
            .await
            .ok()?;

        if output.status.success() {
            Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
        } else {
            None
        }
    }

    fn get_os_username() -> String {
        use std::env;

        env::var("USER")
            .or_else(|_| env::var("USERNAME"))
            .unwrap_or_default()
    }

    pub async fn get_reply_to_author(&self, target: &str) -> Result<String> {
        if target == "main" {
            return Ok(target.to_string());
        }

        // Try to get the author of the first comment in the thread
        let query = r#"query($id: ID!) {
            node(id: $id) {
                __typename
                ... on PullRequestReviewThread {
                    id
                    isResolved
                    comments(first:1) { nodes { databaseId author { login } body } }
                }
            }
        }"#;
        let variables = serde_json::json!({ "id": target });

        match self.client.gh_graphql(query, Some(variables)).await {
            Ok(response) => {
                let author = response.get("data")
                    .and_then(|d| d.get("node"))
                    .and_then(|n| n.get("comments"))
                    .and_then(|c| c.get("nodes"))
                    .and_then(|nodes| nodes.as_array())
                    .and_then(|nodes| nodes.get(0))
                    .and_then(|comment| comment.get("author"))
                    .and_then(|author| author.get("login"))
                    .and_then(|login| login.as_str());
                Ok(author.unwrap_or(target).to_string())
            }
            Err(_) => {
                // Fall back to using the target ID if GraphQL fails
                Ok(target.to_string())
            }
        }
    }

    pub async fn build_reply_context(
        &self,
        pr_number: &str,
        thread_id: &str,
    ) -> Result<ReplyContext> {
        let base = self.build_base_context(pr_number).await?;
        let reply_to = self.get_reply_to_author(thread_id).await?;

        Ok(ReplyContext {
            base,
            reply_to,
        })
    }
}
