use serde::{Deserialize, Serialize};
use std::{collections::HashMap, path::Path};
use ts_rs::TS;
use utoipa::ToSchema;

pub const MAX_PROJECT_NAME_LENGTH: usize = 64;
pub const MAX_DEPENDENCIES_PER_LIST: usize = 50;
pub const MAX_DEPENDENCY_LENGTH: usize = 214;

#[derive(TS, Serialize, Deserialize, ToSchema, Debug, Clone, PartialEq)]
#[ts(export)]
#[serde(rename_all = "kebab-case")]
pub enum Framework {
    React,
    Nextjs,
    AngularTs,
    EmberTs,
    LitTs,
    MarkoTs,
    NuxtTs,
    PreactTs,
    PreactTsOfficial,
    QwikTs,
    ReactTs,
    SolidTs,
    SvelteTs,
    VueTs,
    Vue,
}

impl Framework {
    pub fn as_str(&self) -> &'static str {
        match self {
            Framework::AngularTs => "angular-ts",
            Framework::EmberTs => "ember-ts",
            Framework::LitTs => "lit-ts",
            Framework::MarkoTs => "marko-ts",
            Framework::NuxtTs => "nuxt-ts",
            Framework::PreactTs => "preact-ts",
            Framework::PreactTsOfficial => "preact-ts-official",
            Framework::QwikTs => "qwik-ts",
            Framework::ReactTs => "react-ts",
            Framework::SolidTs => "solid-ts",
            Framework::SvelteTs => "svelte-ts",
            Framework::VueTs => "vue-ts",
            Framework::Nextjs => "nextjs",
            Framework::React => "react-ts",
            Framework::Vue => "vue-ts",
        }
    }
}

#[derive(TS, Serialize, Deserialize, ToSchema, Debug, Clone, PartialEq)]
#[ts(export)]
#[serde(rename_all = "kebab-case")]
pub enum Routing {
    AppRouter,
    PagesRouter,
    ReactRouter,
    ReactRouterData,
    VueRouter,
    None,
}

#[derive(TS, Serialize, Deserialize, ToSchema, Debug, Clone, PartialEq)]
#[ts(export)]
#[serde(rename_all = "kebab-case")]
pub enum Styling {
    Tailwind,
    CssModules,
    StyledComponents,
}

#[derive(TS, Serialize, Deserialize, ToSchema, Debug, Clone, PartialEq)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum Linting {
    Eslint,
    Biome,
    None,
}

#[derive(TS, Serialize, Deserialize, ToSchema, Debug, Clone, PartialEq)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum StateManagement {
    None,
    Zustand,
    Redux,
    Jotai,
}

#[derive(TS, Serialize, Deserialize, ToSchema, Debug)]
#[ts(export)]
pub struct ProjectConfig {
    pub project_name: String,
    pub framework: Framework,
    pub styling: Styling,
    pub linting: Linting,
    pub state_management: StateManagement,
    pub routing: Routing,
    pub dependencies: Vec<String>,
    #[serde(default)]
    pub dev_dependencies: Vec<String>,
}

