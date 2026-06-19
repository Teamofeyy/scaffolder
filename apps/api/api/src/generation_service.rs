use crate::{
    archive, operations, resolver,
    schema::{ProjectConfig, ProjectTreeNode},
    template_engine, workspace,
};
use color_eyre::Result;
use std::path::{Path, PathBuf};
use tempfile::TempDir;

pub struct GeneratedArchive {
    pub file_name: String,
    pub bytes: Vec<u8>,
}

pub async fn generate_project(config: ProjectConfig) -> Result<GeneratedArchive> {
    let project_dir_name = sanitize_project_dir_name(&config.project_name);
    let (workspace, _project_root) = materialize_project(&config)?;

    let archive = archive::zip(workspace.path())?;

    Ok(GeneratedArchive {
        file_name: format!("{project_dir_name}.zip"),
        bytes: archive,
    })
}

pub fn preview_project_tree(config: ProjectConfig) -> Result<ProjectTreeNode> {
    let (_workspace, project_root) = materialize_project(&config)?;
    project_tree_from_path(&project_root)
}

fn materialize_project(config: &ProjectConfig) -> Result<(TempDir, PathBuf)> {
    let plan = resolver::resolve_from_config(config)?;
    let workspace = workspace::create()?;
    let workspace_path = workspace.path();

    template_engine::materialize(config, workspace_path)?;
    let materialized_root = template_engine::detect_materialized_root(workspace_path)?;
    let project_dir_name = sanitize_project_dir_name(&config.project_name);
    let project_root =
        rename_project_root(materialized_root, workspace_path.join(&project_dir_name))?;

    for operation in operations::operations_for_plan(&plan) {
        operations::execute(&operation, &project_root, config, &plan)?;
    }

    Ok((workspace, project_root))
}

fn rename_project_root(from: PathBuf, to: PathBuf) -> Result<PathBuf> {
    if from == to {
        return Ok(from);
    }
    std::fs::rename(&from, &to)?;
    Ok(to)
}

fn sanitize_project_dir_name(name: &str) -> String {
    let candidate: String = name
        .chars()
        .map(|ch| match ch {
            '/' | '\\' => '-',
            _ => ch,
        })
        .collect();

    let trimmed = candidate.trim();
    if trimmed.is_empty() {
        "project".to_owned()
    } else {
        trimmed.to_owned()
    }
}

