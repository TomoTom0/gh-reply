use crate::error::Result;
use crate::github::GhClient;

pub async fn list(client: &GhClient, state: &str) -> Result<()> {
    // Validate state parameter
    let valid_states = ["open", "closed", "merged", "all"];
    let state_value = if valid_states.contains(&state) {
        state
    } else {
        "open"
    };

    // Ensure gh CLI is available
    GhClient::ensure_gh_available()?;

    // Execute gh pr list command
    let result = client.list_prs(state_value).await?;

    // Output as JSON
    println!("{}", serde_json::to_string_pretty(&result)?);
    Ok(())
}
