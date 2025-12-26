use crate::error::Result;
use crate::github::GhClient;
use crate::context::ContextBuilder;
use crate::vars::TemplateExpander;

/// Resolve thread identifier to thread ID
/// If the identifier is a number (index), fetch threads and resolve to ID
/// Otherwise, treat it as a thread ID directly
pub async fn resolve_thread_id(client: &GhClient, pr_number: u32, identifier: &str) -> Result<String> {
    // Try to parse as a number (index)
    if let Ok(index) = identifier.parse::<usize>() {
        let threads = client.get_review_threads(pr_number).await?;

        // Check if index is valid (1-based)
        if index == 0 || index > threads.len() {
            return Err(crate::error::GhReplyError::GhError(
                format!("Thread index {} is out of range (1-{})", index, threads.len())
            ));
        }

        // Return thread ID (index is 1-based)
        Ok(threads[index - 1].id.clone())
    } else {
        // Treat as thread ID
        Ok(identifier.to_string())
    }
}

pub async fn list(
    pr_number: u32,
    include_resolved: bool,
    _label: Option<&str>,
    _comment_filter: Option<&str>,
    _detail: Option<&str>,
    page: usize,
    per_page: usize,
) -> Result<()> {
    // Ensure gh CLI is available
    GhClient::ensure_gh_available()?;

    // Create GitHub client and fetch review threads
    let client = GhClient::new(None);
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

pub async fn show(pr_number: u32, thread_identifier: &str, _detail: Option<&str>) -> Result<()> {
    // Ensure gh CLI is available
    GhClient::ensure_gh_available()?;

    // Create GitHub client
    let client = GhClient::new(None);

    // Resolve thread identifier to thread ID
    let thread_id = resolve_thread_id(&client, pr_number, thread_identifier).await?;

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
    pr_number: u32,
    thread_identifier: &str,
    message: &str,
    resolve: bool,
    dry_run: bool,
) -> Result<()> {
    // Ensure gh CLI is available
    GhClient::ensure_gh_available()?;

    // Create GitHub client and context builder
    let client = GhClient::new(None);

    // Resolve thread identifier to thread ID
    let thread_id = resolve_thread_id(&client, pr_number, thread_identifier).await?;
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
