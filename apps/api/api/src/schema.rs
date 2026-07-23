use serde::{Deserialize, Serialize};
use std::{collections::HashMap, path::Path};
use ts_rs::TS;
use utoipa::ToSchema;

const MAX_PROJECT_NAME_CHARS: usize = 80;
const MAX_DEPENDENCIES_PER_BUCKET: usize = 32;
const MAX_DEPENDENCY_CHARS: usize = 120;

#[derive(TS, Serialize, Deserialize, ToSchema, Debug, Clone, PartialEq, Eq, Hash)]
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

#[derive(TS, Serialize, Deserialize, ToSchema, Debug, Clone, PartialEq, Eq, Hash)]
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

#[derive(TS, Serialize, Deserialize, ToSchema, Debug, Clone, PartialEq, Eq, Hash)]
#[ts(export)]
#[serde(rename_all = "kebab-case")]
pub enum Styling {
    Tailwind,
    CssModules,
    StyledComponents,
}

#[derive(TS, Serialize, Deserialize, ToSchema, Debug, Clone, PartialEq, Eq, Hash)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum Linting {
    Eslint,
    Biome,
    None,
}

#[derive(TS, Serialize, Deserialize, ToSchema, Debug, Clone, PartialEq, Eq, Hash)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum StateManagement {
    None,
    Zustand,
    Redux,
    Jotai,
}

#[derive(TS, Serialize, Deserialize, ToSchema, Debug, Clone, Default, PartialEq, Eq, Hash)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum Testing {
    #[default]
    None,
    Vitest,
    Playwright,
}

#[derive(TS, Serialize, Deserialize, ToSchema, Debug, Clone)]
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
    #[serde(default)]
    pub testing: Testing,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProjectConfigValidationError {
    InvalidProjectName,
    UnsupportedFramework(Framework),
    TooManyDependencies(&'static str),
    InvalidDependency { bucket: &'static str, value: String },
}

impl std::fmt::Display for ProjectConfigValidationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidProjectName => write!(f, "Invalid project name"),
            Self::UnsupportedFramework(framework) => {
                write!(f, "Unsupported framework: {}", framework.as_str())
            }
            Self::TooManyDependencies(bucket) => write!(f, "Too many {bucket} dependencies"),
            Self::InvalidDependency { bucket, value } => {
                write!(f, "Invalid {bucket} dependency: {value}")
            }
        }
    }
}

impl std::error::Error for ProjectConfigValidationError {}

impl ProjectConfig {
    pub fn validate_for_generation(&self) -> Result<(), ProjectConfigValidationError> {
        validate_project_name(&self.project_name)?;

        if self.framework == Framework::PreactTsOfficial {
            return Err(ProjectConfigValidationError::UnsupportedFramework(
                self.framework.clone(),
            ));
        }

        validate_dependency_bucket("dependencies", &self.dependencies)?;
        validate_dependency_bucket("devDependencies", &self.dev_dependencies)?;

        Ok(())
    }
}

fn validate_project_name(name: &str) -> Result<(), ProjectConfigValidationError> {
    let trimmed = name.trim();
    if trimmed.is_empty() || trimmed.chars().count() > MAX_PROJECT_NAME_CHARS {
        return Err(ProjectConfigValidationError::InvalidProjectName);
    }

    if trimmed
        .chars()
        .all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '-' || ch == '_')
    {
        Ok(())
    } else {
        Err(ProjectConfigValidationError::InvalidProjectName)
    }
}

fn validate_dependency_bucket(
    bucket: &'static str,
    dependencies: &[String],
) -> Result<(), ProjectConfigValidationError> {
    if dependencies.len() > MAX_DEPENDENCIES_PER_BUCKET {
        return Err(ProjectConfigValidationError::TooManyDependencies(bucket));
    }

    for dependency in dependencies {
        if !is_safe_dependency_spec(dependency) {
            return Err(ProjectConfigValidationError::InvalidDependency {
                bucket,
                value: dependency.clone(),
            });
        }
    }

    Ok(())
}

