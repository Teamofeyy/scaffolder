use color_eyre::Result;
use fs_extra::dir::CopyOptions;
use std::path::{Path, PathBuf};

use crate::schema::ProjectConfig;

const REQUIRED_TEMPLATE_DIRS: &[&str] = &["react-ts", "vue-ts", "nextjs", "patches"];

pub fn template_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../templates")
}

pub fn validate_template_inventory() -> Result<()> {
    let root = template_root();
    if !root.is_dir() {
        return Err(color_eyre::eyre::eyre!(
            "template submodule is missing or not a directory: {}",
            root.display()
        ));
    }

    for dir in REQUIRED_TEMPLATE_DIRS {
        let path = root.join(dir);
        if !path.is_dir() {
            return Err(color_eyre::eyre::eyre!(
                "required template directory is missing: {}",
                path.display()
            ));
        }
    }

    Ok(())
}

pub fn materialize(config: &ProjectConfig, workspace: &Path) -> Result<()> {
    validate_template_inventory()?;
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
    template_root().join(config.framework.as_str())
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
