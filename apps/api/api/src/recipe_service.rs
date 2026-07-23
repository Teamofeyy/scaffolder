use crate::{
    archive,
    generation_service::GeneratedArchive,
    schema::{PreviewFile, ProjectTreeNode},
    template_engine, workspace,
};
use axum::{Json, response::IntoResponse};
use color_eyre::{Result, eyre::Context};
use fs_extra::dir::CopyOptions;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value, json};
use std::{
    collections::{BTreeMap, BTreeSet, HashMap},
    fmt,
    path::{Path, PathBuf},
};
use tempfile::TempDir;
use ts_rs::TS;
use utoipa::ToSchema;

const BASE_TEMPLATE_MANIFESTS: &[&str] = &[include_str!(
    "../../../../recipes/base-templates/vite-react-ts.json"
)];
const BLOCK_MANIFESTS: &[&str] = &[
    include_str!("../../../../recipes/blocks/tailwind-vite.json"),
    include_str!("../../../../recipes/blocks/react-router.json"),
    include_str!("../../../../recipes/blocks/shadcn.json"),
    include_str!("../../../../recipes/blocks/vitest.json"),
    include_str!("../../../../recipes/blocks/zustand.json"),
];
const RECIPE_MANIFESTS: &[&str] = &[
    include_str!("../../../../recipes/catalog/react-vite-app.json"),
    include_str!("../../../../recipes/catalog/react-router-app.json"),
];

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BaseTemplateManifest {
    id: String,
    snapshot_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, ToSchema)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct RecipeBlockManifest {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: String,
    pub status: String,
    pub files_touched: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BlockManifest {
    id: String,
    #[serde(default)]
    requires: BlockRequires,
    #[serde(default)]
    conflicts: BlockConflicts,
    #[serde(default)]
    provides: Capabilities,
    operations: Vec<BlockOperation>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BlockRequires {
    #[serde(default)]
    base_templates: Vec<String>,
    #[serde(default)]
    blocks: Vec<String>,
    #[serde(default)]
    capabilities: Vec<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BlockConflicts {
    #[serde(default)]
    blocks: Vec<String>,
    #[serde(default)]
    capabilities: Vec<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
struct Capabilities {
    #[serde(default)]
    capabilities: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BlockOperation {
    #[serde(rename = "type")]
    operation_type: String,
    target: String,
    #[allow(dead_code)]
    description: String,
    template: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, ToSchema)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct RecipeManifest {
    pub id: String,
    pub name: String,
    pub description: String,
    pub tier: String,
    pub status: String,
    pub base_template: String,
    pub blocks: Vec<String>,
    pub options: BTreeMap<String, RecipeOption>,
    pub custom_dependencies: CustomDependenciesPolicy,
    pub verification: RecipeVerification,
    pub preview: RecipePreviewPolicy,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, ToSchema)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct RecipeOption {
    pub label: String,
    pub description: String,
    pub default: String,
    pub values: Vec<RecipeOptionValue>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, ToSchema)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct RecipeOptionValue {
    pub id: String,
    pub label: String,
    pub description: String,
    pub blocks: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, ToSchema)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct CustomDependenciesPolicy {
    pub allow: bool,
    pub policy: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, ToSchema)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct RecipeVerification {
    pub generate: bool,
    pub install: bool,
    pub build: bool,
    pub test: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, ToSchema)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct RecipePreviewPolicy {
    pub curated_files: Vec<String>,
    pub show_all_files: bool,
}

#[derive(Debug, Clone, Serialize, TS, ToSchema)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct RecipeCatalogItem {
    pub id: String,
    pub name: String,
    pub description: String,
    pub tier: String,
    pub status: String,
    pub base_template: String,
    pub options: BTreeMap<String, RecipeOption>,
    pub verification: RecipeVerification,
}

#[derive(Debug, Clone, Deserialize, TS, ToSchema)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct RecipeProjectRequest {
    pub project_name: String,
    #[serde(default)]
    pub options: BTreeMap<String, String>,
    #[serde(default)]
    pub extras: RecipeProjectExtras,
}

#[derive(Debug, Clone, Default, Deserialize, TS, ToSchema)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct RecipeProjectExtras {
    #[serde(default)]
    pub dependencies: Vec<String>,
    #[serde(default)]
    pub dev_dependencies: Vec<String>,
}

#[derive(Debug, Clone, Serialize, TS, ToSchema)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct RecipePreviewDetailsResponse {
    pub recipe_id: String,
    pub project_name: String,
    pub tree: ProjectTreeNode,
    pub curated_tree: ProjectTreeNode,
    pub selected_files: Vec<PreviewFile>,
    /// Compatibility alias for the Phase 2 preview response.
    pub files: Vec<PreviewFile>,
    pub dependencies: Vec<String>,
    pub dev_dependencies: Vec<String>,
    pub commands: Vec<String>,
    pub selected_blocks: Vec<String>,
    pub custom_dependencies: Vec<String>,
    pub custom_dev_dependencies: Vec<String>,
    pub recipe_tier: String,
    pub recipe_status: String,
    pub support_status: String,
    pub base_template: String,
    pub template_snapshot: String,
    pub verification: RecipeVerification,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, TS, ToSchema)]
