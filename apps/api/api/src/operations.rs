use crate::{
    resolver::ResolvedPlan,
    schema::{Feature, ProjectConfig},
};
use color_eyre::Result;
use serde::Deserialize;
use serde_json::{Map, Value, json};
use std::{collections::HashMap, fs, path::Path};

#[derive(Debug, Clone)]
pub enum Operation {
    PatchPackageJson,
    ApplyPatchBundles,
    ApplyFeatureTextPatches,
    ApplyFeatureTemplateCopies,
}

pub fn operations_for_plan(_plan: &ResolvedPlan) -> Vec<Operation> {
    vec![
        Operation::PatchPackageJson,
        Operation::ApplyPatchBundles,
        Operation::ApplyFeatureTextPatches,
        Operation::ApplyFeatureTemplateCopies,
    ]
}

pub fn execute(
    operation: &Operation,
    workspace: &Path,
    config: &ProjectConfig,
    plan: &ResolvedPlan,
) -> Result<()> {
    match operation {
        Operation::PatchPackageJson => patch_package_json(workspace, config, plan)?,
        Operation::ApplyPatchBundles => apply_patch_bundles(workspace, config, plan)?,
        Operation::ApplyFeatureTextPatches => apply_feature_text_patches(workspace, config, plan)?,
        Operation::ApplyFeatureTemplateCopies => {
            apply_feature_template_copies(workspace, config, plan)?
        }
    }

    Ok(())
}

fn patch_package_json(workspace: &Path, config: &ProjectConfig, plan: &ResolvedPlan) -> Result<()> {
    let package_json_path = workspace.join("package.json");
    if !package_json_path.exists() {
        return Ok(());
    }

    let raw = fs::read_to_string(&package_json_path)?;
    let mut root: Value = serde_json::from_str(&raw)?;

    if !root.is_object() {
        root = json!({});
    }

    {
        let obj = root.as_object_mut().expect("package root must be an object");
        obj.insert(
            "name".to_owned(),
            Value::String(normalize_package_name(&config.project_name)),
        );
    }
    merge_dependencies(
        &mut root,
        "dependencies",
        collect_dependencies(config, plan),
    );

    if let Some(obj) = root.as_object_mut() {
        let taken = std::mem::take(obj);
        *obj = reorder_package_json_top_keys(taken);
    }

    fs::write(
        package_json_path,
        format!("{}\n", serde_json::to_string_pretty(&root)?),
    )?;
    Ok(())
}

/// Keep standard npm package header first: name, private, version, type, scripts — then all other keys
/// in their original order (requires `preserve_order` on serde_json).
fn reorder_package_json_top_keys(mut map: Map<String, Value>) -> Map<String, Value> {
    const HEADER: &[&str] = &["name", "private", "version", "type", "scripts"];
    let mut out = Map::new();
    for key in HEADER {
        if let Some(v) = map.remove(*key) {
            out.insert((*key).to_owned(), v);
        }
    }
    for (k, v) in map {
        out.insert(k, v);
    }
    out
}

fn collect_dependencies(config: &ProjectConfig, plan: &ResolvedPlan) -> HashMap<String, String> {
    let mut deps: HashMap<String, String> = HashMap::new();

    for item in &config.dependencies {
        let (name, version) = parse_dependency(item);
        deps.insert(name, version);
    }

    for feature in &plan.selected {
        for &(name, version) in dependencies_for_feature(feature) {
            deps.entry(name.to_owned())
                .or_insert_with(|| version.to_owned());
        }
    }

    deps
}

fn dependencies_for_feature(feature: &Feature) -> &'static [(&'static str, &'static str)] {
    match feature {
        Feature::Tailwind => &[
            ("tailwindcss", "^3.4.0"),
            ("postcss", "^8.4.0"),
            ("autoprefixer", "^10.4.0"),
        ],
        Feature::ReactRouter => &[("react-router-dom", "^6.30.0")],
        Feature::VueRouter => &[("vue-router", "^4.5.0")],
        Feature::Zustand => &[("zustand", "^5.0.0")],
        Feature::Redux => &[("@reduxjs/toolkit", "^2.6.0"), ("react-redux", "^9.2.0")],
        Feature::Jotai => &[("jotai", "^2.12.0")],
        Feature::Biome => &[("@biomejs/biome", "^1.9.0")],
        _ => &[],
    }
}

fn parse_dependency(raw: &str) -> (String, String) {
    if let Some(idx) = raw.rfind('@') {
        if idx > 0 && idx + 1 < raw.len() {
            let name = &raw[..idx];
            let version = &raw[idx + 1..];
            return (name.to_owned(), version.to_owned());
        }
    }
    (raw.to_owned(), "latest".to_owned())
}