fn is_safe_dependency_spec(value: &str) -> bool {
    let trimmed = value.trim();
    !trimmed.is_empty()
        && trimmed.len() <= MAX_DEPENDENCY_CHARS
        && trimmed == value
        && trimmed.chars().all(|ch| {
            ch.is_ascii_alphanumeric() || matches!(ch, '@' | '/' | '-' | '_' | '.' | '^' | '~')
        })
        && !trimmed.contains("//")
        && !trimmed.contains("..")
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ProjectTreeNode {
    pub name: String,
    #[serde(rename = "type")]
    pub node_type: String,
    #[schema(no_recursion)]
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub children: Vec<ProjectTreeNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct DependencySearchResult {
    pub name: String,
    pub version: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, Eq, PartialEq, Hash, ToSchema)]
#[ts(export)]
#[serde(rename_all = "kebab-case")]
pub enum SupportStatus {
    Supported,
    Experimental,
    Unavailable,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PresetProjectConfig {
    pub framework: Framework,
    pub styling: Styling,
    pub linting: Linting,
    pub state_management: StateManagement,
    pub routing: Routing,
    pub dependencies: Vec<String>,
    #[serde(default)]
    pub dev_dependencies: Vec<String>,
    #[serde(default)]
    pub testing: Testing,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ProjectPreset {
    pub id: &'static str,
    pub label: &'static str,
    pub description: &'static str,
    pub status: SupportStatus,
    pub config: PresetProjectConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct VerificationMatrix {
    pub version: String,
    pub verified_at: String,
    pub combinations: Vec<VerifiedCombination>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct VerifiedCombination {
    pub framework: Framework,
    pub routing: Routing,
    pub styling: Styling,
    #[serde(default)]
    pub state_management: Option<StateManagement>,
    #[serde(default)]
    pub testing: Option<Testing>,
    pub generate: bool,
    pub install: bool,
    pub build: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PreviewFile {
    pub path: String,
    pub language: String,
    pub content: String,
    pub truncated: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PreviewVerification {
    pub matrix: String,
    pub generate: bool,
    pub install: bool,
    pub build: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PreviewDetailsResponse {
    pub tree: ProjectTreeNode,
    pub files: Vec<PreviewFile>,
    pub dependencies: Vec<String>,
    pub dev_dependencies: Vec<String>,
    pub commands: Vec<String>,
    pub support_status: SupportStatus,
    pub verification: PreviewVerification,
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
    pub support_status: SupportStatus,
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
            support_status: support_status_for_feature(&feature),
            name: feature,
            label: meta.label,
            description: meta.description,
            category: meta.category,
            requires: meta.requires.to_vec(),
            conflicts: meta.conflicts.to_vec(),
        })
        .collect()
}

pub fn project_presets() -> Vec<ProjectPreset> {
    vec![
        ProjectPreset {
            id: "react-spa",
            label: "React SPA",
            description: "React single-page app with CSS Modules.",
            status: SupportStatus::Supported,
            config: preset_config(
                Framework::React,
                Routing::None,
                Styling::CssModules,
                Linting::Eslint,
            ),
        },
        ProjectPreset {
            id: "react-router-tailwind",
            label: "React Router App",
            description: "React SPA with React Router and Tailwind CSS.",
            status: SupportStatus::Supported,
            config: preset_config(
                Framework::React,
                Routing::ReactRouter,
                Styling::Tailwind,
                Linting::Eslint,
            ),
        },
        ProjectPreset {
            id: "react-router-data-tailwind",
            label: "React Router Data App",
            description: "React Router Data APIs with Tailwind CSS.",
            status: SupportStatus::Supported,
            config: preset_config(
                Framework::React,
                Routing::ReactRouterData,
                Styling::Tailwind,
                Linting::Eslint,
            ),
        },
        ProjectPreset {
            id: "vue-app",
            label: "Vue App",
            description: "Vue single-page app with Tailwind CSS.",
            status: SupportStatus::Supported,
            config: preset_config(
                Framework::Vue,
                Routing::None,
                Styling::Tailwind,
                Linting::Eslint,
            ),
        },
        ProjectPreset {
            id: "vue-router-tailwind",
            label: "Vue Router App",
            description: "Vue app with Vue Router and Tailwind CSS.",
            status: SupportStatus::Supported,
            config: preset_config(
                Framework::Vue,
                Routing::VueRouter,
                Styling::Tailwind,
                Linting::Eslint,
            ),
        },
        ProjectPreset {
            id: "next-app-router",
            label: "Next.js App Router",
            description: "Next.js project using the App Router and Tailwind CSS.",
            status: SupportStatus::Supported,
            config: preset_config(
                Framework::Nextjs,
                Routing::AppRouter,
                Styling::Tailwind,
                Linting::Eslint,
            ),
        },
        ProjectPreset {
            id: "next-pages-router",
            label: "Next.js Pages Router",
            description: "Next.js project using the Pages Router and Tailwind CSS.",
            status: SupportStatus::Supported,
            config: preset_config(
                Framework::Nextjs,
                Routing::PagesRouter,
                Styling::Tailwind,
                Linting::Eslint,
            ),
        },
        ProjectPreset {
            id: "minimal",
            label: "Minimal",
            description: "Small React app with CSS Modules and no linting preset.",
            status: SupportStatus::Supported,
            config: PresetProjectConfig {
                framework: Framework::React,
                routing: Routing::None,
                styling: Styling::CssModules,
                linting: Linting::None,
                state_management: StateManagement::None,
                dependencies: vec![],
                dev_dependencies: vec![],
                testing: Testing::None,
            },
        },
    ]
}

fn preset_config(
    framework: Framework,
    routing: Routing,
    styling: Styling,
    linting: Linting,
) -> PresetProjectConfig {
    PresetProjectConfig {
        framework,
        routing,
        styling,
        linting,
        state_management: StateManagement::None,
        dependencies: vec![],
        dev_dependencies: vec![],
        testing: Testing::None,
    }
}

pub fn verification_matrix() -> VerificationMatrix {
    serde_json::from_str(include_str!("../verification-matrix.json"))
        .expect("verification-matrix.json must be valid")
}

pub fn verified_combination_for_config(config: &ProjectConfig) -> Option<VerifiedCombination> {
    verification_matrix()
        .combinations
        .into_iter()
        .find(|combination| {
            combination.framework == config.framework
                && combination.routing == config.routing
                && combination.styling == config.styling
                && combination
                    .state_management
                    .as_ref()
                    .unwrap_or(&StateManagement::None)
                    == &config.state_management
                && combination.testing.as_ref().unwrap_or(&Testing::None) == &config.testing
        })
}

pub fn support_status_for_config(config: &ProjectConfig) -> SupportStatus {
    if let Some(combination) = verified_combination_for_config(config)
        && combination.generate
        && combination.install
        && combination.build
    {
        return SupportStatus::Supported;
    }

    match config.framework {
        Framework::React
        | Framework::Vue
        | Framework::Nextjs
        | Framework::ReactTs
        | Framework::VueTs
        | Framework::AngularTs
        | Framework::EmberTs
        | Framework::LitTs
        | Framework::MarkoTs
        | Framework::NuxtTs
        | Framework::PreactTs
        | Framework::QwikTs
        | Framework::SolidTs
        | Framework::SvelteTs => SupportStatus::Experimental,
        Framework::PreactTsOfficial => SupportStatus::Unavailable,
    }
}

fn support_status_for_feature(feature: &Feature) -> SupportStatus {
    match feature {
        Feature::React | Feature::Vue | Feature::Nextjs => SupportStatus::Supported,
        Feature::AngularTs
        | Feature::EmberTs
        | Feature::LitTs
        | Feature::MarkoTs
        | Feature::NuxtTs
        | Feature::PreactTs
        | Feature::QwikTs
        | Feature::ReactTs
        | Feature::SolidTs
        | Feature::SvelteTs
        | Feature::VueTs
        | Feature::Tailwind
        | Feature::CssModules
        | Feature::StyledComponents
        | Feature::ReactRouter
        | Feature::VueRouter
        | Feature::Zustand
        | Feature::Redux
        | Feature::Jotai
        | Feature::Eslint
        | Feature::Biome => SupportStatus::Experimental,
        Feature::PreactTsOfficial => SupportStatus::Unavailable,
    }
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
mod support_status_tests {
    use super::*;

    fn stable_react_config() -> ProjectConfig {
        ProjectConfig {
            project_name: "demo".to_owned(),
            framework: Framework::React,
            styling: Styling::Tailwind,
            linting: Linting::Eslint,
            state_management: StateManagement::None,
            routing: Routing::ReactRouter,
            dependencies: vec![],
            dev_dependencies: vec![],
            testing: Testing::None,
        }
    }

    #[test]
    fn validates_project_name_before_generation() {
        let mut config = stable_react_config();
        config.project_name = "evil\\name".to_owned();

        assert_eq!(
            config.validate_for_generation(),
            Err(ProjectConfigValidationError::InvalidProjectName)
        );
    }

    #[test]
    fn rejects_unavailable_framework_before_generation() {
        let mut config = stable_react_config();
        config.framework = Framework::PreactTsOfficial;

        assert_eq!(
            config.validate_for_generation(),
            Err(ProjectConfigValidationError::UnsupportedFramework(
                Framework::PreactTsOfficial
            ))
        );
    }

    #[test]
    fn validates_dependency_specs_before_generation() {
        let mut config = stable_react_config();
        config.dependencies = vec!["@scope/pkg@^1.2.3".to_owned()];
        assert!(config.validate_for_generation().is_ok());

        config.dependencies = vec!["bad package".to_owned()];
        assert!(matches!(
            config.validate_for_generation(),
            Err(ProjectConfigValidationError::InvalidDependency { .. })
        ));
    }

    #[test]
    fn stable_matrix_match_is_supported() {
        assert_eq!(
            support_status_for_config(&stable_react_config()),
            SupportStatus::Supported
        );
    }

    #[test]
    fn state_or_testing_outside_matrix_is_experimental() {
        let mut with_state = stable_react_config();
        with_state.state_management = StateManagement::Zustand;
        assert_eq!(
            support_status_for_config(&with_state),
            SupportStatus::Experimental
        );

        let mut with_testing = stable_react_config();
        with_testing.testing = Testing::Vitest;
        assert_eq!(
            support_status_for_config(&with_testing),
            SupportStatus::Experimental
        );
    }
}
