pub mod comment;
pub mod draft;
pub mod list;

use crate::error::Result;

pub async fn run_comment_command(action: &crate::cli::CommentAction) -> Result<()> {
    match action {
        crate::cli::CommentAction::List {
            pr_number,
            all,
            label,
            comment_filter,
            detail,
            page,
            per_page,
        } => {
            comment::list(
                *pr_number,
                *all,
                label.as_deref(),
                comment_filter.as_deref(),
                detail.as_deref(),
                *page,
                *per_page,
            )
            .await
        }
        crate::cli::CommentAction::Show {
            pr_number,
            thread_id,
            detail,
        } => comment::show(*pr_number, thread_id, detail.as_deref()).await,
        crate::cli::CommentAction::Reply {
            pr_number,
            thread_id,
            message,
            resolve,
            dry_run,
        } => comment::reply(*pr_number, thread_id, message, *resolve, *dry_run).await,
        crate::cli::CommentAction::Draft { action } => run_draft_command(action).await,
    }
}

pub async fn run_draft_command(action: &crate::cli::DraftAction) -> Result<()> {
    match action {
        crate::cli::DraftAction::Add {
            pr_number,
            thread_id,
            message,
            resolve,
        } => draft::add(*pr_number, thread_id, message, *resolve).await,
        crate::cli::DraftAction::Show { pr_number } => draft::show(*pr_number).await,
        crate::cli::DraftAction::Send {
            pr_number,
            force,
            dry_run,
        } => draft::send(*pr_number, *force, *dry_run).await,
        crate::cli::DraftAction::Clear { pr_number } => draft::clear(*pr_number).await,
    }
}

pub async fn run_list_command(state: &str) -> Result<()> {
    list::list(state).await
}
