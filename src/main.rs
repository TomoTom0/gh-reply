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

    let client = github::GhClient::new(cli.repo);

    match &cli.command {
        Commands::Comment { action } => {
            commands::run_comment_command(&client, action).await?;
        }
        Commands::List { state } => {
            commands::run_list_command(&client, state).await?;
        }
    }

    Ok(())
}