#[ts(export)]
#[serde(rename_all = "kebab-case")]
pub enum RecipeErrorCode {
    InvalidRecipeId,
    InvalidOption,
    IncompatibleBlockSelection,
    InvalidCustomDependency,
    TemplateMissing,
    GenerationFailed,
}

impl fmt::Display for RecipeErrorCode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let value = match self {
            Self::InvalidRecipeId => "invalid-recipe-id",
            Self::InvalidOption => "invalid-option",
            Self::IncompatibleBlockSelection => "incompatible-block-selection",
            Self::InvalidCustomDependency => "invalid-custom-dependency",
            Self::TemplateMissing => "template-missing",
            Self::GenerationFailed => "generation-failed",
        };
        f.write_str(value)
    }
}

#[derive(Debug, Clone, Serialize, TS, ToSchema)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct RecipeApiError {
    pub code: RecipeErrorCode,
    pub message: String,
    #[serde(skip_serializing_if = "BTreeMap::is_empty")]
    pub details: BTreeMap<String, String>,
}

struct RecipeRegistry {
    base_templates: HashMap<String, BaseTemplateManifest>,
    blocks: HashMap<String, BlockManifest>,
    recipes: HashMap<String, RecipeManifest>,
}

struct ResolvedRecipe {
    recipe: RecipeManifest,
    base_template: BaseTemplateManifest,
    blocks: Vec<BlockManifest>,
    selected_block_ids: Vec<String>,
}

pub fn recipe_catalog() -> Result<Vec<RecipeCatalogItem>> {
    let mut items = registry()?
        .recipes
        .into_values()
        .map(|recipe| RecipeCatalogItem {
            id: recipe.id,
            name: recipe.name,
            description: recipe.description,
            tier: recipe.tier,
            status: recipe.status,
            base_template: recipe.base_template,
            options: recipe.options,
            verification: recipe.verification,
        })
        .collect::<Vec<_>>();
    items.sort_by(|left, right| left.id.cmp(&right.id));
    Ok(items)
}

pub fn recipe_details(recipe_id: &str) -> Result<RecipeManifest> {
    registry()?
        .recipes
        .remove(recipe_id)
        .ok_or_else(|| color_eyre::eyre::eyre!("unknown recipe: {recipe_id}"))
}

pub async fn generate_recipe_project(
    recipe_id: &str,
    request: RecipeProjectRequest,
) -> Result<GeneratedArchive> {
    let project_dir_name = sanitize_project_dir_name(&request.project_name);
    let (workspace, _project_root, _resolved) = materialize_recipe_project(recipe_id, &request)?;
    let archive = archive::zip(workspace.path())?;

    Ok(GeneratedArchive {
        file_name: format!("{project_dir_name}.zip"),
        bytes: archive,
    })
}

pub fn preview_recipe_project(
    recipe_id: &str,
    request: RecipeProjectRequest,
) -> Result<RecipePreviewDetailsResponse> {
    let (_workspace, project_root, resolved) = materialize_recipe_project(recipe_id, &request)?;
    let tree = project_tree_from_path(&project_root)?;
    let package_json = read_package_json(&project_root)?;
    let selected_files = preview_files(&project_root, &resolved.recipe.preview.curated_files)?;
    let curated_tree = curated_tree_from_files(&project_root, &selected_files);
    let dependencies = package_dependencies(&package_json, "dependencies");
    let dev_dependencies = package_dependencies(&package_json, "devDependencies");
    let commands = commands_from_package_json(&package_json);
    let support_status = support_status_for_recipe(&resolved.recipe);
    let warnings = warnings_for_preview(&request, &resolved);

    Ok(RecipePreviewDetailsResponse {
        recipe_id: resolved.recipe.id,
        project_name: request.project_name,
        tree,
        curated_tree,
        files: selected_files.clone(),
        selected_files,
        dependencies,
        dev_dependencies,
        commands,
        selected_blocks: resolved.selected_block_ids,
        custom_dependencies: request.extras.dependencies,
        custom_dev_dependencies: request.extras.dev_dependencies,
        recipe_tier: resolved.recipe.tier,
        recipe_status: resolved.recipe.status,
        support_status,
        base_template: resolved.recipe.base_template,
        template_snapshot: resolved.base_template.snapshot_path,
        verification: resolved.recipe.verification,
        warnings,
    })
}

fn registry() -> Result<RecipeRegistry> {
    let base_templates = parse_manifests::<BaseTemplateManifest>(BASE_TEMPLATE_MANIFESTS)?
        .into_iter()
        .map(|manifest| (manifest.id.clone(), manifest))
        .collect();
    let blocks = parse_manifests::<BlockManifest>(BLOCK_MANIFESTS)?
        .into_iter()
        .map(|manifest| (manifest.id.clone(), manifest))
        .collect();
    let recipes = parse_manifests::<RecipeManifest>(RECIPE_MANIFESTS)?
        .into_iter()
        .map(|manifest| (manifest.id.clone(), manifest))
        .collect();

    Ok(RecipeRegistry {
        base_templates,
        blocks,
        recipes,
    })
}

