use crate::{
    generation_service::{generate_project, preview_project_details, preview_project_tree},
    npm_registry::search_dependencies as search_npm_dependencies,
    recipe_service::{
        RecipeCatalogItem, RecipeManifest, RecipePreviewDetailsResponse, RecipeProjectRequest,
        generate_recipe_project, preview_recipe_project, recipe_catalog, recipe_details,
        recipe_error_response,
    },
    schema::{
        FeatureResponse, PreviewDetailsResponse, ProjectConfig, ProjectPreset, VerificationMatrix,
        feature_registry_for_api, project_presets, verification_matrix,
    },
};
use axum::{
    Json, Router,
    body::Body,
    extract::{Path as AxumPath, Query},
    http::{Request, Response, StatusCode, header},
    response::IntoResponse,
    routing::{get, post},
};
use color_eyre::Result;
use serde::Deserialize;
use serde::Serialize;
use std::time::Instant;
use tower_http::{
    cors::{Any, CorsLayer},
    trace::{DefaultOnFailure, TraceLayer},
};
use tracing::Level;
use tracing::{debug, error, info, info_span};
use tracing_subscriber::EnvFilter;
use utoipa::OpenApi;
use utoipa_axum::router::OpenApiRouter;
use utoipa_swagger_ui::SwaggerUi;

pub mod ai_proxy;
pub mod archive;
pub mod generation_service;
pub mod metrics;
pub mod npm_registry;
pub mod operations;
pub mod recipe_service;
pub mod resolver;
pub mod schema;
pub mod template_engine;
pub mod workspace;

#[derive(OpenApi)]
#[openapi(
    paths(
        health_check,
        liveness_check,
        readiness_check,
        capabilities,
        metrics_endpoint,
        generate,
        features,
        presets,
        verification_matrix_endpoint,
        preview_details,
        recipes,
        recipe,
        recipe_preview,
        recipe_generate
    ),
    components(schemas(
        ProjectConfig,
        FeatureResponse,
        ProjectPreset,
        VerificationMatrix,
        PreviewDetailsResponse,
        RecipeProjectRequest,
        RecipeCatalogItem,
        RecipeManifest,
        RecipePreviewDetailsResponse
    ))
)]
struct ApiDoc;

#[tokio::main]
async fn main() -> Result<()> {
    color_eyre::install()?;
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();
    let app = app();
    let listener = tokio::net::TcpListener::bind("0.0.0.0:8000")
        .await
        .expect("failed to bind backend listener");
    let local_addr = listener.local_addr()?;
    if let Err(err) = template_engine::validate_template_inventory() {
        error!(error = ?err, "Template inventory validation failed at startup");
        return Err(err);
    }

    info!(
        address = %local_addr,
        swagger_path = "/swagger-ui",
        metrics_path = "/metrics",
        ai_recommendations = ai_proxy_configured(),
        template_dir = %template_engine::template_root().display(),
        "Backend server starting"
    );
    if let Err(err) = axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
    {
        error!(error = ?err, "Backend server failed");
        return Err(err.into());
    }

    info!("Backend server stopped gracefully");
    Ok(())
}

fn app() -> Router {
    let (router, api_doc) = OpenApiRouter::with_openapi(ApiDoc::openapi())
        .routes(utoipa_axum::routes!(health_check))
        .routes(utoipa_axum::routes!(liveness_check))
        .routes(utoipa_axum::routes!(readiness_check))
        .routes(utoipa_axum::routes!(capabilities))
        .routes(utoipa_axum::routes!(metrics_endpoint))
        .routes(utoipa_axum::routes!(generate))
        .routes(utoipa_axum::routes!(features))
        .routes(utoipa_axum::routes!(presets))
        .routes(utoipa_axum::routes!(verification_matrix_endpoint))
        .routes(utoipa_axum::routes!(preview_details))
        .routes(utoipa_axum::routes!(recipes))
        .routes(utoipa_axum::routes!(recipe))
        .routes(utoipa_axum::routes!(recipe_preview))
        .routes(utoipa_axum::routes!(recipe_generate))
        .split_for_parts();

    // создаём Cors слой
    let cors = CorsLayer::new()
        .allow_origin(Any) // разрешает запросы с любого домена (для dev)
        .allow_methods(Any) // разрешает любые HTTP методы
        .allow_headers(Any); // разрешает любые заголовки

    router
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs", api_doc))
        .route("/preview", post(preview))
        .route("/dependencies/search", get(search_dependencies))
        .route("/ai/recommend", post(ai_proxy::recommend))
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(|request: &Request<Body>| {
                    info_span!(
                        "http_request",
                        method = %request.method(),
                        path = %request.uri().path(),
                        request_id = %request_id()
                    )
                })
                .on_response(
                    |response: &Response<Body>,
                     latency: std::time::Duration,
                     _span: &tracing::Span| {
                        info!(
                            status = response.status().as_u16(),
                            latency_ms = latency.as_millis(),
                            "HTTP request completed"
                        );
                    },
                )
                .on_failure(DefaultOnFailure::new().level(Level::ERROR)),
        )
        .layer(cors) // подключаем CORS
}

