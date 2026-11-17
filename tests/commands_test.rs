// Integration tests for commands
use std::env;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

fn setup_test_env() {
    // Set GH_COMMAND to point to our mock script
    let current_dir = env::current_dir().unwrap();
    let mock_path = current_dir.join("tests/fixtures/gh-mock");

    if !mock_path.exists() {
        panic!("gh-mock not found at {:?}", mock_path);
    }

    env::set_var("GH_COMMAND", mock_path.to_str().unwrap());
}

fn cleanup_draft_store() {
    let draft_path: PathBuf = ".git/info/gh-reply-drafts.json".into();
    if draft_path.exists() {
        fs::remove_file(&draft_path).ok();
    }
}

// The draft tests below all remove, write and read the single on-disk draft
// store (.git/info/gh-reply-drafts.json). cargo test runs tests in parallel
// by default, and interleaved remove/write/read access to that one file makes
// DraftStore::load() fail intermittently (the file is deleted between the
// exists() check and read_to_string, or a just-truncated file is parsed as
// empty JSON). Serialize these tests so each one owns the store exclusively.
static DRAFT_STORE_LOCK: Mutex<()> = Mutex::new(());

// Guard that enables gh-mock invocation logging (GH_MOCK_LOG) for a single
// test and always tears it down, even when an assertion fails mid-test.
// GH_MOCK_LOG is a process-global environment variable inherited by every
// gh-mock child process, so tests using it must not run concurrently with
// each other (they all take DRAFT_STORE_LOCK for that reason).
struct MockLogGuard {
    path: PathBuf,
}

impl MockLogGuard {
    fn new(tag: &str) -> Self {
        let path = env::temp_dir().join(format!("gh-reply-mock-{}.log", tag));
        let _ = fs::remove_file(&path);
        env::set_var("GH_MOCK_LOG", &path);
        Self { path }
    }

    fn read(&self) -> String {
        fs::read_to_string(&self.path).unwrap_or_default()
    }
}

impl Drop for MockLogGuard {
    fn drop(&mut self) {
        env::remove_var("GH_MOCK_LOG");
        let _ = fs::remove_file(&self.path);
    }
}

#[cfg(test)]
mod list_command_tests {
    use super::*;
    use gh_reply::github::GhClient;

    #[tokio::test]
    async fn test_list_command_open_state() {
        setup_test_env();
        let client = GhClient::new(None);
        // list command internally calls GhClient::list_prs
        // which uses gh-mock via GH_COMMAND
        let result = gh_reply::commands::list::list(&client, "open").await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_list_command_invalid_state_fallback() {
        setup_test_env();
        let client = GhClient::new(None);
        // Invalid state should fallback to "open"
        let result = gh_reply::commands::list::list(&client, "invalid_state").await;
        assert!(result.is_ok());
    }
}

#[cfg(test)]
mod show_command_tests {
    use super::*;
    use gh_reply::github::GhClient;

    #[tokio::test]
    async fn test_show_command() {
        setup_test_env();
        let client = GhClient::new(None);
        // show command internally calls GhClient::show_pr
        // which uses gh-mock via GH_COMMAND
        let result = gh_reply::commands::show::show(&client, 123).await;
        assert!(result.is_ok());
    }
}

#[cfg(test)]
mod comment_command_tests {
    use super::*;
    use gh_reply::github::GhClient;

    #[tokio::test]
    async fn test_comment_list() {
        setup_test_env();
        let client = GhClient::new(None);
        // This will use the mock gh command
        let result = gh_reply::commands::comment::list(&client, 123, false, None, None, None, 1, 10).await;
        // May fail if mock doesn't return proper GraphQL response
        // but should not panic
        let _ = result;
    }

    #[tokio::test]
    async fn test_comment_show() {
        setup_test_env();
        let client = GhClient::new(None);
        let result = gh_reply::commands::comment::show(&client, 123, Some("THREAD_123"), None, None).await;
        let _ = result;
    }