fn parse_manifests<T>(raw_manifests: &[&str]) -> Result<Vec<T>>
where
    T: for<'de> Deserialize<'de>,
{
    raw_manifests
        .iter()
        .map(|raw| serde_json::from_str(raw).map_err(Into::into))
        .collect()
}

fn materialize_recipe_project(
    recipe_id: &str,
    request: &RecipeProjectRequest,
) -> Result<(TempDir, PathBuf, ResolvedRecipe)> {
    let resolved = resolve_recipe(recipe_id, request)?;
    validate_project_name(&request.project_name)?;

    let workspace = workspace::create()?;
    let workspace_path = workspace.path();
    materialize_base_template(&resolved.base_template, workspace_path)?;
    let materialized_root = template_engine::detect_materialized_root(workspace_path)?;
    let project_dir_name = sanitize_project_dir_name(&request.project_name);
    let project_root =
        rename_project_root(materialized_root, workspace_path.join(project_dir_name))?;

    apply_recipe_operations(&project_root, request, &resolved)?;
    render_recipe_readme(&project_root, request, &resolved)?;

    Ok((workspace, project_root, resolved))
}

fn resolve_recipe(recipe_id: &str, request: &RecipeProjectRequest) -> Result<ResolvedRecipe> {
    let mut registry = registry()?;
    let recipe = registry
        .recipes
        .remove(recipe_id)
        .ok_or_else(|| color_eyre::eyre::eyre!("unknown recipe: {recipe_id}"))?;
    let base_template = registry
        .base_templates
        .remove(&recipe.base_template)
        .ok_or_else(|| {
            color_eyre::eyre::eyre!("unknown base template: {}", recipe.base_template)
        })?;

    for option_id in request.options.keys() {
        if !recipe.options.contains_key(option_id) {
            color_eyre::eyre::bail!("unknown option for recipe {recipe_id}: {option_id}");
        }
    }

    let mut selected_block_ids = BTreeSet::new();
    for block in &recipe.blocks {
        selected_block_ids.insert(block.clone());
    }

    for (option_id, option) in &recipe.options {
        let selected_value = request
            .options
            .get(option_id)
            .map(String::as_str)
            .unwrap_or(&option.default);
        let value = option
            .values
            .iter()
            .find(|value| value.id == selected_value)
            .ok_or_else(|| {
                color_eyre::eyre::eyre!("invalid value for option {option_id}: {selected_value}")
            })?;
        for block in &value.blocks {
            selected_block_ids.insert(block.clone());
        }
    }

    let mut blocks = Vec::new();
    for block_id in &selected_block_ids {
        let block = registry
            .blocks
            .get(block_id)
            .ok_or_else(|| color_eyre::eyre::eyre!("unknown block: {block_id}"))?
            .clone();
        blocks.push(block);
    }
    validate_block_compatibility(&recipe, &base_template, &blocks)?;

    Ok(ResolvedRecipe {
        recipe,
        base_template,
        selected_block_ids: selected_block_ids.into_iter().collect(),
        blocks,
    })
}

fn validate_block_compatibility(
    recipe: &RecipeManifest,
    base_template: &BaseTemplateManifest,
    blocks: &[BlockManifest],
) -> Result<()> {
    let block_ids = blocks
        .iter()
        .map(|block| block.id.as_str())
        .collect::<BTreeSet<_>>();
    let mut capabilities = BTreeSet::new();
    capabilities.insert("framework:react".to_owned());
    capabilities.insert("language:typescript".to_owned());
    capabilities.insert("bundler:vite".to_owned());
    for block in blocks {
        for capability in &block.provides.capabilities {
            capabilities.insert(capability.clone());
        }
    }

    for block in blocks {
        if !block.requires.base_templates.is_empty()
            && !block.requires.base_templates.contains(&base_template.id)
        {
            color_eyre::eyre::bail!(
                "block {} does not support base template {}",
                block.id,
                base_template.id
            );
        }

        for required_block in &block.requires.blocks {
            if !block_ids.contains(required_block.as_str()) {
                color_eyre::eyre::bail!(
                    "block {} requires missing block {}",
                    block.id,
                    required_block
                );
            }
        }

        for required_capability in &block.requires.capabilities {
            if !capabilities.contains(required_capability) {
                color_eyre::eyre::bail!(
                    "block {} requires missing capability {}",
                    block.id,
                    required_capability
                );
            }
        }

        for conflicting_block in &block.conflicts.blocks {
            if block_ids.contains(conflicting_block.as_str()) {
                color_eyre::eyre::bail!(
                    "block {} conflicts with block {}",
                    block.id,
                    conflicting_block
                );
            }
        }

        for conflicting_capability in &block.conflicts.capabilities {
            if capabilities.contains(conflicting_capability) {
                color_eyre::eyre::bail!(
                    "block {} conflicts with capability {}",
                    block.id,
                    conflicting_capability
                );
            }
        }
    }

    if recipe.tier == "recommended" && recipe.status != "active" {
        color_eyre::eyre::bail!("recommended recipe {} must be active", recipe.id);
    }

    Ok(())
}

