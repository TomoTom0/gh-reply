use crate::error::Result;
use crate::store::DraftStore;
use crate::types::DraftEntry;
use crate::github::GhClient;
use crate::context::ContextBuilder;
use crate::vars::TemplateExpander;

pub async fn add(pr_number: u32, thread_id: Option<&str>, index: Option<usize>, message: &str, resolve: bool) -> Result<()> {
    // Ensure gh CLI is available
    GhClient::ensure_gh_available()?;

    // Create GitHub client
    let client = GhClient::new(None);

    // Resolve thread identifier to thread ID
    let thread_id = super::comment::resolve_thread_id(&client, pr_number, thread_id, index).await?;

    // Load draft store
    let mut store = DraftStore::load()?;

    // Create draft entry
    let draft = DraftEntry {
        body: message.to_string(),
        path: None,
        line: None,
        original_comment: None,
        resolve: if resolve { Some(true) } else { None },
        timestamp: chrono::Utc::now().to_rfc3339(),
    };

    // Add draft to store
    store.add_draft(pr_number, &thread_id, draft);

    // Save store
    store.save()?;

    eprintln!("Draft saved.");
    Ok(())
}

pub async fn show(pr_number: u32) -> Result<()> {
    // Load draft store
    let store = DraftStore::load()?;

    // Get all drafts for the PR
    let drafts = store.get_all_drafts(pr_number);

    // Output as JSON
    let output = serde_json::json!({
        "pr_number": pr_number,
        "total": drafts.len(),
        "drafts": drafts,
    });

    println!("{}", serde_json::to_string_pretty(&output)?);
    Ok(())
}

pub async fn send(pr_number: u32, force: bool, dry_run: bool) -> Result<()> {
    // Ensure gh CLI is available
    GhClient::ensure_gh_available()?;

    // Load draft store
    let mut store = DraftStore::load()?;

    // Get all drafts for the PR
    let drafts = store.get_all_drafts(pr_number);

    if drafts.is_empty() {
        eprintln!("No drafts to send for PR #{}", pr_number);
        return Ok(());
    }

    // Early return for dry run - no need to build context
    if dry_run {
        eprintln!("Dry run mode - would send {} drafts:", drafts.len());
        for (thread_id, draft) in &drafts {
            eprintln!("  Thread {}: {}", thread_id, draft.body);
            if draft.resolve.unwrap_or(false) {
                eprintln!("    (would resolve)");
            }
        }
        return Ok(());
    }

    // Create GitHub client and context builder
    let client = GhClient::new(None);
    let context_builder = ContextBuilder::new(client.clone());

    // Build base context once (optimization)
    let base_context = context_builder.build_base_context(&pr_number.to_string()).await?;

    // Send each draft
    for (thread_id, draft) in drafts {
        // Skip empty bodies unless force is set
        if !force && draft.body.is_empty() {
            eprintln!("Skipping empty draft for thread {} (use --force to send)", thread_id);
            continue;
        }

        // Get reply-to author
        let reply_to = context_builder.get_reply_to_author(&thread_id).await?;

        // Build context
        let context = crate::types::ReplyContext {
            base: base_context.clone(),
            reply_to,
        };

        // Expand template variables
        let expander = TemplateExpander::from_context(&context);
        let expanded_message = expander.expand(&draft.body)?;

        // Post the reply
        client.post_reply(pr_number, &thread_id, &expanded_message).await?;

        // Resolve thread if requested in draft
        if draft.resolve.unwrap_or(false) {
            client.resolve_thread(&thread_id).await?;
        }

        // Remove draft from store and save immediately
        store.remove_draft(pr_number, &thread_id);
        store.save()?;
    }

    eprintln!("All replies processed.");
    Ok(())
}

pub async fn clear(pr_number: u32) -> Result<()> {
    // Load draft store
    let mut store = DraftStore::load()?;

    // Clear drafts for the PR
    store.clear_drafts(pr_number);

    // Save store
    store.save()?;

    eprintln!("Drafts cleared for PR #{}", pr_number);
    Ok(())
}
