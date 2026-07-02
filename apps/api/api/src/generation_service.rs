use crate::{
    archive, operations, resolver,
    schema::{
        PreviewDetailsResponse, PreviewFile, PreviewVerification, ProjectConfig, ProjectTreeNode,
        Testing, support_status_for_config, verification_matrix, verified_combination_for_config,
    },
    template_engine, workspace,
};
use color_eyre::Result;
use serde_json::Value;
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

pub fn preview_project_details(config: ProjectConfig) -> Result<PreviewDetailsResponse> {
    let (_workspace, project_root) = materialize_project(&config)?;
    let tree = project_tree_from_path(&project_root)?;
    let package_json = read_package_json(&project_root)?;
    let files = preview_files(&project_root, &config)?;
    let dependencies = package_dependencies(&package_json, "dependencies");
    let dev_dependencies = package_dependencies(&package_json, "devDependencies");
    let commands = commands_from_package_json(&package_json, &config);
    let matrix = verification_matrix();
    let verified = verified_combination_for_config(&config);
    let verification = PreviewVerification {
        matrix: matrix.version,
        generate: verified.as_ref().is_some_and(|item| item.generate),
        install: verified.as_ref().is_some_and(|item| item.install),
        build: verified.as_ref().is_some_and(|item| item.build),
    };

    Ok(PreviewDetailsResponse {
        tree,
        files,
        dependencies,
        dev_dependencies,
        commands,
        support_status: support_status_for_config(&config),
        verification,
    })
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

fn read_package_json(project_root: &Path) -> Result<Value> {
    let package_path = project_root.join("package.json");
    if !package_path.exists() {
        return Ok(Value::Object(Default::default()));
    }

    let raw = std::fs::read_to_string(package_path)?;
    serde_json::from_str(&raw).map_err(Into::into)
}

fn package_dependencies(package_json: &Value, key: &str) -> Vec<String> {
    let mut dependencies = package_json
        .get(key)
        .and_then(Value::as_object)
        .map(|deps| deps.keys().cloned().collect::<Vec<_>>())
        .unwrap_or_default();
    dependencies.sort();
    dependencies
}

fn commands_from_package_json(package_json: &Value, config: &ProjectConfig) -> Vec<String> {
    let scripts = package_json.get("scripts").and_then(Value::as_object);
    let mut commands = vec!["npm install".to_owned()];

    if scripts.is_some_and(|scripts| scripts.contains_key("dev")) {
        commands.push("npm run dev".to_owned());
    }
    if config.testing != Testing::None
        && scripts.is_some_and(|scripts| scripts.contains_key("test"))
    {
        commands.push("npm test".to_owned());
    }
    if scripts.is_some_and(|scripts| scripts.contains_key("build")) {
        commands.push("npm run build".to_owned());
    }

    commands
}

fn preview_files(project_root: &Path, config: &ProjectConfig) -> Result<Vec<PreviewFile>> {
    const MAX_PREVIEW_BYTES: usize = 24_000;
    let mut paths = vec!["package.json", "README.md"];
    paths.extend(entry_file_candidates(config));

    let root = project_root.canonicalize()?;
    let mut files = Vec::new();
    for relative_path in paths {
        let path = project_root.join(relative_path);
        if !path.exists() || !path.is_file() {
            continue;
        }

        let canonical = path.canonicalize()?;
        if !canonical.starts_with(&root) {
            continue;
        }

        let bytes = std::fs::read(&canonical)?;
        let truncated = bytes.len() > MAX_PREVIEW_BYTES;
        let limited = if truncated {
            &bytes[..MAX_PREVIEW_BYTES]
        } else {
            &bytes
        };
        let mut content = String::from_utf8_lossy(limited).into_owned();
        if truncated {
            content.push_str("\n\n[preview truncated]");
        }

        files.push(PreviewFile {
            path: relative_path.to_owned(),
            language: language_for_path(relative_path).to_owned(),
            content,
            truncated,
        });
    }

    Ok(files)
}

fn entry_file_candidates(config: &ProjectConfig) -> Vec<&'static str> {
    match config.framework {
        crate::schema::Framework::Nextjs => match config.routing {
            crate::schema::Routing::PagesRouter => vec!["pages/index.tsx", "pages/_app.tsx"],
            _ => vec!["app/page.tsx", "app/layout.tsx"],
        },
        crate::schema::Framework::Vue | crate::schema::Framework::VueTs => {
            vec!["src/main.ts", "src/App.vue"]
        }
        crate::schema::Framework::SvelteTs => vec!["src/main.ts", "src/App.svelte"],
        crate::schema::Framework::SolidTs => vec!["src/index.tsx", "src/App.tsx"],
        crate::schema::Framework::PreactTs | crate::schema::Framework::PreactTsOfficial => {
            vec!["src/main.tsx", "src/app.tsx"]
        }
        _ => vec!["src/main.tsx", "src/App.tsx"],
    }
}

fn language_for_path(path: &str) -> &'static str {
    if path.ends_with(".json") {
        "json"
    } else if path.ends_with(".md") {
        "markdown"
    } else if path.ends_with(".tsx") {
        "tsx"
    } else if path.ends_with(".ts") {
        "typescript"
    } else if path.ends_with(".vue") {
        "vue"
    } else if path.ends_with(".svelte") {
        "svelte"
    } else {
        "text"
    }
}