fn materialize_base_template(base_template: &BaseTemplateManifest, workspace: &Path) -> Result<()> {
    template_engine::validate_template_inventory()?;
    let template_dir = Path::new(&base_template.snapshot_path)
        .file_name()
        .ok_or_else(|| {
            color_eyre::eyre::eyre!(
                "base template snapshot path has no directory name: {}",
                base_template.snapshot_path
            )
        })?
        .to_string_lossy()
        .into_owned();
    let template_path = template_engine::template_root().join(template_dir);
    if !template_path.is_dir() {
        color_eyre::eyre::bail!(
            "base template path does not exist: {}",
            template_path.display()
        );
    }

    fs_extra::dir::copy(template_path, workspace, &CopyOptions::new())?;
    Ok(())
}

fn apply_recipe_operations(
    project_root: &Path,
    request: &RecipeProjectRequest,
    resolved: &ResolvedRecipe,
) -> Result<()> {
    let selected_block_ids = resolved
        .blocks
        .iter()
        .map(|block| block.id.as_str())
        .collect::<BTreeSet<_>>();

    for block in &resolved.blocks {
        for operation in &block.operations {
            match operation.operation_type.as_str() {
                "package-json-merge" => merge_package_json_for_block(project_root, request, block)?,
                "tsconfig-merge" => merge_tsconfig_for_block(project_root, block)?,
                "components-json-merge" => merge_components_json_for_block(project_root, block)?,
                "css-append" => append_css_for_block(project_root, request, operation)?,
                "file-template" => render_file_template(project_root, request, operation)?,
                "file-copy" | "text-patch" => {
                    color_eyre::eyre::bail!(
                        "operation type {} is not implemented for recipe engine MVP",
                        operation.operation_type
                    );
                }
                other => color_eyre::eyre::bail!("unknown operation type: {other}"),
            }
        }
    }

    merge_custom_dependencies(project_root, &request.extras)?;
    write_vite_config(project_root, &selected_block_ids)?;
    Ok(())
}

fn merge_package_json_for_block(
    project_root: &Path,
    request: &RecipeProjectRequest,
    block: &BlockManifest,
) -> Result<()> {
    let path = project_root.join("package.json");
    let mut root = read_json_object(&path)?;
    root.insert(
        "name".to_owned(),
        Value::String(normalize_package_name(&request.project_name)),
    );

    match block.id.as_str() {
        "tailwind-vite" => {
            merge_object(
                &mut root,
                "devDependencies",
                json!({
                    "tailwindcss": "^4.3.1",
                    "@tailwindcss/vite": "^4.3.1"
                }),
            );
        }
        "react-router" => {
            merge_object(
                &mut root,
                "dependencies",
                json!({
                    "react-router": "^7.18.0"
                }),
            );
        }
        "shadcn" => {
            merge_object(
                &mut root,
                "dependencies",
                json!({
                    "class-variance-authority": "^0.7.1",
                    "clsx": "^2.1.1",
                    "lucide-react": "^0.545.0",
                    "tailwind-merge": "^3.4.0"
                }),
            );
        }
        "vitest" => {
            merge_object(
                &mut root,
                "devDependencies",
                json!({
                    "jsdom": "^29.1.1",
                    "vitest": "^4.1.9"
                }),
            );
            merge_object(
                &mut root,
                "scripts",
                json!({
                    "test": "vitest run"
                }),
            );
        }
        "zustand" => {
            merge_object(
                &mut root,
                "dependencies",
                json!({
                    "zustand": "^5.0.14"
                }),
            );
        }
        _ => {}
    }

    write_json_object(&path, reorder_package_json_top_keys(root))?;
    Ok(())
}

fn merge_custom_dependencies(project_root: &Path, extras: &RecipeProjectExtras) -> Result<()> {
    if extras.dependencies.is_empty() && extras.dev_dependencies.is_empty() {
        return Ok(());
    }

    let path = project_root.join("package.json");
    let mut root = read_json_object(&path)?;
    merge_dependency_list(&mut root, "dependencies", &extras.dependencies)?;
    merge_dependency_list(&mut root, "devDependencies", &extras.dev_dependencies)?;
    write_json_object(&path, reorder_package_json_top_keys(root))?;
    Ok(())
}

fn merge_dependency_list(root: &mut Map<String, Value>, key: &str, deps: &[String]) -> Result<()> {
    let mut map = Map::new();
    for dep in deps {
        let (name, version) = parse_dependency(dep)?;
        map.insert(name, Value::String(version));
    }
    merge_object(root, key, Value::Object(map));
    Ok(())
}

fn merge_tsconfig_for_block(project_root: &Path, block: &BlockManifest) -> Result<()> {
    if block.id != "shadcn" {
        return Ok(());
    }

    let app_path = project_root.join("tsconfig.app.json");
    let mut app = read_json_object(&app_path)?;
    merge_object(
        &mut app,
        "compilerOptions",
        json!({
            "baseUrl": ".",
            "paths": {
                "@/*": ["./src/*"]
            }
        }),
    );
    write_json_object(&app_path, app)?;

    let root_path = project_root.join("tsconfig.json");
    let mut root = read_json_object(&root_path)?;
    merge_object(
        &mut root,
        "compilerOptions",
        json!({
            "baseUrl": ".",
            "paths": {
                "@/*": ["./src/*"]
            }
        }),
    );
    write_json_object(&root_path, root)?;
    Ok(())
}