fn merge_dependencies(root: &mut Value, key: &str, deps: HashMap<String, String>) {
    if deps.is_empty() {
        return;
    }

    let root_obj = root
        .as_object_mut()
        .expect("package root must be an object");
    let entry = root_obj
        .entry(key.to_owned())
        .or_insert_with(|| Value::Object(Map::new()));
    if !entry.is_object() {
        *entry = Value::Object(Map::new());
    }
    let deps_obj = entry.as_object_mut().expect("deps entry must be an object");

    for (name, version) in deps {
        deps_obj.insert(name, Value::String(version));
    }
}

fn normalize_package_name(name: &str) -> String {
    let lowered = name.trim().to_lowercase();
    let mapped: String = lowered
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
                ch
            } else {
                '-'
            }
        })
        .collect();
    let compact = mapped
        .split('-')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("-");

    if compact.is_empty() {
        "project".to_owned()
    } else {
        compact
    }
}

fn apply_feature_text_patches(
    workspace: &Path,
    config: &ProjectConfig,
    plan: &ResolvedPlan,
) -> Result<()> {
    for patch in feature_text_patches(plan) {
        let file_path = workspace.join(patch.relative_path);
        if !file_path.exists() {
            continue;
        }

        let content = fs::read_to_string(&file_path)?;
        let replaced = content.replace("{{project_name}}", &config.project_name);
        fs::write(file_path, replaced)?;
    }
    Ok(())
}

fn apply_feature_template_copies(
    workspace: &Path,
    config: &ProjectConfig,
    plan: &ResolvedPlan,
) -> Result<()> {
    for copy in feature_template_copies(plan) {
        let source = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../templates")
            .join("patches")
            .join(copy.source_relative_path);
        if !source.exists() {
            continue;
        }

        let target = workspace.join(copy.target_relative_path);
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)?;
        }

        let content = fs::read_to_string(source)?;
        let content = content.replace("{{project_name}}", &config.project_name);
        fs::write(target, content)?;
    }
    Ok(())
}

struct TextPatchSpec {
    relative_path: &'static str,
}

struct CopyTemplateSpec {
    source_relative_path: &'static str,
    target_relative_path: &'static str,
}

fn feature_text_patches(plan: &ResolvedPlan) -> Vec<TextPatchSpec> {
    let mut patches = Vec::new();
    if plan.selected.contains(&Feature::Tailwind) {
        patches.push(TextPatchSpec {
            relative_path: "README.md",
        });
    }
    patches
}

fn feature_template_copies(plan: &ResolvedPlan) -> Vec<CopyTemplateSpec> {
    let mut copies = Vec::new();
    if plan.selected.contains(&Feature::Tailwind) {
        copies.push(CopyTemplateSpec {
            source_relative_path: "tailwind/.env.example.tpl",
            target_relative_path: ".env.example",
        });
    }
    copies
}

#[derive(Debug, Deserialize)]
struct PatchBundleFile {
    edits: Vec<PatchEditSpec>,
}

#[derive(Debug, Deserialize)]
struct PatchEditSpec {
    /// Supported: replace | append | insertAfter | insertBefore
    mode: String,
    /// Path relative to project root, e.g. "README.md" or "src/index.css"
    target: String,
    /// Path relative to bundle dir, e.g. "snippets/globals.css.snippet"
    template: String,
    /// Anchor substring in target content for insertBefore/insertAfter
    anchor: Option<String>,
    /// If true and target does not exist -> skip this edit
    #[serde(default)]
    skip_if_missing_target: bool,
    /// Apply only when ALL listed features are selected.
    #[serde(default)]
    only_if_features: Vec<Feature>,
    /// Skip when ANY listed feature is selected.
    #[serde(default)]
    unless_features: Vec<Feature>,
    /// Apply only for matching framework values.
    #[serde(default)]
    only_if_frameworks: Vec<crate::schema::Framework>,
    /// Apply only for matching routing values.
    #[serde(default)]
    only_if_routing: Vec<crate::schema::Routing>,
    /// Apply only for matching styling values.
    #[serde(default)]
    only_if_styling: Vec<crate::schema::Styling>,
}

fn apply_patch_bundles(workspace: &Path, config: &ProjectConfig, plan: &ResolvedPlan) -> Result<()> {
    let bundle_root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../templates/patches/bundles");
    let candidates = patch_bundle_candidates_in_apply_order(config, plan);

    let mut applied_any = false;
    for key in candidates {
        let edits_path = bundle_root.join(&key).join("edits.json");
        if !edits_path.exists() {
            continue;
        }

        let raw = fs::read_to_string(&edits_path)?;
        let bundle: PatchBundleFile = serde_json::from_str(&raw)?;

        for edit in bundle.edits {
            if edit_applies(&edit, config, plan) {
                apply_patch_edit(workspace, &bundle_root.join(&key), &edit, config)?;
            }
        }
        applied_any = true;
    }

    let _ = applied_any;
    Ok(())
}

