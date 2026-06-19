use color_eyre::Result;
use fs_extra::dir::CopyOptions;
use std::path::{Path, PathBuf};

use crate::schema::ProjectConfig;

pub fn materialize(config: &ProjectConfig, workspace: &Path) -> Result<()> {
    let template_path = resolve_template(config);

    if !template_path.exists() {
        return Err(color_eyre::eyre::eyre!(
            "template path does not exist: {}",
            template_path.display()
        ));
    }

    fs_extra::dir::copy(template_path, workspace, &CopyOptions::new())?;

    Ok(())
}

pub fn resolve_template(config: &ProjectConfig) -> PathBuf {
    let base = std::env::var_os("SCAFFOLDER_TEMPLATES_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| Path::new(env!("CARGO_MANIFEST_DIR")).join("../templates"));
    base.join(config.framework.as_str())
}

pub fn detect_materialized_root(workspace: &Path) -> Result<PathBuf> {
    let mut dirs = std::fs::read_dir(workspace)?
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|path| path.is_dir())
        .collect::<Vec<_>>();

    dirs.sort();
    dirs.into_iter().next().ok_or_else(|| {
        color_eyre::eyre::eyre!(
            "no materialized template directory found in {}",
            workspace.display()
        )
    })
}