#[utoipa::path(get, path = "/health", responses())]
async fn health_check() -> impl IntoResponse {
    debug!("Got a healthcheck request");
    let res = "Healthy".to_string();
    (StatusCode::OK, res)
}

#[utoipa::path(get, path = "/live", responses())]
async fn liveness_check() -> impl IntoResponse {
    (StatusCode::OK, "Live")
}

#[utoipa::path(get, path = "/ready", responses())]
async fn readiness_check() -> impl IntoResponse {
    match template_engine::validate_template_inventory() {
        Ok(()) => (StatusCode::OK, "Ready").into_response(),
        Err(err) => {
            error!(error = ?err, "Readiness check failed");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                "Template inventory is unavailable",
            )
                .into_response()
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CapabilitiesResponse {
    ai_recommendations: bool,
}

#[utoipa::path(get, path = "/capabilities", responses())]
async fn capabilities() -> impl IntoResponse {
    Json(CapabilitiesResponse {
        ai_recommendations: ai_proxy_configured(),
    })
}

#[utoipa::path(get, path = "/metrics", responses())]
async fn metrics_endpoint() -> impl IntoResponse {
    (
        StatusCode::OK,
        [(header::CONTENT_TYPE, "text/plain; version=0.0.4")],
        metrics::render(),
    )
}

#[utoipa::path(
    post,
    path = "/generate",
    request_body = ProjectConfig,
    responses(
        (status = 200,
         description = "ZIP successfully generated",
         content_type = "application/zip")
    )
)]
async fn generate(Json(req): Json<ProjectConfig>) -> impl IntoResponse {
    let request_id = request_id();
    info!(
        request_id = %request_id,
        project_name = %req.project_name,
        framework = ?req.framework,
        routing = ?req.routing,
        styling = ?req.styling,
        linting = ?req.linting,
        state_management = ?req.state_management,
        dependencies = req.dependencies.len(),
        dev_dependencies = req.dev_dependencies.len(),
        "Project generation requested"
    );
    let started_at = Instant::now();
    match generate_project(req).await {
        Ok(archive) => {
            metrics::record_generate(started_at.elapsed(), true);
            info!(
                request_id = %request_id,
                file_name = %archive.file_name,
                archive_bytes = archive.bytes.len(),
                latency_ms = started_at.elapsed().as_millis(),
                "Project archive generated"
            );
            Response::builder()
                .header(header::CONTENT_TYPE, "application/zip")
                .header(
                    header::CONTENT_DISPOSITION,
                    format!("attachment; filename=\"{}\"", archive.file_name),
                )
                .body(Body::from(archive.bytes))
                .unwrap()
        }
        Err(err) => {
            metrics::record_generate(started_at.elapsed(), false);
            error!(
                request_id = %request_id,
                error = ?err,
                latency_ms = started_at.elapsed().as_millis(),
                "Failed to generate project archive"
            );
            Response::builder()
                .status(500)
                .body(Body::from("Internal Server Error"))
                .unwrap()
        }
    }
}

