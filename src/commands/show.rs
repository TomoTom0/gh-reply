use crate::error::Result;
use crate::github::GhClient;

pub async fn show(client: &GhClient, pr_number: u32) -> Result<()> {
    // Ensure gh CLI is available
    GhClient::ensure_gh_available()?;

    // Execute gh pr view command
    let result = client.show_pr(pr_number).await?;

    // Output as JSON
    println!("{}", serde_json::to_string_pretty(&result)?);
    Ok(())
}