    #[tokio::test]
    async fn test_comment_reply_with_resolve() {
        setup_test_env();
        let client = GhClient::new(None);
        let result = gh_reply::commands::comment::reply(&client, 123, Some("THREAD_123"), None, "Test reply", true, true).await;
        // Dry run should succeed
        assert!(result.is_ok());
    }
}

// Tests for replying to the PR main conversation (thread_id = "main").
//
// PREMISE for the negative assertions below (design decision 6, review
// note 4): GH_MOCK_LOG is a process-global environment variable, so while
// one of these tests is running, gh-mock invocations made by OTHER tests
// running in parallel are also appended to the same log file. The negative
// assertions (e.g. "resolveReviewThread must not appear") therefore rely on
// the current suite containing no other test that performs a real send
// invoking `pr comment` or the resolve/reply mutations: every existing
// reply / draft-send test in this file uses dry_run=true and posts nothing.
// The four tests below serialize against each other via DRAFT_STORE_LOCK.
// Any future test that performs a real send must also hold DRAFT_STORE_LOCK
// (or otherwise avoid interleaving) to keep these assertions valid.
#[cfg(test)]
mod main_reply_command_tests {
    use super::*;
    use gh_reply::github::GhClient;

    // (1) reply main (real send) must post a PR-level comment via
    // `gh pr comment <PR> --body <MSG>` instead of a GraphQL mutation.
    #[tokio::test]
    async fn test_reply_main_posts_pr_comment() {
        let _store_guard = DRAFT_STORE_LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        setup_test_env();
        cleanup_draft_store();
        let log_guard = MockLogGuard::new("reply-main");
        let client = GhClient::new(None);

        let result = gh_reply::commands::comment::reply(
            &client, 123, Some("main"), None, "Main comment body", false, false,
        ).await;
        assert!(result.is_ok());

        let log = log_guard.read();
        let pr_comment_lines: Vec<&str> =
            log.lines().filter(|l| l.contains("pr comment")).collect();
        assert!(
            !pr_comment_lines.is_empty(),
            "expected a `pr comment` invocation in gh-mock log:\n{}", log
        );
        let pr_comment_line = pr_comment_lines.join("\n");
        assert!(
            pr_comment_line.contains("123"),
            "PR number missing from `pr comment` invocation:\n{}", pr_comment_line
        );
        assert!(
            pr_comment_line.contains("Main comment body"),
            "body missing from `pr comment` invocation:\n{}", pr_comment_line
        );

        cleanup_draft_store();
    }

    // (2) reply main with resolve=true must NOT run the resolveReviewThread
    // mutation (there is no thread to resolve for the PR main conversation).
    #[tokio::test]
    async fn test_reply_main_resolve_is_skipped() {
        let _store_guard = DRAFT_STORE_LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        setup_test_env();
        cleanup_draft_store();
        let log_guard = MockLogGuard::new("reply-main-resolve");
        let client = GhClient::new(None);

        let result = gh_reply::commands::comment::reply(
            &client, 123, Some("main"), None, "Main comment body", true, false,
        ).await;
        assert!(result.is_ok());

        let log = log_guard.read();
        assert!(
            !log.contains("resolveReviewThread"),
            "resolveReviewThread must not be invoked for main, but found in gh-mock log:\n{}", log
        );

        cleanup_draft_store();
    }

    // (3) draft add main (resolve=true) + send (real send) must post via
    // `pr comment`, must NOT resolve any thread, and must remove the draft
    // from the on-disk draft store (.git/info/gh-reply-drafts.json).
    #[tokio::test]
    async fn test_draft_main_send_posts_pr_comment_without_resolve() {
        let _store_guard = DRAFT_STORE_LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        setup_test_env();
        cleanup_draft_store();
        let log_guard = MockLogGuard::new("draft-main-send");
        let client = GhClient::new(None);

        // Add a main-conversation draft with the resolve flag set
        let result = gh_reply::commands::draft::add(
            &client, 123, Some("main"), None, "Draft main body", true,
        ).await;
        assert!(result.is_ok());

        // Send drafts for real (dry_run = false)
        let result = gh_reply::commands::draft::send(&client, 123, false, false).await;
        assert!(result.is_ok());

        let log = log_guard.read();
        let pr_comment_lines: Vec<&str> =
            log.lines().filter(|l| l.contains("pr comment")).collect();
        assert!(
            !pr_comment_lines.is_empty(),
            "expected a `pr comment` invocation in gh-mock log:\n{}", log
        );
        let pr_comment_line = pr_comment_lines.join("\n");
        assert!(
            pr_comment_line.contains("Draft main body"),
            "body missing from `pr comment` invocation:\n{}", pr_comment_line
        );
        assert!(
            !log.contains("resolveReviewThread"),
            "resolveReviewThread must not be invoked for main, but found in gh-mock log:\n{}", log
        );

        // The sent draft must be removed from the store
        let store_path: PathBuf = ".git/info/gh-reply-drafts.json".into();
        let store_content = fs::read_to_string(&store_path).unwrap_or_default();
        assert!(
            !store_content.contains("Draft main body"),
            "draft should have been removed from the store after send, store:\n{}", store_content
        );

        cleanup_draft_store();
    }

