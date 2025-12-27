use crate::error::{GhReplyError, Result};
use crate::types::ReplyContext;
use regex::Regex;
use std::collections::HashMap;

pub struct TemplateExpander {
    vars: HashMap<String, String>,
}

impl TemplateExpander {
    pub fn new() -> Self {
        Self {
            vars: HashMap::new(),
        }
    }

    pub fn from_context(context: &ReplyContext) -> Self {
        let mut vars = HashMap::new();
        vars.insert("pr_number".to_string(), context.base.pr_number.clone());
        vars.insert("reply_to".to_string(), context.reply_to.clone());
        vars.insert("author".to_string(), context.base.author.clone());
        vars.insert("repo_owner".to_string(), context.base.repo_owner.clone());
        vars.insert("repo_name".to_string(), context.base.repo_name.clone());
        vars.insert("repo_url".to_string(), context.base.repo_url.clone());
        vars.insert("username".to_string(), context.base.username.clone());
        vars.insert("date".to_string(), context.base.date.clone());
        vars.insert("pr_title".to_string(), context.base.pr_title.clone());
        vars.insert("base_branch".to_string(), context.base.base_branch.clone());
        vars.insert("head_branch".to_string(), context.base.head_branch.clone());
        vars.insert("local_commit".to_string(), context.base.local_commit.clone());

        Self { vars }
    }

    pub fn add_var(&mut self, key: impl Into<String>, value: impl Into<String>) {
        self.vars.insert(key.into(), value.into());
    }

    pub fn expand(&self, template: &str) -> Result<String> {
        // Allow whitespace around variable names: {{ var }} or {{var}}
        let re = Regex::new(r"\{\{\s*(\w+)\s*\}\}")
            .map_err(|e| GhReplyError::TemplateError(format!("Invalid regex: {}", e)))?;

        let mut result = template.to_string();
        for cap in re.captures_iter(template) {
            let full_match = &cap[0];
            let var_name = &cap[1];
            // Replace with value or empty string if variable not found (Node.js behavior)
            let value = self.vars.get(var_name).map(|s| s.as_str()).unwrap_or("");
            result = result.replace(full_match, value);
        }

        Ok(result)
    }
}

impl Default for TemplateExpander {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_expand_simple_variable() {
        let mut expander = TemplateExpander::new();
        expander.add_var("name", "World");

        let result = expander.expand("Hello {{name}}!").unwrap();
        assert_eq!(result, "Hello World!");
    }

    #[test]
    fn test_expand_multiple_variables() {
        let mut expander = TemplateExpander::new();
        expander.add_var("greeting", "Hello");
        expander.add_var("name", "World");

        let result = expander.expand("{{greeting}} {{name}}!").unwrap();
        assert_eq!(result, "Hello World!");
    }

    #[test]
    fn test_expand_with_whitespace() {
        let mut expander = TemplateExpander::new();
        expander.add_var("name", "World");

        // Test various whitespace patterns
        assert_eq!(expander.expand("{{ name }}").unwrap(), "World");
        assert_eq!(expander.expand("{{name}}").unwrap(), "World");
        assert_eq!(expander.expand("{{  name  }}").unwrap(), "World");
    }

    #[test]
    fn test_expand_undefined_variable() {
        let expander = TemplateExpander::new();

        // Undefined variables should be replaced with empty string (Node.js behavior)
        let result = expander.expand("Hello {{unknown}}!").unwrap();
        assert_eq!(result, "Hello !");
    }

    #[test]
    fn test_expand_same_variable_multiple_times() {
        let mut expander = TemplateExpander::new();
        expander.add_var("x", "1");
        expander.add_var("result", "2");

        let result = expander.expand("{{x}} + {{x}} = {{result}}").unwrap();
        assert_eq!(result, "1 + 1 = 2");
    }

    #[test]
    fn test_expand_empty_template() {
        let mut expander = TemplateExpander::new();
        expander.add_var("name", "World");

        let result = expander.expand("").unwrap();
        assert_eq!(result, "");
    }

    #[test]
    fn test_expand_no_variables() {
        let expander = TemplateExpander::new();

        let result = expander.expand("Hello World!").unwrap();
        assert_eq!(result, "Hello World!");
    }

    #[test]
    fn test_expand_with_underscore() {
        let mut expander = TemplateExpander::new();
        expander.add_var("first_name", "John");
        expander.add_var("last_name", "Doe");

        let result = expander.expand("{{first_name}} {{last_name}}").unwrap();
        assert_eq!(result, "John Doe");
    }

    #[test]
    fn test_expand_with_numbers() {
        let mut expander = TemplateExpander::new();
        expander.add_var("var1", "a");
        expander.add_var("var2", "b");

        let result = expander.expand("{{var1}} {{var2}}").unwrap();
        assert_eq!(result, "a b");
    }

    #[test]
    fn test_from_context() {
        use crate::types::{BaseReplyContext, ReplyContext};

        let base = BaseReplyContext {
            repo_owner: "owner".to_string(),
            repo_name: "repo".to_string(),
            pr_number: "123".to_string(),
            date: "2024-01-01".to_string(),
            username: "user".to_string(),
            repo_url: "https://github.com/owner/repo".to_string(),
            base_branch: "main".to_string(),
            head_branch: "feature".to_string(),
            pr_title: "Test PR".to_string(),
            author: "author".to_string(),
            local_commit: "abc123".to_string(),
        };

        let context = ReplyContext {
            base,
            reply_to: "reviewer".to_string(),
        };

        let expander = TemplateExpander::from_context(&context);

        let result = expander.expand("PR #{{pr_number}} by {{author}}").unwrap();
        assert_eq!(result, "PR #123 by author");
    }
}
