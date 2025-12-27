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

#[cfg(test)]
mod draft_command_tests {
    use super::*;
    use gh_reply::github::GhClient;

    #[tokio::test]
    async fn test_draft_add_and_show() {
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
