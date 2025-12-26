// Integration tests for commands
use std::env;
use std::fs;
use std::path::PathBuf;

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

#[cfg(test)]
mod list_command_tests {
    use super::*;

    #[tokio::test]
    async fn test_list_command_open_state() {
        setup_test_env();
        // list command internally calls GhClient::list_prs
        // which uses gh-mock via GH_COMMAND
        let result = gh_reply::commands::list::list("open").await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_list_command_invalid_state_fallback() {
        setup_test_env();
        // Invalid state should fallback to "open"
        let result = gh_reply::commands::list::list("invalid_state").await;
        assert!(result.is_ok());
    }
}

#[cfg(test)]
mod comment_command_tests {
    use super::*;

    #[tokio::test]
    async fn test_comment_list() {
        setup_test_env();
        // This will use the mock gh command
        let result = gh_reply::commands::comment::list(123, false, None, None, None, 1, 10).await;
        // May fail if mock doesn't return proper GraphQL response
        // but should not panic
        let _ = result;
    }

    #[tokio::test]
    async fn test_comment_show() {
        setup_test_env();
        let result = gh_reply::commands::comment::show(123, "THREAD_123", None).await;
        let _ = result;
    }

    #[tokio::test]
    async fn test_comment_reply_with_resolve() {
        setup_test_env();
        let result = gh_reply::commands::comment::reply(123, "THREAD_123", "Test reply", true, true).await;
        // Dry run should succeed
        assert!(result.is_ok());
    }
}

#[cfg(test)]
mod draft_command_tests {
    use super::*;

    #[tokio::test]
    async fn test_draft_add_and_show() {
        setup_test_env();
        cleanup_draft_store();

        // Add a draft with resolve flag
        let result = gh_reply::commands::draft::add(123, "thread-1", "Test message", true).await;
        assert!(result.is_ok());

        // Show drafts
        let result = gh_reply::commands::draft::show(123).await;
        assert!(result.is_ok());

        cleanup_draft_store();
    }

    #[tokio::test]
    async fn test_draft_clear() {
        setup_test_env();
        cleanup_draft_store();

        // Add a draft
        gh_reply::commands::draft::add(123, "thread-1", "Test message", false).await.ok();

        // Clear drafts
        let result = gh_reply::commands::draft::clear(123).await;
        assert!(result.is_ok());

        cleanup_draft_store();
    }

    #[tokio::test]
    async fn test_draft_send_dry_run() {
        setup_test_env();
        cleanup_draft_store();

        // Add a draft
        gh_reply::commands::draft::add(123, "thread-1", "Test message", true).await.ok();

        // Send drafts in dry run mode
        let result = gh_reply::commands::draft::send(123, false, true).await;
        assert!(result.is_ok());

        cleanup_draft_store();
    }
}