async fn preview(Json(req): Json<ProjectConfig>) -> impl IntoResponse {
    let request_id = request_id();
    info!(
        request_id = %request_id,
        project_name = %req.project_name,
        framework = ?req.framework,
        routing = ?req.routing,
        styling = ?req.styling,
        "Project preview requested"
    );
    let started_at = Instant::now();
    match preview_project_tree(req) {
        Ok(tree) => {
            info!(
                request_id = %request_id,
                latency_ms = started_at.elapsed().as_millis(),
                "Project preview generated"
            );
            Json(tree).into_response()
        }
        Err(err) => {
            metrics::record_http_error();
            error!(
                request_id = %request_id,
                error = ?err,
                latency_ms = started_at.elapsed().as_millis(),
                "Failed to preview project structure"
            );
            (StatusCode::INTERNAL_SERVER_ERROR, "Internal Server Error").into_response()
        }
    }
}

#[utoipa::path(
    post,
    path = "/preview/details",
    request_body = ProjectConfig,
    responses (
        (status = 200,
         description = "Detailed deterministic project preview",
         content_type = "application/json",
         body = PreviewDetailsResponse
        )
    )
)]
async fn preview_details(Json(req): Json<ProjectConfig>) -> impl IntoResponse {
    let request_id = request_id();
    info!(
        request_id = %request_id,
        project_name = %req.project_name,
        framework = ?req.framework,
        routing = ?req.routing,
        styling = ?req.styling,
        "Detailed project preview requested"
    );
    let started_at = Instant::now();
    match preview_project_details(req) {
        Ok(details) => {
            info!(
                request_id = %request_id,
                latency_ms = started_at.elapsed().as_millis(),
                "Detailed project preview generated"
            );
            Json(details).into_response()
        }
        Err(err) => {
            metrics::record_http_error();
            error!(
                request_id = %request_id,
                error = ?err,
                latency_ms = started_at.elapsed().as_millis(),
                "Failed to generate detailed project preview"
            );
            (StatusCode::INTERNAL_SERVER_ERROR, "Internal Server Error").into_response()
        }
    }
}

#[utoipa::path(
    get,
    path = "/recipes",
    responses (
        (status = 200,
         description = "Recipe catalog",
         content_type = "application/json",
         body = [RecipeCatalogItem]
        )
    )
)]
async fn recipes() -> impl IntoResponse {
    match recipe_catalog() {
        Ok(items) => Json(items).into_response(),
        Err(err) => recipe_error_response(err),
    }
}

#[utoipa::path(
    get,
    path = "/recipes/{id}",
    params(("id" = String, Path, description = "Recipe id")),
    responses (
        (status = 200,
         description = "Recipe details",
         content_type = "application/json",
         body = RecipeManifest
        )
    )
)]
async fn recipe(AxumPath(id): AxumPath<String>) -> impl IntoResponse {
    match recipe_details(&id) {
        Ok(details) => Json(details).into_response(),
        Err(err) => recipe_error_response(err),
    }
}

#[utoipa::path(
    post,
    path = "/recipes/{id}/preview",
    params(("id" = String, Path, description = "Recipe id")),
    request_body = RecipeProjectRequest,
    responses (
        (status = 200,
         description = "Detailed recipe project preview",
         content_type = "application/json",
         body = RecipePreviewDetailsResponse
        )
    )
)]
async fn recipe_preview(
    AxumPath(id): AxumPath<String>,
    Json(req): Json<RecipeProjectRequest>,
) -> impl IntoResponse {
    let request_id = request_id();
    info!(
        request_id = %request_id,
        recipe_id = %id,
        project_name = %req.project_name,
        "Recipe project preview requested"
    );
    let started_at = Instant::now();
    match preview_recipe_project(&id, req) {
        Ok(details) => {
            info!(
                request_id = %request_id,
                latency_ms = started_at.elapsed().as_millis(),
                "Recipe project preview generated"
            );
            Json(details).into_response()
        }
        Err(err) => {
            metrics::record_http_error();
            error!(
                request_id = %request_id,
                error = ?err,
                latency_ms = started_at.elapsed().as_millis(),
                "Failed to generate recipe project preview"
            );
            recipe_error_response(err)
        }
    }
}