fn merge_components_json_for_block(project_root: &Path, block: &BlockManifest) -> Result<()> {
    if block.id != "shadcn" {
        return Ok(());
    }

    let path = project_root.join("components.json");
    let mut root = if path.exists() {
        read_json_object(&path)?
    } else {
        Map::new()
    };
    merge_json_value(
        &mut root,
        json!({
            "$schema": "https://ui.shadcn.com/schema.json",
            "style": "new-york",
            "rsc": false,
            "tsx": true,
            "tailwind": {
                "config": "",
                "css": "src/index.css",
                "baseColor": "neutral",
                "cssVariables": true,
                "prefix": ""
            },
            "aliases": {
                "components": "@/components",
                "utils": "@/lib/utils",
                "ui": "@/components/ui",
                "lib": "@/lib",
                "hooks": "@/hooks"
            },
            "iconLibrary": "lucide"
        }),
    );
    write_json_object(&path, root)?;
    Ok(())
}

fn append_css_for_block(
    project_root: &Path,
    request: &RecipeProjectRequest,
    operation: &BlockOperation,
) -> Result<()> {
    let target = safe_target_path(project_root, &operation.target)?;
    let rendered = render_template(request, operation.template.as_deref().unwrap_or_default())?;
    let existing = if target.exists() {
        std::fs::read_to_string(&target)?
    } else {
        String::new()
    };
    let mut content = existing;
    if !content.ends_with('\n') && !content.is_empty() {
        content.push('\n');
    }
    content.push_str(&rendered);
    if !content.ends_with('\n') {
        content.push('\n');
    }
    write_text_file(&target, &content)
}

fn render_file_template(
    project_root: &Path,
    request: &RecipeProjectRequest,
    operation: &BlockOperation,
) -> Result<()> {
    let template = operation
        .template
        .as_deref()
        .ok_or_else(|| color_eyre::eyre::eyre!("file-template operation is missing template"))?;
    let target = safe_target_path(project_root, &operation.target)?;
    let rendered = render_template(request, template)?;
    write_text_file(&target, &rendered)
}

fn render_template(request: &RecipeProjectRequest, template: &str) -> Result<String> {
    let raw = match template {
        "tailwind/index.css" => include_str!("../../../../recipes/templates/tailwind/index.css"),
        "react-router/main.tsx" => {
            include_str!("../../../../recipes/templates/react-router/main.tsx")
        }
        "react-router/App.tsx" => {
            include_str!("../../../../recipes/templates/react-router/App.tsx")
        }
        "react-router/root.tsx" => {
            include_str!("../../../../recipes/templates/react-router/root.tsx")
        }
        "react-router/home.tsx" => {
            include_str!("../../../../recipes/templates/react-router/home.tsx")
        }
        "shadcn/utils.ts" => include_str!("../../../../recipes/templates/shadcn/utils.ts"),
        "vitest/App.test.tsx" => {
            include_str!("../../../../recipes/templates/vitest/App.test.tsx")
        }
        "zustand/app-store.ts" => {
            include_str!("../../../../recipes/templates/zustand/app-store.ts")
        }
        "tailwind/.env.example.tpl" => "VITE_APP_NAME={{project_name}}\n",
        other => color_eyre::eyre::bail!("unknown recipe template: {other}"),
    };

    Ok(raw.replace("{{project_name}}", &request.project_name))
}

fn write_vite_config(project_root: &Path, selected_block_ids: &BTreeSet<&str>) -> Result<()> {
    let uses_tailwind = selected_block_ids.contains("tailwind-vite");
    let uses_shadcn = selected_block_ids.contains("shadcn");
    let uses_vitest = selected_block_ids.contains("vitest");

    let define_config_import = if uses_vitest {
        "import { defineConfig } from 'vitest/config'"
    } else {
        "import { defineConfig } from 'vite'"
    };
    let mut imports = vec![
        define_config_import.to_owned(),
        "import react from '@vitejs/plugin-react'".to_owned(),
    ];
    if uses_tailwind {
        imports.push("import tailwindcss from '@tailwindcss/vite'".to_owned());
    }
    if uses_shadcn {
        imports.push("import path from 'node:path'".to_owned());
    }

    let plugins = if uses_tailwind {
        "[react(), tailwindcss()]"
    } else {
        "[react()]"
    };

    let mut body = format!("  plugins: {plugins},\n");
    if uses_shadcn {
        body.push_str("  resolve: {\n");
        body.push_str("    alias: {\n");
        body.push_str("      '@': path.resolve(__dirname, './src'),\n");
        body.push_str("    },\n");
        body.push_str("  },\n");
    }
    if uses_vitest {
        body.push_str("  test: {\n");
        body.push_str("    environment: 'jsdom',\n");
        body.push_str("  },\n");
    }

    let content = format!(
        "{}\n\n// https://vite.dev/config/\nexport default defineConfig({{\n{body}}})\n",
        imports.join("\n")
    );

    write_text_file(&project_root.join("vite.config.ts"), &content)
}

