use crate::error::{GhReplyError, Result};
use crate::types::ReviewThread;
use serde_json::Value;
use std::process::Command;

#[derive(Clone)]
pub struct GhClient {
    repo: Option<String>,
}

impl GhClient {
    pub fn new(repo: Option<String>) -> Self {
        Self { repo }
    }

    /// Execute gh CLI command with environment setup
    fn gh_exec(&self, args: &[&str], input: Option<&str>) -> Result<String> {
        // Allow overriding gh command for testing
        let gh_cmd = std::env::var("GH_COMMAND").unwrap_or_else(|_| "gh".to_string());
        let mut cmd = Command::new(&gh_cmd);
        cmd.args(args);

        // Set environment variables for non-interactive, deterministic behavior
        cmd.env("GH_PAGER", "");
        cmd.env("GH_NO_UPDATE_NOTIFIER", "1");
        cmd.env("NO_COLOR", "1");
        cmd.env("CLICOLOR", "0");
        cmd.env("CI", "true");

        if let Some(input_str) = input {
            use std::io::Write;
            use std::process::Stdio;

            cmd.stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped());

            let mut child = cmd
                .spawn()
                .map_err(|e| GhReplyError::GhError(format!("Failed to spawn gh: {}", e)))?;

            if let Some(mut stdin) = child.stdin.take() {
                stdin
                    .write_all(input_str.as_bytes())
                    .map_err(|e| GhReplyError::GhError(format!("Failed to write to stdin: {}", e)))?;
            }

            let output = child
                .wait_with_output()
                .map_err(|e| GhReplyError::GhError(format!("Failed to wait for gh: {}", e)))?;

            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                return Err(GhReplyError::GhError(format!(
                    "gh command failed: {}\nstderr: {}",
                    args.join(" "),
                    stderr
                )));
            }