impl ProjectConfig {
    pub fn validate(&self) -> Result<(), ConfigValidationError> {
        let project_name = self.project_name.trim();
        if project_name.is_empty() {
            return Err(ConfigValidationError::new(
                "project_name_required",
                "Project name is required",
            ));
        }
        if project_name.len() > MAX_PROJECT_NAME_LENGTH {
            return Err(ConfigValidationError::new(
                "project_name_too_long",
                "Project name must be at most 64 characters",
            ));
        }
        if !project_name.bytes().all(|byte| {
            byte.is_ascii_lowercase() || byte.is_ascii_digit() || matches!(byte, b'-' | b'_')
        }) {
            return Err(ConfigValidationError::new(
                "project_name_invalid",
                "Project name may only contain lowercase ASCII letters, numbers, hyphens, and underscores",
            ));
        }

        validate_dependencies("dependencies", &self.dependencies)?;
        validate_dependencies("dev_dependencies", &self.dev_dependencies)?;
        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConfigValidationError {
    pub code: &'static str,
    pub message: &'static str,
}

impl ConfigValidationError {
    fn new(code: &'static str, message: &'static str) -> Self {
        Self { code, message }
    }
}

fn validate_dependencies(
    field: &'static str,
    dependencies: &[String],
) -> Result<(), ConfigValidationError> {
    if dependencies.len() > MAX_DEPENDENCIES_PER_LIST {
        return Err(ConfigValidationError::new(
            "too_many_dependencies",
            "Dependency lists may contain at most 50 entries",
        ));
    }

    if dependencies.iter().any(|dependency| {
        dependency.is_empty()
            || dependency.len() > MAX_DEPENDENCY_LENGTH
            || dependency.chars().any(char::is_whitespace)
            || dependency.chars().any(char::is_control)
    }) {
        let message = if field == "dependencies" {
            "Each dependency must be a non-empty package token without whitespace and at most 214 characters"
        } else {
            "Each development dependency must be a non-empty package token without whitespace and at most 214 characters"
        };
        return Err(ConfigValidationError::new("dependency_invalid", message));
    }

    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectTreeNode {
    pub name: String,
    #[serde(rename = "type")]
    pub node_type: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub children: Vec<ProjectTreeNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct DependencySearchResult {
    pub name: String,
    pub version: String,
    pub description: Option<String>,
}

// #[derive(Debug, Serialize, Deserialize, ToSchema)]
// pub struct Feature {
//   pub name: String,
//   pub label: String,
//   pub category: String,
// }

#[derive(Debug, Clone, Serialize, Deserialize, TS, Eq, PartialEq, Hash, ToSchema)]
#[ts(export)]
#[serde(rename_all = "kebab-case")]
pub enum Feature {
    React,
    Nextjs,
    Vue,
    AngularTs,
    EmberTs,
    LitTs,
    MarkoTs,
    NuxtTs,
    PreactTs,
    PreactTsOfficial,
    QwikTs,
    ReactTs,
    SolidTs,
    SvelteTs,
    VueTs,

    Tailwind,
    CssModules,
    StyledComponents,

    ReactRouter,
    VueRouter,

    Zustand,
    Redux,
    Jotai,

    Eslint,
    Biome,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, Eq, PartialEq, Hash, ToSchema)]
#[serde(rename_all = "kebab-case")]
pub enum Category {
    Framework,
    Routing,
    Styling,
    State,
    Linting,
}

pub fn feature_registry() -> HashMap<Feature, FeatureMeta> {
    use Category::*;
    use Feature::*;
    HashMap::from([
        // Frameworks
        (
            React,
            FeatureMeta {
                label: "React",
                description: "React framework",
                category: Framework,
                requires: &[],
                conflicts: &[Vue],
            },
        ),
        (
            Nextjs,
            FeatureMeta {
                label: "Next.js",
                description: "React meta framework",
                category: Framework,
                requires: &[React],
                conflicts: &[Vue],
            },
        ),
        (
            Vue,
            FeatureMeta {
                label: "Vue",
                description: "Vue framework",
                category: Framework,
                requires: &[],
                conflicts: &[React, Nextjs],
            },
        ),
        (
            ReactTs,
            FeatureMeta {
                label: "React + TypeScript",
                description: "React framework template with TypeScript",
                category: Framework,
                requires: &[React],
                conflicts: &[Vue, Nextjs, VueTs],
            },
        ),
        (
            VueTs,
            FeatureMeta {
                label: "Vue + TypeScript",
                description: "Vue framework template with TypeScript",
                category: Framework,
                requires: &[Vue],
                conflicts: &[React, Nextjs, ReactTs],
            },
        ),
        (
            AngularTs,
            FeatureMeta {
                label: "Angular",
                description: "Angular framework template",
                category: Framework,
                requires: &[],
                conflicts: &[React, Vue, Nextjs],
            },
        ),
        (
            EmberTs,
            FeatureMeta {
                label: "Ember",
                description: "Ember framework template",
                category: Framework,
                requires: &[],
                conflicts: &[React, Vue, Nextjs],
            },
        ),
        (
            LitTs,
            FeatureMeta {
                label: "Lit",
                description: "Lit framework template",
                category: Framework,
                requires: &[],
                conflicts: &[React, Vue, Nextjs],
            },
        ),
        (
            MarkoTs,
            FeatureMeta {
                label: "Marko",
                description: "Marko framework template",
                category: Framework,
                requires: &[],
                conflicts: &[React, Vue, Nextjs],
            },
        ),
        (
            NuxtTs,
            FeatureMeta {
                label: "Nuxt",
                description: "Nuxt framework template",
                category: Framework,
                requires: &[Vue],
                conflicts: &[React, Nextjs],
            },
        ),
        (
            PreactTs,
            FeatureMeta {
                label: "Preact",
                description: "Preact framework template",
                category: Framework,
                requires: &[],
                conflicts: &[React, Vue, Nextjs],
            },
        ),
        (
            PreactTsOfficial,
            FeatureMeta {
                label: "Preact (official)",
                description: "Official Preact TypeScript template",
                category: Framework,
                requires: &[],
                conflicts: &[React, Vue, Nextjs],
            },
        ),
        (
            QwikTs,
            FeatureMeta {
                label: "Qwik",
                description: "Qwik framework template",
                category: Framework,
                requires: &[],
                conflicts: &[React, Vue, Nextjs],
            },
        ),
        (
            SolidTs,
            FeatureMeta {
                label: "Solid",
                description: "Solid framework template",
                category: Framework,
                requires: &[],
                conflicts: &[React, Vue, Nextjs],
            },
        ),
        (
            SvelteTs,
            FeatureMeta {
                label: "Svelte",
                description: "Svelte framework template",
                category: Framework,
                requires: &[],
                conflicts: &[React, Vue, Nextjs],
            },
        ),
        // Styling
        (
            Tailwind,
            FeatureMeta {
                label: "TailwindCSS",
                description: "Utility CSS framework",
                category: Styling,
                requires: &[],
                conflicts: &[],
            },
        ),
        (
            CssModules,
            FeatureMeta {
                label: "CSS Modules",
                description: "Scoped CSS modules",
                category: Styling,
                requires: &[],
                conflicts: &[],
            },
        ),
        (
            StyledComponents,
            FeatureMeta {
                label: "Styled Components",
                description: "CSS-in-JS library",
                category: Styling,
                requires: &[],
                conflicts: &[],
            },
        ),
        // Routing
        (
            ReactRouter,
            FeatureMeta {
                label: "React Router",
                description: "React router library",
                category: Routing,
                requires: &[React],
                conflicts: &[VueRouter],
            },
        ),
        (
            VueRouter,
            FeatureMeta {
                label: "Vue Router",
                description: "Vue router library",
                category: Routing,
                requires: &[Vue],
                conflicts: &[ReactRouter],
            },
        ),
        // State management
        (
            Zustand,
            FeatureMeta {
                label: "Zustand",
                description: "State management library",
                category: State,
                requires: &[React],
                conflicts: &[Redux, Jotai],
            },
        ),
        (
            Redux,
            FeatureMeta {
                label: "Redux",
                description: "State management library",
                category: State,
                requires: &[React],
                conflicts: &[Zustand, Jotai],
            },
        ),
        (
            Jotai,
            FeatureMeta {
                label: "Jotai",
                description: "State management library",
                category: State,
                requires: &[React],
                conflicts: &[Zustand, Redux],
            },
        ),
        // Linting
        (
            Eslint,
            FeatureMeta {
                label: "ESLint",
                description: "Linting tool for JS/TS",
                category: Linting,
                requires: &[],
                conflicts: &[Biome],
            },
        ),
        (
            Biome,
            FeatureMeta {
                label: "Biome",
                description: "Alternative linting tool",
                category: Linting,
                requires: &[],
                conflicts: &[Eslint],
            },
        ),
    ])
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct FeatureResponse {
    pub name: Feature, // enum (kebab-case благодаря serde)
    pub label: &'static str,
    pub description: &'static str,
    pub category: crate::schema::Category,
    pub requires: Vec<Feature>,
    pub conflicts: Vec<Feature>,
}

pub fn feature_registry_for_api() -> Vec<FeatureResponse> {
    feature_registry()
        .into_iter()
        .map(|(feature, meta)| FeatureResponse {
            name: feature,
            label: meta.label,
            description: meta.description,
            category: meta.category,
            requires: meta.requires.to_vec(),
            conflicts: meta.conflicts.to_vec(),
        })
        .collect()
}

#[derive(Debug, Clone, Serialize, TS, Eq, PartialEq, Hash, ToSchema)]
pub struct FeatureMeta {
    pub label: &'static str,
    pub description: &'static str,
    pub category: Category,
    pub requires: &'static [Feature],
    pub conflicts: &'static [Feature],
}

pub fn build_types() {
    let out_path = Path::new("../../types.ts");

    ProjectConfig::export_to(out_path).unwrap();
    Framework::export_to(out_path).unwrap();
}

#[cfg(test)]
mod validation_tests {
    use super::*;

    fn valid_config() -> ProjectConfig {
        ProjectConfig {
            project_name: "demo".to_owned(),
            framework: Framework::React,
            styling: Styling::Tailwind,
            linting: Linting::Eslint,
            state_management: StateManagement::None,
            routing: Routing::ReactRouter,
            dependencies: Vec::new(),
            dev_dependencies: Vec::new(),
        }
    }

    #[test]
    fn rejects_long_project_name() {
        let mut config = valid_config();
        config.project_name = "a".repeat(MAX_PROJECT_NAME_LENGTH + 1);
        assert_eq!(
            config.validate().expect_err("validation").code,
            "project_name_too_long"
        );
    }

    #[test]
    fn rejects_large_dependency_lists() {
        let mut config = valid_config();
        config.dependencies = vec!["zod".to_owned(); MAX_DEPENDENCIES_PER_LIST + 1];
        assert_eq!(
            config.validate().expect_err("validation").code,
            "too_many_dependencies"
        );
    }

    #[test]
    fn rejects_dependency_tokens_with_whitespace() {
        let mut config = valid_config();
        config.dependencies = vec!["not a package".to_owned()];
        assert_eq!(
            config.validate().expect_err("validation").code,
            "dependency_invalid"
        );
    }
}
