use crate::sandbox::{SandboxViolation, ViolationSeverity};
use std::collections::HashSet;

pub struct NetworkRule {
    pub allowed_domains: HashSet<String>,
    pub blocked_domains: HashSet<String>,
    pub allow_all_https: bool,
    pub allow_localhost: bool,
    pub allowed_schemes: HashSet<String>,
}

impl Default for NetworkRule {
    fn default() -> Self {
        Self::strict()
    }
}

impl NetworkRule {
    pub fn permissive() -> Self {
        Self {
            allowed_domains: HashSet::new(),
            blocked_domains: HashSet::from(["localhost:0".into()]),
            allow_all_https: true,
            allow_localhost: true,
            allowed_schemes: HashSet::from(["https".into(), "http".into()]),
        }
    }

    pub fn strict() -> Self {
        Self {
            allowed_domains: HashSet::from([
                "api.openai.com".into(),
                "api.anthropic.com".into(),
                "api.groq.com".into(),
                "generativelanguage.googleapis.com".into(),
                "registry.npmjs.org".into(),
                "raw.githubusercontent.com".into(),
                "api.github.com".into(),
                "github.com".into(),
            ]),
            blocked_domains: HashSet::from(["localhost:0".into()]),
            allow_all_https: false,
            allow_localhost: true,
            allowed_schemes: HashSet::from(["https".into()]),
        }
    }

    fn parse_url_simple(url_str: &str) -> Option<(String, String, u16)> {
        let url_str = url_str.trim();

        let scheme_end = url_str.find("://")?;
        let scheme = url_str[..scheme_end].to_lowercase();
        let after_scheme = &url_str[scheme_end + 3..];

        let (host_part, _path) = match after_scheme.find('/') {
            Some(pos) => (&after_scheme[..pos], &after_scheme[pos..]),
            None => (after_scheme, ""),
        };

        let (host, port) = match host_part.find(':') {
            Some(pos) => {
                let h = &host_part[..pos];
                let p: u16 = host_part[pos + 1..].parse().unwrap_or(443);
                (h.to_lowercase(), p)
            }
            None => (host_part.to_lowercase(), if scheme == "https" { 443 } else { 80 }),
        };

        Some((scheme, host, port))
    }

    pub fn validate(&self, url_str: &str) -> Result<(), SandboxViolation> {
        let (scheme, host, _port) = match Self::parse_url_simple(url_str) {
            Some(p) => p,
            None => {
                return Err(SandboxViolation {
                    category: "invalid_url".into(),
                    detail: format!("Cannot parse URL: {}", url_str),
                    severity: ViolationSeverity::Deny,
                });
            }
        };

        if !self.allowed_schemes.contains(&scheme) {
            return Err(SandboxViolation {
                category: "scheme_blocked".into(),
                detail: format!("URL scheme '{}' is not allowed", scheme),
                severity: ViolationSeverity::Deny,
            });
        }

        if self.allow_all_https && scheme == "https" {
            return Ok(());
        }

        if self.allow_localhost
            && (host == "localhost" || host == "127.0.0.1" || host == "::1")
        {
            return Ok(());
        }

        if self.blocked_domains.contains(&host) {
            return Err(SandboxViolation {
                category: "domain_blocked".into(),
                detail: format!("Domain '{}' is blocked", host),
                severity: ViolationSeverity::Deny,
            });
        }

        if !self.allowed_domains.is_empty() {
            let allowed = self.allowed_domains.iter().any(|d| {
                if let Some(suffix) = d.strip_prefix("*.") {
                    host.ends_with(suffix)
                } else {
                    host == *d || host.ends_with(&format!(".{}", d))
                }
            });

            if !allowed {
                return Err(SandboxViolation {
                    category: "domain_not_allowed".into(),
                    detail: format!("Domain '{}' is not in the allowed list", host),
                    severity: ViolationSeverity::Deny,
                });
            }
        }

        Ok(())
    }
}
