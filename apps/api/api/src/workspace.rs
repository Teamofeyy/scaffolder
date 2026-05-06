use color_eyre::Result;
use tempfile::TempDir;

pub fn create() -> Result<TempDir> {
    Ok(tempfile::tempdir()?)
}