            return Ok(String::from_utf8_lossy(&output.stdout).to_string());
        }

        let output = cmd
            .output()
            .map_err(|e| GhReplyError::GhError(format!("Failed to execute gh: {}", e)))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(GhReplyError::GhError(format!(
                "gh command failed: {}\nstderr: {}",
                args.join(" "),
                stderr
            )));
        }

        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    }

    /// Ensure gh CLI is available and authenticated
    pub fn ensure_gh_available() -> Result<()> {
        let gh_cmd = std::env::var("GH_COMMAND").unwrap_or_else(|_| "gh".to_string());

        let output = Command::new(&gh_cmd)
            .args(&["--version"])
            .output()
            .map_err(|_| {
                GhReplyError::GhError(
                    "`gh` CLI is not installed or not in PATH. Install GitHub CLI: https://cli.github.com/".to_string(),
                )
            })?;

        if !output.status.success() {
            return Err(GhReplyError::GhError(
                "`gh` CLI is not installed or not in PATH.".to_string(),
            ));
        }

        let output = Command::new(&gh_cmd)
            .args(&["auth", "status"])
            .output()
            .map_err(|_| {
                GhReplyError::GhError(
                    "`gh` is not authenticated. Run `gh auth login` to authenticate.".to_string(),
                )
            })?;

        if !output.status.success() {
            return Err(GhReplyError::GhError(
                "`gh` is not authenticated. Run `gh auth login` to authenticate.".to_string(),
            ));
        }

        Ok(())
    }

    /// Execute gh command and parse JSON output
    fn gh_json(&self, args: &[&str]) -> Result<Value> {
        let output = self.gh_exec(args, None)?;
        serde_json::from_str(&output)
            .map_err(|e| GhReplyError::GhError(format!("Failed to parse JSON: {}", e)))
    }

    /// Execute GraphQL query with retry
    pub async fn gh_graphql(&self, query: &str, variables: Option<Value>) -> Result<Value> {
        let retries = 3;
        let base_delay_ms = 500;
        let mut attempt = 0;
        let mut last_err = None;

        while attempt < retries {
            let result = self.gh_graphql_once(query, variables.as_ref());
            match result {
                Ok(value) => return Ok(value),
                Err(e) => {
                    last_err = Some(e);
                    attempt += 1;
                    if attempt >= retries {
                        break;
                    }

                    // Exponential backoff with jitter
                    let exp = 2_u32.pow(attempt);
                    let max_delay = base_delay_ms * exp;
                    let delay = rand::random::<u64>() % max_delay as u64;
                    tokio::time::sleep(tokio::time::Duration::from_millis(delay)).await;
                }
            }
        }

        Err(last_err.unwrap_or_else(|| GhReplyError::GhError("Retry failed".to_string())))
    }

    fn gh_graphql_once(&self, query: &str, variables: Option<&Value>) -> Result<Value> {
        let q = query.split_whitespace().collect::<Vec<_>>().join(" ");

        if let Some(vars) = variables {
            let body = serde_json::json!({
                "query": q,
                "variables": vars
            });
            let body_str = serde_json::to_string(&body)?;
            let args = vec!["api", "graphql", "--input", "-"];
            let output = self.gh_exec(&args, Some(&body_str))?;
            let parsed: Value = serde_json::from_str(&output)?;

            if let Some(errors) = parsed.get("errors") {
                return Err(GhReplyError::GhError(format!(
                    "GraphQL errors: {}",
                    serde_json::to_string(errors).unwrap_or_default()
                )));
            }

            Ok(parsed)
        } else {
            let query_arg = format!("query={}", q);
            let args = vec!["api", "graphql", "-f", &query_arg];
            let output = self.gh_exec(&args, None)?;
            let parsed: Value = serde_json::from_str(&output)?;

            if let Some(errors) = parsed.get("errors") {
                return Err(GhReplyError::GhError(format!(
                    "GraphQL errors: {}",
                    serde_json::to_string(errors).unwrap_or_default()
                )));
            }

            Ok(parsed)
        }
    }

    /// Get repository information (owner/name)
    pub fn get_repo_info(&self) -> Result<(String, String)> {
        if let Some(repo_override) = &self.repo {
            let parts: Vec<&str> = repo_override.split('/').collect();
            if parts.len() != 2 {
                return Err(GhReplyError::GhError(
                    "Invalid repo override. Expected owner/name".to_string(),
                ));
            }
            return Ok((parts[0].to_string(), parts[1].to_string()));
        }

        let result = self.gh_json(&["repo", "view", "--json", "owner,name"]);

        match result {
            Ok(data) => {
                let owner = data["owner"]["login"]
                    .as_str()
                    .or_else(|| data["owner"].as_str())
                    .ok_or_else(|| GhReplyError::GhError("Failed to get owner".to_string()))?;
                let name = data["name"]
                    .as_str()
                    .ok_or_else(|| GhReplyError::GhError("Failed to get repo name".to_string()))?;
                Ok((owner.to_string(), name.to_string()))
            }
            Err(_) => {
                // Fallback: try to infer from local git remotes
                self.get_repo_from_git()
            }
        }
    }

    fn get_repo_from_git(&self) -> Result<(String, String)> {
        // Try to get remote URL from git
        let output = Command::new("git")
            .args(&["remote", "get-url", "origin"])
            .output()
            .map_err(|_| GhReplyError::GhError("Failed to get git remote".to_string()))?;

        if !output.status.success() {
            return Err(GhReplyError::GhError("No git remote found".to_string()));
        }

        let remote_url = String::from_utf8_lossy(&output.stdout).trim().to_string();

        // Parse owner/repo from URL (e.g., git@github.com:owner/repo.git or https://github.com/owner/repo)
        let re = regex::Regex::new(r"[:/]([^/]+/[^/]+?)(?:\.git)?$")
            .map_err(|e| GhReplyError::GhError(format!("Regex error: {}", e)))?;

        if let Some(caps) = re.captures(&remote_url) {
            let parts: Vec<&str> = caps[1].split('/').collect();
            if parts.len() == 2 {
                return Ok((parts[0].to_string(), parts[1].to_string()));
            }
        }

        Err(GhReplyError::GhError(
            "Failed to parse remote URL".to_string(),
        ))
    }

    /// Get authenticated user login
    pub fn get_authenticated_user(&self) -> Result<String> {
        match self.gh_json(&["api", "user"]) {
            Ok(data) => {
                let login = data["login"]
                    .as_str()
                    .unwrap_or("")
                    .to_string();
                Ok(login)
            }
            Err(_) => Ok(String::new()),
        }
    }

    /// Get PR details
    pub fn get_pr_details(&self, pr_number: &str) -> Result<Value> {
        let mut args = vec![
            "pr",
            "view",
            pr_number,
            "--json",
            "title,headRefName,baseRefName,author,headRefOid",
        ];

        let repo_arg;
        if let Some(repo) = &self.repo {
            repo_arg = repo.clone();
            args.push("--repo");
            args.push(&repo_arg);
        }

        self.gh_json(&args)
    }

    /// Get PR review threads with pagination
    pub async fn get_review_threads(&self, pr_number: u32) -> Result<Vec<ReviewThread>> {
        let (owner, name) = self.get_repo_info()?;
        let mut result = Vec::new();
        let mut cursor: Option<String> = None;
        let mut has_next_page = true;

        while has_next_page {
            let after_clause = cursor.as_ref()
                .map(|c| format!(r#", after: "{}""#, c))
                .unwrap_or_default();

            let query = format!(
                r#"{{
                    repository(owner: "{}", name: "{}") {{
                        pullRequest(number: {}) {{
                            reviewThreads(first: 100{}) {{
                                pageInfo {{
                                    hasNextPage
                                    endCursor
                                }}
                                nodes {{
                                    id
                                    isResolved
                                    path
                                    line
                                    diffSide
                                    comments(first: 1) {{
                                        nodes {{
                                            body
                                            author {{ login }}
                                        }}
                                    }}
                                }}
                            }}
                        }}
                    }}
                }}"#,
                owner, name, pr_number, after_clause
            );

            let response = self.gh_graphql(&query, None).await?;

            let review_threads = &response["data"]["repository"]["pullRequest"]["reviewThreads"];

            // Get pagination info
            let page_info = &review_threads["pageInfo"];
            has_next_page = page_info["hasNextPage"].as_bool().unwrap_or(false);
            cursor = page_info["endCursor"].as_str().map(|s| s.to_string());

            // Process threads
            let threads = review_threads["nodes"]
                .as_array()
                .ok_or_else(|| GhReplyError::GhError("Invalid response structure".to_string()))?;

            for thread in threads {
                let id = thread["id"].as_str().unwrap_or("").to_string();
                let path = thread["path"].as_str().unwrap_or("").to_string();
                let line = thread["line"].as_u64().map(|l| l as u32);
                let diff_side = thread["diffSide"].as_str().map(|s| s.to_string());
                let is_resolved = thread["isResolved"].as_bool().unwrap_or(false);

                let body = thread.get("comments")
                    .and_then(|c| c.get("nodes"))
                    .and_then(|n| n.as_array())
                    .and_then(|nodes| nodes.get(0))
                    .and_then(|comment| comment.get("body"))
                    .and_then(|b| b.as_str())
                    .unwrap_or("")
                    .to_string();

                result.push(ReviewThread {
                    id,
                    path,
                    line,
                    diff_side,
                    body,
                    is_resolved,
                });
            }
        }

        Ok(result)
    }

    /// Post a reply to a review thread
    pub async fn post_reply(
        &self,
        pr_number: u32,
        thread_id: &str,
        body: &str,
    ) -> Result<()> {
        // Try direct reply via GraphQL mutation
        let mutation = r#"mutation ($threadId: ID!, $body: String!) {
            addPullRequestReviewThreadReply(input: {pullRequestReviewThreadId: $threadId, body: $body}) {
                comment { id }
            }
        }"#;

        let variables = serde_json::json!({
            "threadId": thread_id,
            "body": body
        });

        self.gh_graphql(mutation, Some(variables)).await?;
        eprintln!("Reply posted to thread {}", thread_id);
        Ok(())
    }

    /// Resolve a review thread
    pub async fn resolve_thread(&self, thread_id: &str) -> Result<()> {
        let mutation = r#"mutation($threadId: ID!) {
            resolveReviewThread(input: {threadId: $threadId}) {
                thread { id }
            }
        }"#;
        let variables = serde_json::json!({
            "threadId": thread_id
        });

        self.gh_graphql(mutation, Some(variables)).await?;
        eprintln!("Resolved thread {}", thread_id);
        Ok(())
    }

    /// List PRs with state filter
    pub async fn list_prs(&self, state: &str) -> Result<Value> {
        let mut args = vec![
            "pr",
            "list",
            "--state",
            state,
            "--json",
            "number,title,author,url,state",
        ];

        let repo_arg;
        if let Some(repo) = &self.repo {
            repo_arg = repo.clone();
            args.push("--repo");
            args.push(&repo_arg);
        }

        self.gh_json(&args)
    }

}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    fn setup_test_env() {
        // Set GH_COMMAND to point to our mock script
        let current_dir = env::current_dir().unwrap();
        let mock_path = current_dir.join("tests/fixtures/gh-mock");

        if !mock_path.exists() {
            panic!("gh-mock not found at {:?}", mock_path);
        }

        // Set environment variable to use mock gh command
        env::set_var("GH_COMMAND", mock_path.to_str().unwrap());
    }

    #[test]
    fn test_ensure_gh_available_success() {
        setup_test_env();
        let result = GhClient::ensure_gh_available();
        assert!(result.is_ok());
    }

    #[test]
    fn test_get_repo_info_with_override() {
        let client = GhClient::new(Some("owner/repo".to_string()));
        let result = client.get_repo_info();
        assert!(result.is_ok());
        let (owner, name) = result.unwrap();
        assert_eq!(owner, "owner");
        assert_eq!(name, "repo");
    }

    #[test]
    fn test_get_repo_info_invalid_override() {
        let client = GhClient::new(Some("invalid".to_string()));
        let result = client.get_repo_info();
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Invalid repo override"));
    }

    #[test]
    fn test_get_repo_info_from_gh() {
        setup_test_env();
        let client = GhClient::new(None);
        let result = client.get_repo_info();
        assert!(result.is_ok());
        let (owner, name) = result.unwrap();
        assert_eq!(owner, "test-owner");
        assert_eq!(name, "test-repo");
    }

    #[test]
    fn test_get_authenticated_user() {
        setup_test_env();
        let client = GhClient::new(None);
        let result = client.get_authenticated_user();
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "testuser");
    }

    #[test]
    fn test_get_pr_details() {
        setup_test_env();
        let client = GhClient::new(None);
        let result = client.get_pr_details("123");
        assert!(result.is_ok());
        let details = result.unwrap();
        assert_eq!(details["title"].as_str().unwrap(), "Test PR");
    }

    #[test]
    fn test_get_pr_details_with_repo_override() {
        setup_test_env();
        let client = GhClient::new(Some("owner/repo".to_string()));
        let result = client.get_pr_details("123");
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_list_prs() {
        setup_test_env();
        let client = GhClient::new(None);
        let result = client.list_prs("open").await;
        assert!(result.is_ok());
        let prs = result.unwrap();
        assert!(prs.is_array());
    }

    #[tokio::test]
    async fn test_gh_graphql_simple() {
        setup_test_env();
        let client = GhClient::new(None);
        let result = client.gh_graphql("query { test }", None).await;
        assert!(result.is_ok());
        let response = result.unwrap();
        assert!(response["data"].is_object());
    }

    #[tokio::test]
    async fn test_gh_graphql_with_variables() {
        setup_test_env();
        let client = GhClient::new(None);
        let variables = serde_json::json!({"id": "123"});
        let result = client.gh_graphql("query($id: ID!) { test(id: $id) }", Some(variables)).await;
        assert!(result.is_ok());
    }
}