#[utoipa::path(
    post,
    path = "/recipes/{id}/generate",
    params(("id" = String, Path, description = "Recipe id")),
    request_body = RecipeProjectRequest,
    responses(
        (status = 200,
         description = "Recipe ZIP successfully generated",
         content_type = "application/zip")
    )
)]
async fn recipe_generate(
    AxumPath(id): AxumPath<String>,
    Json(req): Json<RecipeProjectRequest>,
) -> impl IntoResponse {
    let request_id = request_id();
    info!(
        request_id = %request_id,
        recipe_id = %id,
        project_name = %req.project_name,
        "Recipe project generation requested"
    );
    let started_at = Instant::now();
    match generate_recipe_project(&id, req).await {
        Ok(archive) => {
            metrics::record_generate(started_at.elapsed(), true);
            info!(
                request_id = %request_id,
                file_name = %archive.file_name,
                archive_bytes = archive.bytes.len(),
                latency_ms = started_at.elapsed().as_millis(),
                "Recipe project archive generated"
            );
            Response::builder()
                .header(header::CONTENT_TYPE, "application/zip")
                .header(
                    header::CONTENT_DISPOSITION,
                    format!("attachment; filename=\"{}\"", archive.file_name),
                )
                .body(Body::from(archive.bytes))
                .unwrap()
        }
        Err(err) => {
            metrics::record_generate(started_at.elapsed(), false);
            error!(
                request_id = %request_id,
                error = ?err,
                latency_ms = started_at.elapsed().as_millis(),
                "Failed to generate recipe project archive"
            );
            recipe_error_response(err)
        }
    }
}

#[derive(Debug, Deserialize)]
struct DependencySearchQuery {
    q: String,
    limit: Option<usize>,
}

async fn search_dependencies(Query(query): Query<DependencySearchQuery>) -> impl IntoResponse {
    let q = query.q.trim();
    if q.len() < 2 {
        return Json(Vec::<crate::schema::DependencySearchResult>::new()).into_response();
    }

    let request_id = request_id();
    info!(
        request_id = %request_id,
        query = %q,
        limit = query.limit.unwrap_or(10),
        "Dependency search requested"
    );
    let started_at = Instant::now();
    match search_npm_dependencies(q, query.limit.unwrap_or(10)).await {
        Ok(results) => {
            info!(
                request_id = %request_id,
                results = results.len(),
                latency_ms = started_at.elapsed().as_millis(),
                "Dependency search completed"
            );
            Json(results).into_response()
        }
        Err(err) => {
            metrics::record_http_error();
            error!(
                request_id = %request_id,
                error = ?err,
                query = %q,
                latency_ms = started_at.elapsed().as_millis(),
                "Failed to search npm dependencies"
            );
            (StatusCode::BAD_GATEWAY, "Failed to search npm registry").into_response()
        }
    }
}

#[utoipa::path(
    get,
    path = "/features",
    responses (
        (status = 200,
         description = "List of features",
         content_type = "application/json",
         body = [FeatureResponse]
        )
    )
)]
async fn features() -> impl IntoResponse {
    debug!("Got an features request");
    Json(feature_registry_for_api())
}

#[utoipa::path(
    get,
    path = "/presets",
    responses (
        (status = 200,
         description = "List of project presets",
         content_type = "application/json",
         body = [ProjectPreset]
        )
    )
)]
async fn presets() -> impl IntoResponse {
    Json(project_presets())
}

#[utoipa::path(
    get,
    path = "/verification-matrix",
    responses (
        (status = 200,
         description = "Stable verification matrix",
         content_type = "application/json",
         body = VerificationMatrix
        )
    )
)]
async fn verification_matrix_endpoint() -> impl IntoResponse {
    Json(verification_matrix())
}

fn ai_proxy_configured() -> bool {
    std::env::var("AI_PROXY_URL")
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false)
        && std::env::var("AI_PROXY_SECRET")
            .map(|value| !value.trim().is_empty())
            .unwrap_or(false)
}

fn request_id() -> String {
    use std::sync::atomic::{AtomicU64, Ordering};

    static NEXT_REQUEST_ID: AtomicU64 = AtomicU64::new(1);
    let id = NEXT_REQUEST_ID.fetch_add(1, Ordering::Relaxed);
    format!("req-{id}")
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        () = ctrl_c => {},
        () = terminate => {},
    }

    info!("Shutdown signal received");
}
