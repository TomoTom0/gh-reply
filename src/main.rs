mod cli;
mod commands;
mod context;
mod error;
mod github;
mod store;
mod types;
mod vars;

use clap::Parser;
use cli::{Cli, Commands};
use error::Result;

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    match &cli.command {
        Commands::Comment { action } => {
            commands::run_comment_command(action).await?;
        }
        Commands::Draft { action } => {
            commands::run_draft_command(action).await?;
        }
        Commands::List { state } => {
            commands::run_list_command(state).await?;
        }
    }

    Ok(())
}