    // (4) Regression: replying to a normal thread (thread ID given directly)
    // must keep using the addPullRequestReviewThreadReply GraphQL mutation.
    #[tokio::test]
    async fn test_reply_thread_uses_graphql_thread_reply() {
        let _store_guard = DRAFT_STORE_LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        setup_test_env();
        cleanup_draft_store();
        let log_guard = MockLogGuard::new("reply-thread");
        let client = GhClient::new(None);

        let result = gh_reply::commands::comment::reply(
            &client, 123, Some("THREAD_123"), None, "Thread reply body", false, false,
        ).await;
        assert!(result.is_ok());

        let log = log_guard.read();
        assert!(
            log.contains("addPullRequestReviewThreadReply"),
            "expected addPullRequestReviewThreadReply mutation in gh-mock log:\n{}", log
        );

        cleanup_draft_store();
    }

    // (5) reply main with a repo-scoped client (-R / --repo) must forward the
    // repo to `gh pr comment`, so PR-level comments work from outside a
    // checkout of the target repository.
    #[tokio::test]
    async fn test_reply_main_passes_repo_flag_to_pr_comment() {
        let _store_guard = DRAFT_STORE_LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        setup_test_env();
        cleanup_draft_store();
        let log_guard = MockLogGuard::new("reply-main-repo");
        let client = GhClient::new(Some("test-owner/test-repo".to_string()));

        let result = gh_reply::commands::comment::reply(
            &client, 123, Some("main"), None, "Main comment body", false, false,
        ).await;
        assert!(result.is_ok());

        let log = log_guard.read();
        let pr_comment_lines: Vec<&str> =
            log.lines().filter(|l| l.contains("pr comment")).collect();
        assert!(
            !pr_comment_lines.is_empty(),
            "expected a `pr comment` invocation in gh-mock log:\n{}", log
        );
        let pr_comment_line = pr_comment_lines.join("\n");
        assert!(
            pr_comment_line.contains("--repo test-owner/test-repo"),
            "`pr comment` invocation must include `--repo test-owner/test-repo`:\n{}", pr_comment_line
        );

        cleanup_draft_store();
    }
}

#[cfg(test)]
mod draft_command_tests {
    use super::*;
    use gh_reply::github::GhClient;

    #[tokio::test]
    async fn test_draft_add_and_show() {
        let _store_guard = DRAFT_STORE_LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        setup_test_env();
        cleanup_draft_store();
        let client = GhClient::new(None);

        // Add a draft with resolve flag
        let result = gh_reply::commands::draft::add(&client, 123, Some("thread-1"), None, "Test message", true).await;
        assert!(result.is_ok());

        // Show drafts
        let result = gh_reply::commands::draft::show(&client, 123).await;
        assert!(result.is_ok());

        cleanup_draft_store();
    }

    #[tokio::test]
    async fn test_draft_clear() {
        let _store_guard = DRAFT_STORE_LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        setup_test_env();
        cleanup_draft_store();
        let client = GhClient::new(None);

        // Add a draft
        gh_reply::commands::draft::add(&client, 123, Some("thread-1"), None, "Test message", false).await.ok();

        // Clear drafts
        let result = gh_reply::commands::draft::clear(123).await;
        assert!(result.is_ok());

        cleanup_draft_store();
    }

    #[tokio::test]
    async fn test_draft_send_dry_run() {
        let _store_guard = DRAFT_STORE_LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        setup_test_env();
        cleanup_draft_store();
        let client = GhClient::new(None);

        // Add a draft
        gh_reply::commands::draft::add(&client, 123, Some("thread-1"), None, "Test message", true).await.ok();

        // Send drafts in dry run mode
        let result = gh_reply::commands::draft::send(&client, 123, false, true).await;
        assert!(result.is_ok());

        cleanup_draft_store();
    }
}
