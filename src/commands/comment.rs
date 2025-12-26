use crate::error::Result;
use crate::github::GhClient;
use crate::context::ContextBuilder;
use crate::vars::TemplateExpander;

/// Resolve thread identifier to thread ID
/// Either thread_id or index must be provided
pub async fn resolve_thread_id(
    client: &GhClient,
    pr_number: u32,
    thread_id: Option<&str>,
    index: Option<usize>
) -> Result<String> {
    match (thread_id, index) {
        (Some(id), None) => {
            // Thread ID provided directly
            Ok(id.to_string())
        }
        (None, Some(idx)) => {
            // Index provided, resolve to thread ID
            let threads = client.get_review_threads(pr_number).await?;

            // Check if index is valid (1-based)
            if idx == 0 || idx > threads.len() {
                return Err(crate::error::GhReplyError::GhError(
                    format!("Thread index {} is out of range (1-{})", idx, threads.len())
                ));
            }

            // Return thread ID (index is 1-based)
            Ok(threads[idx - 1].id.clone())
        }
        (Some(_), Some(_)) => {
            Err(crate::error::GhReplyError::GhError(
                "Cannot specify both thread_id and index".to_string()
            ))
        }
        (None, None) => {
            Err(crate::error::GhReplyError::GhError(
                "Must specify either thread_id or --index".to_string()
            ))
        }
    }
}

pub async fn list(
    client: &GhClient,
    pr_number: u32,
    include_resolved: bool,
    label: Option<&str>,
    comment_filter: Option<&str>,
    detail: Option<&str>,
    page: usize,
    per_page: usize,
) -> Result<()> {
    // Check for unimplemented options
    if label.is_some() {
        return Err(crate::error::GhReplyError::GhError(
            "Option --label is not yet implemented".to_string()
        ));
    }
    if comment_filter.is_some() {
        return Err(crate::error::GhReplyError::GhError(
            "Option --comment-filter is not yet implemented".to_string()
        ));
    }
    if detail.is_some() {
        return Err(crate::error::GhReplyError::GhError(
            "Option --detail is not yet implemented".to_string()
        ));
    }

    // Ensure gh CLI is available
    GhClient::ensure_gh_available()?;

    // Fetch review threads
    let threads = client.get_review_threads(pr_number).await?;

    // Filter threads based on options
    let filtered_threads: Vec<_> = threads
        .iter()
        .filter(|t| include_resolved || !t.is_resolved)
        .collect();

    // Apply pagination
    let start = (page - 1) * per_page;
    let end = start + per_page;
    let paginated_threads: Vec<_> = filtered_threads
        .into_iter()
        .skip(start)
        .take(per_page)
        .collect();

    // Output as JSON
    let output = serde_json::json!({
        "total": threads.len(),
        "page": page,
        "perPage": per_page,
        "items": paginated_threads,
    });

    println!("{}", serde_json::to_string_pretty(&output)?);
    Ok(())
}

pub async fn show(client: &GhClient, pr_number: u32, thread_id: Option<&str>, index: Option<usize>, detail: Option<&str>) -> Result<()> {
    // Check for unimplemented options
    if detail.is_some() {
        return Err(crate::error::GhReplyError::GhError(
            "Option --detail is not yet implemented".to_string()
        ));
    }

    // Ensure gh CLI is available
    GhClient::ensure_gh_available()?;

    // Resolve thread identifier to thread ID
    let thread_id = resolve_thread_id(client, pr_number, thread_id, index).await?;

    // Fetch review threads
    let threads = client.get_review_threads(pr_number).await?;

    // Find the specific thread
    let thread = threads.iter()
        .find(|t| t.id == thread_id)
        .ok_or_else(|| crate::error::GhReplyError::GhError(
            format!("Thread {} not found", thread_id)
        ))?;

    // Output as JSON
    println!("{}", serde_json::to_string_pretty(thread)?);
    Ok(())
}

pub async fn reply(
    client: &GhClient,
    pr_number: u32,
    thread_id: Option<&str>,
    index: Option<usize>,
    message: &str,
    resolve: bool,
    dry_run: bool,
) -> Result<()> {
    // Ensure gh CLI is available
    GhClient::ensure_gh_available()?;

    // Resolve thread identifier to thread ID
    let thread_id = resolve_thread_id(client, pr_number, thread_id, index).await?;
    let context_builder = ContextBuilder::new(client.clone());

    // Build reply context
    let context = context_builder.build_reply_context(
        &pr_number.to_string(),
        &thread_id
    ).await?;

    // Expand template variables in the message
    let expander = TemplateExpander::from_context(&context);
    let expanded_message = expander.expand(message)?;

    if dry_run {
        eprintln!("Dry run mode - would post reply:");
        eprintln!("PR: {}", pr_number);
        eprintln!("Thread: {}", thread_id);
        eprintln!("Message: {}", expanded_message);
        if resolve {
            eprintln!("Would resolve thread");
        }
        return Ok(());
    }

    // Post the reply
    client.post_reply(pr_number, &thread_id, &expanded_message).await?;

    // Resolve thread if requested
    if resolve {
        client.resolve_thread(&thread_id).await?;
    }

    eprintln!("Reply posted successfully");
    Ok(())
}
