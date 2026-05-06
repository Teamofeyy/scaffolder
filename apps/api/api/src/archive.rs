use color_eyre::Result;
use std::fs::File;
use std::io::{Cursor, Read, Write};
use std::path::Path;

use walkdir::WalkDir;
use zip::ZipWriter;
use zip::write::SimpleFileOptions;

pub fn zip(dir: &Path) -> Result<Vec<u8>> {
    let mut buffer = Cursor::new(Vec::new());
    let mut writer = ZipWriter::new(&mut buffer);

    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    let dir = dir.canonicalize()?;

    for entry in WalkDir::new(&dir) {
        let entry = entry?;
        let path = entry.path();

        let name = path.strip_prefix(&dir)?;

        if path.is_file() {
            writer.start_file(name.to_string_lossy(), options)?;

            let mut f = File::open(path)?;
            let mut contents = Vec::new();
            f.read_to_end(&mut contents)?;

            writer.write_all(&contents)?;
        } else if !name.as_os_str().is_empty() {
            writer.add_directory(name.to_string_lossy(), options)?;
        }
    }

    writer.finish()?;

    Ok(buffer.into_inner())
}