fn render_recipe_readme(
    project_root: &Path,
    request: &RecipeProjectRequest,
    resolved: &ResolvedRecipe,
) -> Result<()> {
    let blocks = resolved
        .selected_block_ids
        .iter()
        .map(|block| format!("- `{block}`"))
        .collect::<Vec<_>>()
        .join("\n");
    let commands = commands_from_package_json(&Value::Object(read_json_object(
        &project_root.join("package.json"),
    )?))
    .into_iter()
    .map(|command| format!("```sh\n{command}\n```"))
    .collect::<Vec<_>>()
    .join("\n\n");

    let readme = format!(
        r#"# {project_name}

Generated by Scaffolder from the `{recipe_id}` recipe.

## Recipe

- Name: {recipe_name}
- Tier: {tier}
- Status: {status}
- Base template: `{base_template}`

## Blocks

{blocks}

## Commands

{commands}
"#,
        project_name = request.project_name,
        recipe_id = resolved.recipe.id,
        recipe_name = resolved.recipe.name,
        tier = resolved.recipe.tier,
        status = resolved.recipe.status,
        base_template = resolved.recipe.base_template,
    );

    write_text_file(&project_root.join("README.md"), &readme)
}

fn read_package_json(project_root: &Path) -> Result<Value> {
    let package_path = project_root.join("package.json");
    if !package_path.exists() {
        return Ok(Value::Object(Default::default()));
    }

    let raw = std::fs::read_to_string(package_path)?;
    serde_json::from_str(&raw).map_err(Into::into)
}

fn read_json_object(path: &Path) -> Result<Map<String, Value>> {
    let raw = std::fs::read_to_string(path)
        .wrap_err_with(|| format!("failed to read JSON file {}", path.display()))?;
    let raw = strip_json_comments(&raw);
    let value: Value = serde_json::from_str(&raw)
        .wrap_err_with(|| format!("failed to parse JSON file {}", path.display()))?;
    value
        .as_object()
        .cloned()
        .ok_or_else(|| color_eyre::eyre::eyre!("JSON root must be object: {}", path.display()))
}

fn strip_json_comments(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    let mut chars = raw.chars().peekable();
    let mut in_string = false;
    let mut escaped = false;

    while let Some(ch) = chars.next() {
        if in_string {
            out.push(ch);
            if escaped {
                escaped = false;
            } else if ch == '\\' {
                escaped = true;
            } else if ch == '"' {
                in_string = false;
            }
            continue;
        }

        if ch == '"' {
            in_string = true;
            out.push(ch);
            continue;
        }

        if ch == '/' {
            match chars.peek().copied() {
                Some('/') => {
                    chars.next();
                    for next in chars.by_ref() {
                        if next == '\n' {
                            out.push('\n');
                            break;
                        }
                    }
                }
                Some('*') => {
                    chars.next();
                    let mut previous = '\0';
                    for next in chars.by_ref() {
                        if previous == '*' && next == '/' {
                            break;
                        }
                        previous = next;
                    }
                }
                _ => out.push(ch),
            }
            continue;
        }

        out.push(ch);
    }

    out
}

fn write_json_object(path: &Path, root: Map<String, Value>) -> Result<()> {
    write_text_file(
        path,
        &format!("{}\n", serde_json::to_string_pretty(&Value::Object(root))?),
    )
}

fn write_text_file(path: &Path, content: &str) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, content)?;
    Ok(())
}

fn merge_object(root: &mut Map<String, Value>, key: &str, patch: Value) {
    let entry = root
        .entry(key.to_owned())
        .or_insert_with(|| Value::Object(Map::new()));
    if !entry.is_object() {
        *entry = Value::Object(Map::new());
    }
    if let Some(entry_obj) = entry.as_object_mut() {
        merge_json_value(entry_obj, patch);
    }
}

fn merge_json_value(root: &mut Map<String, Value>, patch: Value) {
    let Value::Object(patch_obj) = patch else {
        return;
    };

    for (key, patch_value) in patch_obj {
        match (root.get_mut(&key), patch_value) {
            (Some(Value::Object(existing)), Value::Object(patch_obj)) => {
                merge_json_value(existing, Value::Object(patch_obj));
            }
            (_, value) => {
                root.insert(key, value);
            }
        }
    }
}

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

fn preview_files(project_root: &Path, paths: &[String]) -> Result<Vec<PreviewFile>> {
    const MAX_PREVIEW_BYTES: usize = 24_000;
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
            path: relative_path.clone(),
            language: language_for_path(relative_path).to_owned(),
            content,
            truncated,
        });
    }

    Ok(files)
}

#[derive(Default)]
struct PreviewTreeBuilder {
    is_file: bool,
    children: BTreeMap<String, PreviewTreeBuilder>,
}

fn curated_tree_from_files(project_root: &Path, files: &[PreviewFile]) -> ProjectTreeNode {
    let root_name = project_root
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| "project".to_owned());
    let mut root = PreviewTreeBuilder::default();

    for file in files {
        let parts = file
            .path
            .split('/')
            .filter(|part| !part.is_empty())
            .collect::<Vec<_>>();
        insert_preview_path(&mut root, &parts);
    }

    preview_builder_to_node(root_name, root)
}