fn patch_bundle_candidates(config: &ProjectConfig, plan: &ResolvedPlan) -> Vec<String> {
    let framework_key = framework_template_key(&config.framework);
    let routing_key = routing_template_key(&config.routing);
    let styling_key = if plan.selected.contains(&Feature::Tailwind) {
        "tailwind"
    } else {
        "no-styling"
    };

    vec![
        format!("{framework_key}-{routing_key}-{styling_key}"),
        format!("{framework_key}-{routing_key}"),
        format!("{framework_key}-{styling_key}"),
        format!("{framework_key}"),
        "default".to_owned(),
    ]
}

fn patch_bundle_candidates_in_apply_order(config: &ProjectConfig, plan: &ResolvedPlan) -> Vec<String> {
    // We want layered behavior: default first, then more specific bundles.
    // `patch_bundle_candidates` returns most-specific -> default; reverse it.
    let mut keys = patch_bundle_candidates(config, plan);
    keys.reverse();
    keys
}

fn framework_template_key(framework: &crate::schema::Framework) -> &'static str {
    // Map high-level frameworks used in ProjectConfig into existing template naming.
    match framework {
        crate::schema::Framework::React => "react-ts",
        crate::schema::Framework::Vue => "vue-ts",
        crate::schema::Framework::Nextjs => "nextjs",
        other => other.as_str(),
    }
}

fn routing_template_key(routing: &crate::schema::Routing) -> &'static str {
    match routing {
        crate::schema::Routing::ReactRouter => "react-router",
        crate::schema::Routing::ReactRouterData => "react-router-data",
        crate::schema::Routing::VueRouter => "vue-router",
        crate::schema::Routing::AppRouter => "app-router",
        crate::schema::Routing::PagesRouter => "pages-router",
        crate::schema::Routing::None => "none",
    }
}

fn render_template_with_vars(template: &str, config: &ProjectConfig) -> String {
    template.replace("{{project_name}}", &config.project_name)
}

fn edit_applies(edit: &PatchEditSpec, config: &ProjectConfig, plan: &ResolvedPlan) -> bool {
    if !edit.only_if_frameworks.is_empty() && !edit.only_if_frameworks.contains(&config.framework) {
        return false;
    }
    if !edit.only_if_routing.is_empty() && !edit.only_if_routing.contains(&config.routing) {
        return false;
    }
    if !edit.only_if_styling.is_empty() && !edit.only_if_styling.contains(&config.styling) {
        return false;
    }

    if !edit.only_if_features.is_empty()
        && !edit
            .only_if_features
            .iter()
            .all(|feature| plan.selected.contains(feature))
    {
        return false;
    }

    if !edit.unless_features.is_empty()
        && edit
            .unless_features
            .iter()
            .any(|feature| plan.selected.contains(feature))
    {
        return false;
    }

    true
}

