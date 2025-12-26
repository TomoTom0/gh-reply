use clap::{Parser, Subcommand};

#[derive(Parser, Debug)]
#[command(name = "gh-reply")]
#[command(about = "CLI to manage draft replies to GitHub PR review comments", long_about = None)]
pub struct Cli {
    /// Repository to use (format: owner/repo)
    #[arg(short = 'R', long, global = true)]
    pub repo: Option<String>,

    #[command(subcommand)]
    pub command: Commands,
}

#[derive(Subcommand, Debug)]
pub enum Commands {
    /// Comment-related commands
    Comment {
        #[command(subcommand)]
        action: CommentAction,
    },
    /// List PRs
    List {
        /// PR state: open, closed, merged, all
        #[arg(long, default_value = "open")]
        state: String,
    },
}

#[derive(Subcommand, Debug)]
pub enum CommentAction {
    /// List review comments for a PR
    List {
        /// Pull request number
        pr_number: u32,
        /// Include resolved threads
        #[arg(long)]
        all: bool,
        /// Filter by PR label (comma-separated)
        #[arg(long)]
        label: Option<String>,
        /// Filter comments (author:NAME, contains:TEXT, severity:LEVEL)
        #[arg(long)]
        comment_filter: Option<String>,
        /// Include detail fields (url, bodyHTML, diffHunk, commitOid)
        #[arg(long)]
        detail: Option<String>,
        /// Page number
        #[arg(long, default_value = "1")]
        page: usize,
        /// Items per page
        #[arg(long, default_value = "10")]
        per_page: usize,
    },
    /// Show details of a specific comment thread
    Show {
        /// Pull request number
        pr_number: u32,
        /// Thread ID (e.g., PRRT_kwDOQZVIxM5nXEc_) or index with # prefix (e.g., #1, #2)
        thread_id: String,
        /// Include detail fields (url, bodyHTML, diffHunk, commitOid)
        #[arg(long)]
        detail: Option<String>,
    },
    /// Reply to a comment thread
    Reply {
        /// Pull request number
        pr_number: u32,
        /// Thread ID (e.g., PRRT_kwDOQZVIxM5nXEc_) or index with # prefix (e.g., #1, #2), or "main" for PR-level comment
        thread_id: String,
        /// Reply message
        message: String,
        /// Resolve the thread after replying
        #[arg(short = 'r', long)]
        resolve: bool,
        /// Dry run - don't actually send
        #[arg(long)]
        dry_run: bool,
    },
    /// Draft-related commands
    Draft {
        #[command(subcommand)]
        action: DraftAction,
    },
}

#[derive(Subcommand, Debug)]
pub enum DraftAction {
    /// Add a draft reply
    Add {
        /// Pull request number
        pr_number: u32,
        /// Thread ID (e.g., PRRT_kwDOQZVIxM5nXEc_) or index with # prefix (e.g., #1, #2), or "main" for PR-level comment
        thread_id: String,
        /// Reply message
        message: String,
        /// Resolve the thread when sending
        #[arg(short = 'r', long)]
        resolve: bool,
    },
    /// Show all draft replies
    Show {
        /// Pull request number
        pr_number: u32,
    },
    /// Send all draft replies
    Send {
        /// Pull request number
        pr_number: u32,
        /// Force send even if body is empty
        #[arg(short = 'f', long)]
        force: bool,
        /// Dry run - don't actually send
        #[arg(long)]
        dry_run: bool,
    },
    /// Clear all draft replies
    Clear {
        /// Pull request number
        pr_number: u32,
    },
}