fn insert_preview_path(builder: &mut PreviewTreeBuilder, parts: &[&str]) {
    let Some((head, tail)) = parts.split_first() else {
        return;
    };
    let child = builder.children.entry((*head).to_owned()).or_default();
    if tail.is_empty() {
        child.is_file = true;
        return;
    }
    insert_preview_path(child, tail);
}

fn preview_builder_to_node(name: String, builder: PreviewTreeBuilder) -> ProjectTreeNode {
    let mut children = builder
        .children
        .into_iter()
        .map(|(name, child)| preview_builder_to_node(name, child))
        .collect::<Vec<_>>();
    children.sort_by(|left, right| {
        let left_is_dir = left.node_type == "folder";
        let right_is_dir = right.node_type == "folder";
        right_is_dir
            .cmp(&left_is_dir)
            .then_with(|| left.name.cmp(&right.name))
    });

    ProjectTreeNode {
        name,
        node_type: if builder.is_file {
            "file".to_owned()
        } else {
            "folder".to_owned()
        },
        children,
    }
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

fn commands_from_package_json(package_json: &Value) -> Vec<String> {
    let scripts = package_json.get("scripts").and_then(Value::as_object);
    let mut commands = vec!["npm install".to_owned()];

    if scripts.is_some_and(|scripts| scripts.contains_key("dev")) {
        commands.push("npm run dev".to_owned());
    }
    if scripts.is_some_and(|scripts| scripts.contains_key("test")) {
        commands.push("npm test".to_owned());
    }
    if scripts.is_some_and(|scripts| scripts.contains_key("build")) {
        commands.push("npm run build".to_owned());
    }

    commands
}

fn rename_project_root(from: PathBuf, to: PathBuf) -> Result<PathBuf> {
    if from == to {
        return Ok(from);
    }
    std::fs::rename(&from, &to)?;
    Ok(to)
}

fn safe_target_path(project_root: &Path, relative_path: &str) -> Result<PathBuf> {
    let target = project_root.join(relative_path);
    let parent = target.parent().unwrap_or(project_root);
    std::fs::create_dir_all(parent)?;
    let root = project_root.canonicalize()?;
    let canonical_parent = parent.canonicalize()?;
    if !canonical_parent.starts_with(&root) {
        color_eyre::eyre::bail!("target escapes project root: {relative_path}");
    }
    Ok(target)
}

fn validate_project_name(name: &str) -> Result<()> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        color_eyre::eyre::bail!("projectName is required");
    }
    if trimmed.contains('/') || trimmed.contains('\\') {
        color_eyre::eyre::bail!("projectName must not contain path separators");
    }
    Ok(())
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

fn parse_dependency(raw: &str) -> Result<(String, String)> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        color_eyre::eyre::bail!("dependency cannot be empty");
    }
    if trimmed.contains(char::is_whitespace) {
        color_eyre::eyre::bail!("dependency must not contain whitespace: {trimmed}");
    }
    let (name, version) = if let Some(idx) = trimmed.rfind('@') {
        if idx > 0 && idx + 1 < trimmed.len() {
            (&trimmed[..idx], &trimmed[idx + 1..])
        } else {
            (trimmed, "latest")
        }
    } else {
        (trimmed, "latest")
    };
    if !valid_package_name(name) {
        color_eyre::eyre::bail!("invalid package name: {name}");
    }
    Ok((name.to_owned(), version.to_owned()))
}

fn valid_package_name(name: &str) -> bool {
    if let Some(rest) = name.strip_prefix('@') {
        let Some((scope, package)) = rest.split_once('/') else {
            return false;
        };
        valid_package_segment(scope) && valid_package_segment(package)
    } else {
        valid_package_segment(name)
    }
}

fn valid_package_segment(value: &str) -> bool {
    !value.is_empty()
        && value
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' || ch == '.')
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
    } else if path.ends_with(".css") {
        "css"
    } else {
        "text"
    }
}

pub fn recipe_error_response(err: color_eyre::Report) -> axum::response::Response {
    let message = err.to_string();
    let (status, code, user_message) = classify_recipe_error(&message);
    let mut details = BTreeMap::new();
    details.insert("cause".to_owned(), message);

    (
        status,
        Json(RecipeApiError {
            code,
            message: user_message.to_owned(),
            details,
        }),
    )
        .into_response()
}

fn classify_recipe_error(message: &str) -> (axum::http::StatusCode, RecipeErrorCode, &'static str) {
    if message.contains("unknown recipe") {
        return (
            axum::http::StatusCode::NOT_FOUND,
            RecipeErrorCode::InvalidRecipeId,
            "Recipe id is not available.",
        );
    }
    if message.contains("unknown option")
        || message.contains("invalid value")
        || message.contains("projectName")
    {
        return (
            axum::http::StatusCode::BAD_REQUEST,
            RecipeErrorCode::InvalidOption,
            "Recipe options are invalid for the selected recipe.",
        );
    }
    if message.contains("dependency") || message.contains("package name") {
        return (
            axum::http::StatusCode::BAD_REQUEST,
            RecipeErrorCode::InvalidCustomDependency,
            "Custom dependency input is invalid.",
        );
    }
    if message.contains("requires missing")
        || message.contains("conflicts with")
        || message.contains("does not support base template")
        || message.contains("requires missing capability")
    {
        return (
            axum::http::StatusCode::CONFLICT,
            RecipeErrorCode::IncompatibleBlockSelection,
            "Selected recipe blocks are not compatible.",
        );
    }
    if message.contains("template")
        || message.contains("Template inventory")
        || message.contains("base template path")
    {
        return (
            axum::http::StatusCode::SERVICE_UNAVAILABLE,
            RecipeErrorCode::TemplateMissing,
            "Required template files are not available.",
        );
    }

    (
        axum::http::StatusCode::INTERNAL_SERVER_ERROR,
        RecipeErrorCode::GenerationFailed,
        "Recipe project generation failed.",
    )
}

