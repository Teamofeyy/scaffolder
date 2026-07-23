use crate::{
    generation_service::{generate_project, preview_project_details, preview_project_tree},
    npm_registry::search_dependencies as search_npm_dependencies,
    schema::{
        FeatureResponse, PreviewDetailsResponse, ProjectConfig, ProjectPreset, VerificationMatrix,
        feature_registry_for_api, project_presets, verification_matrix,
    },
};
use axum::{
    Json, Router,
    body::Body,
    extract::DefaultBodyLimit,
    extract::Query,
    http::{HeaderValue, Method, Request, Response, StatusCode, header},
    response::IntoResponse,
    routing::{get, post},
};
use color_eyre::Result;
use serde::Deserialize;
use serde::Serialize;
use serde_json::json;
use std::{
    sync::{Arc, OnceLock},
    time::{Duration, Instant},
};
use tokio::sync::{OwnedSemaphorePermit, Semaphore};
use tower_http::{
    cors::{AllowOrigin, CorsLayer},
    trace::{DefaultOnFailure, TraceLayer},
};
use tracing::Level;
use tracing::{debug, error, info, info_span};
use tracing_subscriber::EnvFilter;
use utoipa::OpenApi;
use utoipa_axum::router::OpenApiRouter;
use utoipa_swagger_ui::SwaggerUi;

const REQUEST_BODY_LIMIT_BYTES: usize = 64 * 1024;
const GENERATE_CONCURRENCY_LIMIT: usize = 2;
const PREVIEW_CONCURRENCY_LIMIT: usize = 4;
const GENERATE_TIMEOUT: Duration = Duration::from_secs(30);
const PREVIEW_TIMEOUT: Duration = Duration::from_secs(10);

pub mod ai_proxy;
pub mod archive;
pub mod generation_service;
pub mod metrics;
pub mod npm_registry;
pub mod operations;
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
        preview_details
    ),
    components(schemas(
        ProjectConfig,
        FeatureResponse,
        ProjectPreset,
        VerificationMatrix,
        PreviewDetailsResponse
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
        swagger_path = if swagger_enabled() { "/swagger-ui" } else { "disabled" },
        metrics_path = if metrics_enabled() { "/metrics" } else { "disabled" },
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
        .routes(utoipa_axum::routes!(generate))
        .routes(utoipa_axum::routes!(features))
        .routes(utoipa_axum::routes!(presets))
        .routes(utoipa_axum::routes!(verification_matrix_endpoint))
        .routes(utoipa_axum::routes!(preview_details))
        .split_for_parts();

    let mut router = router
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
        .layer(DefaultBodyLimit::max(REQUEST_BODY_LIMIT_BYTES))
        .layer(cors_layer());

    if metrics_enabled() {
        router = router.route("/metrics", get(metrics_endpoint));
    }

    if swagger_enabled() {
        router = router.merge(SwaggerUi::new("/swagger-ui").url("/api-docs", api_doc));
    }

    router
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
    if let Err(err) = req.validate_for_generation() {
        metrics::record_generate(Duration::ZERO, false);
        return json_error_response(StatusCode::BAD_REQUEST, err.to_string());
    }

    let Some(permit) = acquire_permit(generation_semaphore()) else {
        return too_many_requests_response();
    };

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
    let generation = tokio::time::timeout(
        GENERATE_TIMEOUT,
        tokio::task::spawn_blocking(move || {
            let _permit = permit;
            generate_project(req)
        }),
    )
    .await;

    match generation {
        Ok(Ok(Ok(archive))) => {
            metrics::record_generate(started_at.elapsed(), true);
            info!(
                request_id = %request_id,
                file_name = %archive.file_name,
                archive_bytes = archive.bytes.len(),
                latency_ms = started_at.elapsed().as_millis(),
                "Project archive generated"
            );
            zip_response(archive.file_name, archive.bytes)
        }
        Ok(Ok(Err(err))) => {
            metrics::record_generate(started_at.elapsed(), false);
            error!(
                request_id = %request_id,
                error = ?err,
                latency_ms = started_at.elapsed().as_millis(),
                "Failed to generate project archive"
            );
            json_error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Internal Server Error".to_owned(),
            )
        }
        Ok(Err(err)) => {
            metrics::record_generate(started_at.elapsed(), false);
            error!(
                request_id = %request_id,
                error = ?err,
                latency_ms = started_at.elapsed().as_millis(),
                "Project generation task failed"
            );
            json_error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Internal Server Error".to_owned(),
            )
        }
        Err(_) => {
            metrics::record_generate(started_at.elapsed(), false);
            error!(
                request_id = %request_id,
                timeout_ms = GENERATE_TIMEOUT.as_millis(),
                "Project generation timed out"
            );
            json_error_response(
                StatusCode::GATEWAY_TIMEOUT,
                "Project generation timed out".to_owned(),
            )
        }
    }
}

fn zip_response(file_name: String, bytes: Vec<u8>) -> Response<Body> {
    match Response::builder()
        .header(header::CONTENT_TYPE, "application/zip")
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{file_name}\""),
        )
        .body(Body::from(bytes))
    {
        Ok(archive) => archive,
        Err(err) => {
            error!(error = ?err, "Failed to build ZIP response");
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Internal Server Error".to_owned(),
            )
        }
    }
}

