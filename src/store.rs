use crate::error::Result;
use crate::types::{DraftEntry, Drafts};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct DraftStore {
    drafts: Drafts,
}

impl DraftStore {
    const STORE_PATH: &'static str = ".git/info/gh-reply-drafts.json";

    pub fn load() -> Result<Self> {
        let path = Self::store_path()?;
        if !path.exists() {
            return Ok(Self::default());
        }

        let content = fs::read_to_string(&path)?;
        let drafts: Drafts = serde_json::from_str(&content)?;
        Ok(Self { drafts })
    }

    pub fn save(&self) -> Result<()> {
        let path = Self::store_path()?;
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }

        let content = serde_json::to_string_pretty(&self.drafts)?;
        fs::write(&path, content)?;
        Ok(())
    }

    pub fn add_draft(&mut self, pr_number: u32, thread_id: &str, draft: DraftEntry) {
        let pr_key = pr_number.to_string();
        self.drafts
            .entry(pr_key)
            .or_insert_with(HashMap::new)
            .insert(thread_id.to_string(), draft);
    }

    pub fn get_draft(&self, pr_number: u32, thread_id: &str) -> Option<&DraftEntry> {
        let pr_key = pr_number.to_string();
        self.drafts
            .get(&pr_key)
            .and_then(|threads| threads.get(thread_id))
    }

    pub fn get_all_drafts(&self, pr_number: u32) -> HashMap<String, DraftEntry> {
        let pr_key = pr_number.to_string();
        self.drafts.get(&pr_key).cloned().unwrap_or_default()
    }

    pub fn remove_draft(&mut self, pr_number: u32, thread_id: &str) -> bool {
        let pr_key = pr_number.to_string();
        if let Some(threads) = self.drafts.get_mut(&pr_key) {
            return threads.remove(thread_id).is_some();
        }
        false
    }

    pub fn clear_drafts(&mut self, pr_number: u32) {
        let pr_key = pr_number.to_string();
        self.drafts.remove(&pr_key);
    }

    fn store_path() -> Result<PathBuf> {
        let output = std::process::Command::new("git")
            .args(&["rev-parse", "--show-toplevel"])
            .output()?;

        if !output.status.success() {
            return Err(crate::error::GhReplyError::StoreError(
                "Not a git repository. Failed to find .git directory.".to_string(),
            ));
        }
        let git_root = String::from_utf8_lossy(&output.stdout).trim().to_string();
        Ok(std::path::PathBuf::from(git_root).join(Self::STORE_PATH))
    }
}

impl Default for DraftStore {
    fn default() -> Self {
        Self {
            drafts: HashMap::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_add_and_get_draft() {
        let mut store = DraftStore::default();

        let draft = DraftEntry {
            body: "Test message".to_string(),
            path: None,
            line: None,
            original_comment: None,
            resolve: Some(true),
            timestamp: "2024-01-01T00:00:00Z".to_string(),
        };

        store.add_draft(123, "thread-1", draft.clone());

        let retrieved = store.get_draft(123, "thread-1");
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().body, "Test message");
    }

    #[test]
    fn test_get_nonexistent_draft() {
        let store = DraftStore::default();

        let result = store.get_draft(999, "nonexistent");
        assert!(result.is_none());
    }

    #[test]
    fn test_get_all_drafts() {
        let mut store = DraftStore::default();

        let draft1 = DraftEntry {
            body: "Message 1".to_string(),
            path: None,
            line: None,
            original_comment: None,
            resolve: None,
            timestamp: "2024-01-01T00:00:00Z".to_string(),
        };

        let draft2 = DraftEntry {
            body: "Message 2".to_string(),
            path: None,
            line: None,
            original_comment: None,
            resolve: None,
            timestamp: "2024-01-01T00:00:00Z".to_string(),
        };

        store.add_draft(123, "thread-1", draft1);
        store.add_draft(123, "thread-2", draft2);

        let all_drafts = store.get_all_drafts(123);
        assert_eq!(all_drafts.len(), 2);
        assert!(all_drafts.contains_key("thread-1"));
        assert!(all_drafts.contains_key("thread-2"));
    }

    #[test]
    fn test_remove_draft() {
        let mut store = DraftStore::default();

        let draft = DraftEntry {
            body: "Test message".to_string(),
            path: None,
            line: None,
            original_comment: None,
            resolve: None,
            timestamp: "2024-01-01T00:00:00Z".to_string(),
        };

        store.add_draft(123, "thread-1", draft);

        // Remove draft
        let removed = store.remove_draft(123, "thread-1");
        assert!(removed);

        // Verify it's gone
        let result = store.get_draft(123, "thread-1");
        assert!(result.is_none());
    }

    #[test]
    fn test_clear_drafts() {
        let mut store = DraftStore::default();

        let draft1 = DraftEntry {
            body: "Message 1".to_string(),
            path: None,
            line: None,
            original_comment: None,
            resolve: None,
            timestamp: "2024-01-01T00:00:00Z".to_string(),
        };

        let draft2 = DraftEntry {
            body: "Message 2".to_string(),
            path: None,
            line: None,
            original_comment: None,
            resolve: None,
            timestamp: "2024-01-01T00:00:00Z".to_string(),
        };

        store.add_draft(123, "thread-1", draft1);
        store.add_draft(123, "thread-2", draft2);

        // Clear all drafts for PR 123
        store.clear_drafts(123);

        let all_drafts = store.get_all_drafts(123);
        assert_eq!(all_drafts.len(), 0);
    }

    #[test]
    fn test_multiple_prs() {
        let mut store = DraftStore::default();

        let draft1 = DraftEntry {
            body: "PR 123".to_string(),
            path: None,
            line: None,
            original_comment: None,
            resolve: None,
            timestamp: "2024-01-01T00:00:00Z".to_string(),
        };

        let draft2 = DraftEntry {
            body: "PR 456".to_string(),
            path: None,
            line: None,
            original_comment: None,
            resolve: None,
            timestamp: "2024-01-01T00:00:00Z".to_string(),
        };

        store.add_draft(123, "thread-1", draft1);
        store.add_draft(456, "thread-1", draft2);

        // Verify both PRs have drafts
        assert_eq!(store.get_all_drafts(123).len(), 1);
        assert_eq!(store.get_all_drafts(456).len(), 1);

        // Clear drafts for PR 123
        store.clear_drafts(123);

        // PR 123 should be empty, PR 456 should still have drafts
        assert_eq!(store.get_all_drafts(123).len(), 0);
        assert_eq!(store.get_all_drafts(456).len(), 1);
    }
}
