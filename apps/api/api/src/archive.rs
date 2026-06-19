use color_eyre::Result;
use std::fs::File;
use std::io::{Seek, Write};
use std::path::Path;

use walkdir::WalkDir;
use zip::ZipWriter;
use zip::write::SimpleFileOptions;

const MAX_UNCOMPRESSED_ARCHIVE_BYTES: u64 = 32 * 1024 * 1024;

pub fn zip<W>(dir: &Path, output: W) -> Result<()>
where
    W: Write + Seek,
{
    let mut writer = ZipWriter::new(output);

    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    let dir = dir.canonicalize()?;
    let mut total_bytes = 0_u64;

    for entry in WalkDir::new(&dir) {
        let entry = entry?;
        let path = entry.path();

        let name = path.strip_prefix(&dir)?;

        if entry.file_type().is_symlink() {
            color_eyre::eyre::bail!("symlinks are not allowed in generated archives");
        }

        if entry.file_type().is_file() {
            total_bytes = total_bytes.saturating_add(entry.metadata()?.len());
            if total_bytes > MAX_UNCOMPRESSED_ARCHIVE_BYTES {
                color_eyre::eyre::bail!("generated project exceeds the archive size limit");
            }

            writer.start_file(name.to_string_lossy(), options)?;

            let mut f = File::open(path)?;
            std::io::copy(&mut f, &mut writer)?;
        } else if !name.as_os_str().is_empty() {
            writer.add_directory(name.to_string_lossy(), options)?;
        }
    }

    writer.finish()?;
    Ok(())
}