fn project_tree_from_path(path: &Path) -> Result<ProjectTreeNode> {
    let name = path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| "project".to_owned());

    if path.is_file() {
        return Ok(ProjectTreeNode {
            name,
            node_type: "file".to_owned(),
            children: vec![],
        });
    }

    let mut entries = std::fs::read_dir(path)?
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .collect::<Vec<_>>();

    entries.sort_by(|left, right| {
        let left_is_dir = left.is_dir();
        let right_is_dir = right.is_dir();
        right_is_dir
            .cmp(&left_is_dir)
            .then_with(|| left.file_name().cmp(&right.file_name()))
    });

    let children = entries
        .iter()
        .map(|entry| project_tree_from_path(entry))
        .collect::<Result<Vec<_>>>()?;

    Ok(ProjectTreeNode {
        name,
        node_type: "folder".to_owned(),
        children,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::schema::{Framework, Linting, PackageManager, Routing, StateManagement, Styling};

    fn config(
        framework: Framework,
        routing: Routing,
        styling: Styling,
        linting: Linting,
    ) -> ProjectConfig {
        ProjectConfig {
            project_name: "generated-app".to_owned(),
            framework,
            package_manager: PackageManager::Npm,
            styling,
            linting,
            state_management: StateManagement::None,
            routing,
            dependencies: vec![],
            dev_dependencies: vec![],
        }
    }

    #[test]
    fn generates_tailwind_for_svelte() {
        let (_workspace, root) = materialize_project(&config(
            Framework::SvelteTs,
            Routing::None,
            Styling::Tailwind,
            Linting::None,
        ))
        .expect("generate Svelte project");

        let vite = std::fs::read_to_string(root.join("vite.config.ts")).expect("read Vite config");
        let css = std::fs::read_to_string(root.join("src/app.css")).expect("read app CSS");
        assert!(vite.contains("@tailwindcss/vite"));
        assert!(css.contains("@import \"tailwindcss\""));
    }

    #[test]
    fn generates_tailwind_for_angular() {
        let (_workspace, root) = materialize_project(&config(
            Framework::AngularTs,
            Routing::None,
            Styling::Tailwind,
            Linting::None,
        ))
        .expect("generate Angular project");

        assert!(root.join(".postcssrc.json").exists());
        let css = std::fs::read_to_string(root.join("src/styles.css")).expect("read styles");
        assert!(css.contains("@import \"tailwindcss\""));
    }

    #[test]
    fn generates_nuxt_file_system_routes_with_css_modules() {
        let (_workspace, root) = materialize_project(&config(
            Framework::NuxtTs,
            Routing::VueRouter,
            Styling::CssModules,
            Linting::None,
        ))
        .expect("generate Nuxt project");

        let app = std::fs::read_to_string(root.join("app/app.vue")).expect("read app");
        let home =
            std::fs::read_to_string(root.join("app/pages/index.vue")).expect("read home page");
        assert!(app.contains("<NuxtPage />"));
        assert!(home.contains("<style module>"));
        assert!(root.join("app/pages/about.vue").exists());
    }

    #[test]
    fn generates_react_router_with_styled_components() {
        let (_workspace, root) = materialize_project(&config(
            Framework::React,
            Routing::ReactRouter,
            Styling::StyledComponents,
            Linting::Eslint,
        ))
        .expect("generate React project");

        let package_json =
            std::fs::read_to_string(root.join("package.json")).expect("read package");
        let home = std::fs::read_to_string(root.join("src/pages/Home.tsx")).expect("read home");
        assert!(package_json.contains("\"styled-components\""));
        assert!(home.contains("styled from 'styled-components'"));
    }

    #[test]
    fn biome_replaces_eslint_configuration() {
        let (_workspace, root) = materialize_project(&config(
            Framework::Nextjs,
            Routing::AppRouter,
            Styling::CssModules,
            Linting::Biome,
        ))
        .expect("generate Next.js project");

        let package_json =
            std::fs::read_to_string(root.join("package.json")).expect("read package");
        assert!(package_json.contains("\"lint\": \"biome check .\""));
        assert!(package_json.contains("\"@biomejs/biome\""));
        assert!(!package_json.contains("\"eslint\""));
        assert!(!root.join("eslint.config.mjs").exists());
        assert!(root.join("biome.json").exists());
    }

    #[test]
    fn no_linter_removes_inherited_eslint_configuration() {
        let (_workspace, root) = materialize_project(&config(
            Framework::Nextjs,
            Routing::AppRouter,
            Styling::CssModules,
            Linting::None,
        ))
        .expect("generate Next.js project");

        let package_json =
            std::fs::read_to_string(root.join("package.json")).expect("read package");
        assert!(!package_json.contains("\"lint\""));
        assert!(!package_json.contains("\"eslint\""));
        assert!(!root.join("eslint.config.mjs").exists());
        assert!(!root.join("biome.json").exists());
    }

    #[test]
    fn visible_configuration_matrix_materializes() {
        let profiles = [
            (
                Framework::React,
                vec![
                    Routing::ReactRouter,
                    Routing::ReactRouterData,
                    Routing::None,
                ],
                vec![
                    Styling::Tailwind,
                    Styling::CssModules,
                    Styling::StyledComponents,
                ],
                vec![Linting::Eslint, Linting::Biome, Linting::None],
                vec![
                    StateManagement::None,
                    StateManagement::Zustand,
                    StateManagement::Redux,
                    StateManagement::Jotai,
                ],
            ),
            (
                Framework::Nextjs,
                vec![Routing::AppRouter],
                vec![Styling::Tailwind, Styling::CssModules],
                vec![Linting::Eslint, Linting::Biome, Linting::None],
                vec![
                    StateManagement::None,
                    StateManagement::Zustand,
                    StateManagement::Redux,
                    StateManagement::Jotai,
                ],
            ),
            (
                Framework::Nextjs,
                vec![Routing::PagesRouter],
                vec![
                    Styling::Tailwind,
                    Styling::CssModules,
                    Styling::StyledComponents,
                ],
                vec![Linting::Eslint, Linting::Biome, Linting::None],
                vec![
                    StateManagement::None,
                    StateManagement::Zustand,
                    StateManagement::Redux,
                    StateManagement::Jotai,
                ],
            ),
            (
                Framework::Vue,
                vec![Routing::VueRouter, Routing::None],
                vec![Styling::Tailwind, Styling::CssModules],
                vec![Linting::None],
                vec![StateManagement::None],
            ),
            (
                Framework::SvelteTs,
                vec![Routing::None],
                vec![Styling::Tailwind],
                vec![Linting::None],
                vec![StateManagement::None],
            ),
            (
                Framework::SolidTs,
                vec![Routing::None],
                vec![Styling::Tailwind, Styling::CssModules],
                vec![Linting::None],
                vec![StateManagement::None],
            ),
            (
                Framework::PreactTs,
                vec![Routing::None],
                vec![Styling::Tailwind, Styling::CssModules],
                vec![Linting::None],
                vec![StateManagement::None],
            ),
            (
                Framework::NuxtTs,
                vec![Routing::VueRouter],
                vec![Styling::Tailwind, Styling::CssModules],
                vec![Linting::None],
                vec![StateManagement::None],
            ),
            (
                Framework::AngularTs,
                vec![Routing::None],
                vec![Styling::Tailwind],
                vec![Linting::None],
                vec![StateManagement::None],
            ),
        ];

        for (framework, routings, stylings, lintings, state_options) in profiles {
            for routing in &routings {
                for styling in &stylings {
                    for linting in &lintings {
                        for state_management in &state_options {
                            let config = ProjectConfig {
                                project_name: "matrix-app".to_owned(),
                                framework: framework.clone(),
                                package_manager: PackageManager::Npm,
                                styling: styling.clone(),
                                linting: linting.clone(),
                                state_management: state_management.clone(),
                                routing: routing.clone(),
                                dependencies: vec![],
                                dev_dependencies: vec![],
                            };
                            materialize_project(&config).unwrap_or_else(|error| {
                                panic!(
                                    "failed to materialize {framework:?} {routing:?} {styling:?} \
                                     {linting:?} {state_management:?}: {error}"
                                )
                            });
                        }
                    }
                }
            }
        }
    }
}
