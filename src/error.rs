use thiserror::Error;

#[derive(Error, Debug)]
pub enum GhReplyError {
    #[error("GitHub CLI error: {0}")]
    GhError(String),

    #[error("Store error: {0}")]
    StoreError(String),

    #[error("Template error: {0}")]
    TemplateError(String),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    JsonError(#[from] serde_json::Error),

    #[error(transparent)]
    Other(#[from] anyhow::Error),
}

pub type Result<T> = std::result::Result<T, GhReplyError>;