fn support_status_for_recipe(recipe: &RecipeManifest) -> String {
    if recipe.status == "deprecated" || recipe.tier == "deprecated" {
        "deprecated".to_owned()
    } else if recipe.tier == "recommended" && recipe.status == "active" {
        "supported".to_owned()
    } else {
        "experimental".to_owned()
    }
}

fn warnings_for_preview(request: &RecipeProjectRequest, resolved: &ResolvedRecipe) -> Vec<String> {
    let mut warnings = Vec::new();
    if resolved.recipe.tier != "recommended" || resolved.recipe.status != "active" {
        warnings.push(
            "Recipe is not recommended yet; treat generated output as experimental.".to_owned(),
        );
    }
    if !request.extras.dependencies.is_empty() || !request.extras.dev_dependencies.is_empty() {
        warnings.push(
            "Custom dependencies are merged into package.json but are outside recipe verification."
                .to_owned(),
        );
    }
    warnings
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_react_router_recipe_blocks() {
        let request = RecipeProjectRequest {
            project_name: "demo".to_owned(),
            options: BTreeMap::from([
                ("ui".to_owned(), "shadcn".to_owned()),
                ("testing".to_owned(), "vitest".to_owned()),
                ("state".to_owned(), "zustand".to_owned()),
            ]),
            extras: RecipeProjectExtras::default(),
        };
        let resolved = resolve_recipe("react-router-app", &request).expect("recipe resolves");
        assert_eq!(resolved.recipe.id, "react-router-app");
        assert!(
            resolved
                .selected_block_ids
                .contains(&"tailwind-vite".to_owned())
        );
        assert!(
            resolved
                .selected_block_ids
                .contains(&"react-router".to_owned())
        );
        assert!(resolved.selected_block_ids.contains(&"shadcn".to_owned()));
        assert!(resolved.selected_block_ids.contains(&"vitest".to_owned()));
        assert!(resolved.selected_block_ids.contains(&"zustand".to_owned()));
    }

    #[test]
    fn rejects_unknown_recipe_option() {
        let request = RecipeProjectRequest {
            project_name: "demo".to_owned(),
            options: BTreeMap::from([("router".to_owned(), "vue-router".to_owned())]),
            extras: RecipeProjectExtras::default(),
        };
        assert!(resolve_recipe("react-router-app", &request).is_err());
    }

    #[test]
    fn parses_scoped_dependency_extra() {
        let parsed = parse_dependency("@hookform/resolvers@3.10.0").expect("valid dependency");
        assert_eq!(
            parsed,
            ("@hookform/resolvers".to_owned(), "3.10.0".to_owned())
        );
    }

    #[test]
    fn preview_response_contains_stable_phase_three_fields() {
        let response = preview_recipe_project(
            "react-router-app",
            RecipeProjectRequest {
                project_name: "phase-three".to_owned(),
                options: BTreeMap::from([("ui".to_owned(), "shadcn".to_owned())]),
                extras: RecipeProjectExtras {
                    dependencies: vec!["react-hook-form".to_owned()],
                    dev_dependencies: vec![],
                },
            },
        )
        .expect("recipe preview should generate");

        assert_eq!(response.recipe_id, "react-router-app");
        assert_eq!(response.support_status, "supported");
        assert!(!response.tree.children.is_empty());
        assert_eq!(response.curated_tree.node_type, "folder");
        assert!(
            response
                .selected_files
                .iter()
                .any(|file| file.path == "package.json")
        );
        assert!(
            response
                .selected_files
                .iter()
                .any(|file| file.path == "README.md")
        );
        assert_eq!(response.files.len(), response.selected_files.len());
        assert!(
            response
                .dependencies
                .contains(&"react-hook-form".to_owned())
        );
        assert!(!response.warnings.is_empty());
    }

    #[test]
    fn classifies_recipe_api_errors() {
        let (status, code, _) = classify_recipe_error("unknown recipe: nope");
        assert_eq!(status, axum::http::StatusCode::NOT_FOUND);
        assert!(matches!(code, RecipeErrorCode::InvalidRecipeId));

        let (status, code, _) = classify_recipe_error("invalid package name: bad name");
        assert_eq!(status, axum::http::StatusCode::BAD_REQUEST);
        assert!(matches!(code, RecipeErrorCode::InvalidCustomDependency));

        let (status, code, _) =
            classify_recipe_error("block shadcn requires missing block tailwind-vite");
        assert_eq!(status, axum::http::StatusCode::CONFLICT);
        assert!(matches!(code, RecipeErrorCode::IncompatibleBlockSelection));
    }
}