fn apply_patch_edit(
    workspace: &Path,
    bundle_dir: &Path,
    edit: &PatchEditSpec,
    config: &ProjectConfig,
) -> Result<()> {
    let target_path = workspace.join(&edit.target);
    let template_path = bundle_dir.join(&edit.template);

    if !template_path.exists() {
        // Template missing in bundle - treat as bundle author error, but don't crash the whole generator.
        return Ok(());
    }

    if !target_path.exists() && matches!(edit.mode.as_str(), "append" | "insertAfter" | "insertBefore" | "replace") {
        if edit.skip_if_missing_target {
            return Ok(());
        }
    }

    let template_raw = fs::read_to_string(&template_path)?;
    let rendered = render_template_with_vars(&template_raw, config);

    match edit.mode.as_str() {
        "replace" => {
            if let Some(parent) = target_path.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::write(&target_path, rendered)?;
        }
        "append" => {
            if let Some(parent) = target_path.parent() {
                fs::create_dir_all(parent)?;
            }
            let existing = if target_path.exists() {
                fs::read_to_string(&target_path)?
            } else {
                String::new()
            };
            let mut out = existing;
            if !out.is_empty() && !out.ends_with('\n') {
                out.push('\n');
            }
            out.push_str(&rendered);
            if !out.ends_with('\n') {
                out.push('\n');
            }
            fs::write(&target_path, out)?;
        }
        "insertAfter" => {
            let anchor = edit.anchor.as_deref().ok_or_else(|| {
                color_eyre::eyre::eyre!("insertAfter requires `anchor` for target={}", edit.target)
            })?;
            let existing = fs::read_to_string(&target_path)?;
            let pos = existing.find(anchor).ok_or_else(|| {
                color_eyre::eyre::eyre!(
                    "anchor not found: target={} anchor={}",
                    edit.target,
                    anchor
                )
            })?;
            let insert_at = pos + anchor.len();
            let out = format!("{}{}{}", &existing[..insert_at], rendered, &existing[insert_at..]);
            fs::write(&target_path, out)?;
        }
        "insertBefore" => {
            let anchor = edit.anchor.as_deref().ok_or_else(|| {
                color_eyre::eyre::eyre!("insertBefore requires `anchor` for target={}", edit.target)
            })?;
            let existing = fs::read_to_string(&target_path)?;
            let pos = existing.find(anchor).ok_or_else(|| {
                color_eyre::eyre::eyre!(
                    "anchor not found: target={} anchor={}",
                    edit.target,
                    anchor
                )
            })?;
            let out = format!("{}{}{}", &existing[..pos], rendered, &existing[pos..]);
            fs::write(&target_path, out)?;
        }
        other => {
            color_eyre::eyre::bail!("Unknown patch mode: {other}");
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn normalizes_package_name() {
        assert_eq!(normalize_package_name("My Cool App"), "my-cool-app");
        assert_eq!(normalize_package_name("___"), "___");
        assert_eq!(normalize_package_name(""), "project");
    }

    #[test]
    fn parses_dependency_with_version() {
        let (name, version) = parse_dependency("axios@1.9.0");
        assert_eq!(name, "axios");
        assert_eq!(version, "1.9.0");
    }

    #[test]
    fn parses_scoped_dependency_with_version() {
        let (name, version) = parse_dependency("@scope/pkg@2.0.0");
        assert_eq!(name, "@scope/pkg");
        assert_eq!(version, "2.0.0");
    }

    #[test]
    fn package_json_header_keys_stay_first_after_reorder() {
        let mut map = Map::new();
        map.insert("devDependencies".to_owned(), json!({}));
        map.insert("dependencies".to_owned(), json!({}));
        map.insert("scripts".to_owned(), json!({ "dev": "vite" }));
        map.insert("version".to_owned(), json!("0.0.0"));
        map.insert("private".to_owned(), json!(true));
        map.insert("type".to_owned(), json!("module"));
        map.insert("name".to_owned(), json!("my-app"));

        let ordered = reorder_package_json_top_keys(map);
        let keys: Vec<_> = ordered.keys().map(String::as_str).collect();
        assert_eq!(
            keys[..5],
            ["name", "private", "version", "type", "scripts"]
        );
        assert!(keys.contains(&"dependencies"));
        assert!(keys.contains(&"devDependencies"));
        assert!(keys.iter().position(|&k| k == "dependencies").unwrap() > 4);
    }

    #[test]
    fn reorder_candidates_prefers_most_specific() {
        use crate::schema::{Framework, Linting, PackageManager, Routing, StateManagement, Styling};
        let config = ProjectConfig {
            project_name: "x".to_owned(),
            framework: Framework::React,
            package_manager: PackageManager::Npm,
            styling: Styling::Tailwind,
            linting: Linting::Eslint,
            state_management: StateManagement::None,
            routing: Routing::ReactRouter,
            dependencies: vec![],
        };
        let plan = ResolvedPlan {
            selected: vec![Feature::React, Feature::Tailwind],
            ordered: vec![],
        };

        let cands = patch_bundle_candidates(&config, &plan);
        assert_eq!(cands[0], "react-ts-react-router-tailwind");
        assert_eq!(cands.last().unwrap(), "default");
    }

    #[test]
    fn bundle_apply_order_is_layered_default_first() {
        use crate::schema::{Framework, Linting, PackageManager, Routing, StateManagement, Styling};
        let config = ProjectConfig {
            project_name: "x".to_owned(),
            framework: Framework::React,
            package_manager: PackageManager::Npm,
            styling: Styling::Tailwind,
            linting: Linting::Eslint,
            state_management: StateManagement::None,
            routing: Routing::ReactRouter,
            dependencies: vec![],
        };
        let plan = ResolvedPlan {
            selected: vec![Feature::React, Feature::Tailwind],
            ordered: vec![],
        };
        let cands = patch_bundle_candidates_in_apply_order(&config, &plan);
        assert_eq!(cands[0], "default");
        assert_eq!(cands.last().unwrap(), "react-ts-react-router-tailwind");
    }
}