async fn preview(Json(req): Json<ProjectConfig>) -> impl IntoResponse {
    let request_id = request_id();
    if let Err(err) = req.validate_for_generation() {
        return error_response(StatusCode::BAD_REQUEST, err.to_string());
    }

    let Some(permit) = acquire_permit(preview_semaphore()) else {
        return too_many_requests_response();
    };

    info!(
        request_id = %request_id,
        project_name = %req.project_name,
        framework = ?req.framework,
        routing = ?req.routing,
        styling = ?req.styling,
        "Project preview requested"
    );
    let started_at = Instant::now();
    let preview = tokio::time::timeout(
        PREVIEW_TIMEOUT,
        tokio::task::spawn_blocking(move || {
            let _permit = permit;
            preview_project_tree(req)
        }),
    )
    .await;

    match preview {
        Ok(Ok(Ok(tree))) => {
            info!(
                request_id = %request_id,
                latency_ms = started_at.elapsed().as_millis(),
                "Project preview generated"
            );
            Json(tree).into_response()
        }
        Ok(Ok(Err(err))) => {
            error!(
                request_id = %request_id,
                error = ?err,
                latency_ms = started_at.elapsed().as_millis(),
                "Failed to preview project structure"
            );
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Internal Server Error".to_owned(),
            )
        }
        Ok(Err(err)) => {
            error!(
                request_id = %request_id,
                error = ?err,
                latency_ms = started_at.elapsed().as_millis(),
                "Project preview task failed"
            );
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Internal Server Error".to_owned(),
            )
        }
        Err(_) => {
            error!(
                request_id = %request_id,
                timeout_ms = PREVIEW_TIMEOUT.as_millis(),
                "Project preview timed out"
            );
            error_response(
                StatusCode::GATEWAY_TIMEOUT,
                "Project preview timed out".to_owned(),
            )
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
    if let Err(err) = req.validate_for_generation() {
        return error_response(StatusCode::BAD_REQUEST, err.to_string());
    }

    let Some(permit) = acquire_permit(preview_semaphore()) else {
        return too_many_requests_response();
    };

    info!(
        request_id = %request_id,
        project_name = %req.project_name,
        framework = ?req.framework,
        routing = ?req.routing,
        styling = ?req.styling,
        "Detailed project preview requested"
    );
    let started_at = Instant::now();
    let preview = tokio::time::timeout(
        PREVIEW_TIMEOUT,
        tokio::task::spawn_blocking(move || {
            let _permit = permit;
            preview_project_details(req)
        }),
    )
    .await;

    match preview {
        Ok(Ok(Ok(details))) => {
            info!(
                request_id = %request_id,
                latency_ms = started_at.elapsed().as_millis(),
                "Detailed project preview generated"
            );
            Json(details).into_response()
        }
        Ok(Ok(Err(err))) => {
            error!(
                request_id = %request_id,
                error = ?err,
                latency_ms = started_at.elapsed().as_millis(),
                "Failed to generate detailed project preview"
            );
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Internal Server Error".to_owned(),
            )
        }
        Ok(Err(err)) => {
            error!(
                request_id = %request_id,
                error = ?err,
                latency_ms = started_at.elapsed().as_millis(),
                "Detailed project preview task failed"
            );
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Internal Server Error".to_owned(),
            )
        }
        Err(_) => {
            error!(
                request_id = %request_id,
                timeout_ms = PREVIEW_TIMEOUT.as_millis(),
                "Detailed project preview timed out"
            );
            error_response(
                StatusCode::GATEWAY_TIMEOUT,
                "Project preview timed out".to_owned(),
            )
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

fn cors_layer() -> CorsLayer {
    CorsLayer::new()
        .allow_origin(AllowOrigin::list(cors_allowed_origins()))
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers([header::CONTENT_TYPE])
}

fn cors_allowed_origins() -> Vec<HeaderValue> {
    let configured = std::env::var("CORS_ALLOWED_ORIGINS")
        .unwrap_or_else(|_| "http://127.0.0.1:3000,http://localhost:3000".to_owned());

    let origins = configured
        .split(',')
        .filter_map(|origin| {
            let origin = origin.trim();
            if origin.is_empty() {
                None
            } else {
                HeaderValue::from_str(origin).ok()
            }
        })
        .collect::<Vec<_>>();

    if origins.is_empty() {
        vec![
            HeaderValue::from_static("http://127.0.0.1:3000"),
            HeaderValue::from_static("http://localhost:3000"),
        ]
    } else {
        origins
    }
}

fn generation_semaphore() -> &'static Arc<Semaphore> {
    static SEMAPHORE: OnceLock<Arc<Semaphore>> = OnceLock::new();
    SEMAPHORE.get_or_init(|| Arc::new(Semaphore::new(GENERATE_CONCURRENCY_LIMIT)))
}

fn preview_semaphore() -> &'static Arc<Semaphore> {
    static SEMAPHORE: OnceLock<Arc<Semaphore>> = OnceLock::new();
    SEMAPHORE.get_or_init(|| Arc::new(Semaphore::new(PREVIEW_CONCURRENCY_LIMIT)))
}

fn acquire_permit(semaphore: &'static Arc<Semaphore>) -> Option<OwnedSemaphorePermit> {
    semaphore.clone().try_acquire_owned().ok()
}

fn too_many_requests_response() -> Response<Body> {
    error_response(
        StatusCode::TOO_MANY_REQUESTS,
        "Too many requests".to_owned(),
    )
}

fn swagger_enabled() -> bool {
    env_flag("SCAFFOLDER_ENABLE_SWAGGER")
}

fn metrics_enabled() -> bool {
    env_flag("SCAFFOLDER_ENABLE_METRICS")
}

fn env_flag(name: &str) -> bool {
    std::env::var(name)
        .map(|value| matches!(value.trim(), "1" | "true" | "TRUE" | "yes" | "YES"))
        .unwrap_or(false)
}

fn error_response(status: StatusCode, message: String) -> Response<Body> {
    if status.is_client_error() || status.is_server_error() {
        metrics::record_http_error();
    }

    json_error_response(status, message)
}

fn json_error_response(status: StatusCode, message: String) -> Response<Body> {
    (status, Json(json!({ "error": message }))).into_response()
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
