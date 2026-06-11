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
