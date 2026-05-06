use crate::{archive, operations, resolver, schema::ProjectConfig, template_engine, workspace};
use color_eyre::Result;
use std::path::PathBuf;

pub struct GeneratedArchive {
    pub file_name: String,
    pub bytes: Vec<u8>,
}

pub async fn generate_project(config: ProjectConfig) -> Result<GeneratedArchive> {
    let plan = resolver::resolve_from_config(&config)?;
    let workspace = workspace::create()?;
    let workspace_path = workspace.path();

    template_engine::materialize(&config, workspace_path)?;
    let materialized_root = template_engine::detect_materialized_root(workspace_path)?;
    let project_dir_name = sanitize_project_dir_name(&config.project_name);
    let project_root =
        rename_project_root(materialized_root, workspace_path.join(&project_dir_name))?;

    for operation in operations::operations_for_plan(&plan) {
        operations::execute(&operation, &project_root, &config, &plan)?;
    }

    let archive = archive::zip(workspace_path)?;

    Ok(GeneratedArchive {
        file_name: format!("{project_dir_name}.zip"),
        bytes: archive,
    })
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
