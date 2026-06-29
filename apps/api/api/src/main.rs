use crate::{
    generation_service::{generate_project, preview_project_tree},
    npm_registry::search_dependencies as search_npm_dependencies,
    schema::{FeatureResponse, ProjectConfig, feature_registry_for_api},
};
use axum::{
    Json, Router,
    body::Body,
    extract::Query,
    http::{Response, StatusCode, header},
    response::IntoResponse,
    routing::{get, post},
};
use color_eyre::Result;
use serde::Deserialize;
use serde::Serialize;
use std::time::Instant;
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use tracing::{debug, error, info};
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
        features
    ),
    components(schemas(ProjectConfig, FeatureResponse))
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
    info!("Server started at: {}", listener.local_addr()?);
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
        .layer(TraceLayer::new_for_http())
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
    (StatusCode::OK, "Ready")
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
    debug!("Got a generate request");
    let started_at = Instant::now();
    match generate_project(req).await {
        Ok(archive) => {
            metrics::record_generate(started_at.elapsed(), true);
            info!(file_name = %archive.file_name, "Project archive generated");
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
            error!(error = ?err, "Failed to generate project archive");
            Response::builder()
                .status(500)
                .body(Body::from("Internal Server Error"))
                .unwrap()
        }
    }
}

async fn preview(Json(req): Json<ProjectConfig>) -> impl IntoResponse {
    debug!("Got a preview request");
    match preview_project_tree(req) {
        Ok(tree) => Json(tree).into_response(),
        Err(err) => {
            metrics::record_http_error();
            error!(error = ?err, "Failed to preview project structure");
            (StatusCode::INTERNAL_SERVER_ERROR, "Internal Server Error").into_response()
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

    match search_npm_dependencies(q, query.limit.unwrap_or(10)).await {
        Ok(results) => Json(results).into_response(),
        Err(err) => {
            metrics::record_http_error();
            error!(error = ?err, query = %q, "Failed to search npm dependencies");
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

fn ai_proxy_configured() -> bool {
    std::env::var("AI_PROXY_URL")
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false)
        && std::env::var("AI_PROXY_SECRET")
            .map(|value| !value.trim().is_empty())
            .unwrap_or(false)
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
