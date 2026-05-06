use serde::{Deserialize, Serialize};
use std::{collections::HashMap, path::Path};
use ts_rs::TS;
use utoipa::ToSchema;

#[derive(TS, Serialize, Deserialize, ToSchema, Debug, PartialEq)]
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

#[derive(TS, Serialize, Deserialize, ToSchema, Debug, PartialEq)]
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

#[derive(TS, Serialize, Deserialize, ToSchema, Debug, PartialEq)]
#[ts(export)]
#[serde(rename_all = "kebab-case")]
pub enum Styling {
    Tailwind,
    CssModules,
    StyledComponents,
}

#[derive(TS, Serialize, Deserialize, ToSchema)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum Linting {
    Eslint,
    Biome,
    None,
}

#[derive(TS, Serialize, Deserialize, ToSchema)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum StateManagement {
    None,
    Zustand,
    Redux,
    Jotai,
}

#[derive(TS, Serialize, Deserialize, ToSchema)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum PackageManager {
    Npm,
    Pnpm,
    Yarn,
    Bun,
}

#[derive(TS, Serialize, Deserialize, ToSchema)]
#[ts(export)]
pub struct ProjectConfig {
    pub project_name: String,
    pub framework: Framework,
    pub package_manager: PackageManager,
    pub styling: Styling,
    pub linting: Linting,
    pub state_management: StateManagement,
    pub routing: Routing,
    pub dependencies: Vec<String>,
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

    Npm,
    Pnpm,
    Yarn,
    Bun,
    Deno,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, Eq, PartialEq, Hash, ToSchema)]
#[serde(rename_all = "kebab-case")]
pub enum Category {
    Framework,
    Routing,
    Styling,
    State,
    Linting,
    PackageManager,
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
        // Package managers
        (
            Npm,
            FeatureMeta {
                label: "npm",
                description: "Node package manager",
                category: PackageManager,
                requires: &[],
                conflicts: &[Pnpm, Yarn, Bun],
            },
        ),
        (
            Pnpm,
            FeatureMeta {
                label: "pnpm",
                description: "Fast Node package manager",
                category: PackageManager,
                requires: &[],
                conflicts: &[Npm, Yarn, Bun],
            },
        ),
        (
            Yarn,
            FeatureMeta {
                label: "Yarn",
                description: "Alternative Node package manager",
                category: PackageManager,
                requires: &[],
                conflicts: &[Npm, Pnpm, Bun],
            },
        ),
        (
            Bun,
            FeatureMeta {
                label: "Bun",
                description: "JavaScript runtime with package manager",
                category: PackageManager,
                requires: &[],
                conflicts: &[Npm, Pnpm, Yarn],
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

    ProjectConfig::export_to(&out_path).unwrap();
    Framework::export_to(&out_path).unwrap();
}
