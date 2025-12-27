pub mod comment;
pub mod draft;
pub mod list;
pub mod show;

use crate::error::Result;
use crate::github::GhClient;

pub async fn run_comment_command(client: &GhClient, action: &crate::cli::CommentAction) -> Result<()> {
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
                client,
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
            index,
            detail,
        } => comment::show(client, *pr_number, thread_id.as_deref(), *index, detail.as_deref()).await,
        crate::cli::CommentAction::Reply {
            pr_number,
            thread_id,
            index,
            message,
            resolve,
            dry_run,
        } => comment::reply(client, *pr_number, thread_id.as_deref(), *index, message, *resolve, *dry_run).await,
        crate::cli::CommentAction::Draft { action } => run_draft_command(client, action).await,
    }
}

pub async fn run_draft_command(client: &GhClient, action: &crate::cli::DraftAction) -> Result<()> {
    match action {
        crate::cli::DraftAction::Add {
            pr_number,
            thread_id,
            index,
            message,
            resolve,
        } => draft::add(client, *pr_number, thread_id.as_deref(), *index, message, *resolve).await,
        crate::cli::DraftAction::Show { pr_number } => draft::show(client, *pr_number).await,
        crate::cli::DraftAction::Send {
            pr_number,
            force,
            dry_run,
        } => draft::send(client, *pr_number, *force, *dry_run).await,
        crate::cli::DraftAction::Clear { pr_number } => draft::clear(*pr_number).await,
    }
}

pub async fn run_list_command(client: &GhClient, state: &str) -> Result<()> {
    list::list(client, state).await
}

pub async fn run_show_command(client: &GhClient, pr_number: u32) -> Result<()> {
    show::show(client, pr_number).await
}
