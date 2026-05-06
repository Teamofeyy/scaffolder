use crate::{
    generation_service::generate_project,
    schema::{FeatureResponse, ProjectConfig, feature_registry_for_api},
};
use axum::{
    Json, Router,
    body::Body,
    http::{Response, StatusCode, header},
    response::IntoResponse,
};
use color_eyre::Result;
use tower_http::cors::{Any, CorsLayer};
use tracing::{debug, info};
use utoipa::OpenApi;
use utoipa_axum::router::OpenApiRouter;
use utoipa_swagger_ui::SwaggerUi;

pub mod archive;
pub mod generation_service;
pub mod operations;
pub mod resolver;
pub mod schema;
pub mod template_engine;
pub mod workspace;

#[derive(OpenApi)]
#[openapi(
    paths(health_check, generate, features),
    components(schemas(ProjectConfig, FeatureResponse))
)]
struct ApiDoc;

#[tokio::main]
async fn main() -> Result<()> {
    color_eyre::install()?;
    tracing_subscriber::fmt::init();
    let app = app();
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3001").await.unwrap();
    info!("Server started at: {}", listener.local_addr().unwrap());
    axum::serve(listener, app).await.unwrap();
    Ok(())
}

fn app() -> Router {
    let (router, api_doc) = OpenApiRouter::with_openapi(ApiDoc::openapi())
        .routes(utoipa_axum::routes!(health_check))
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
        .layer(cors) // подключаем CORS
}

#[utoipa::path(
    get,
    path = "/health",
    responses(
        
    )
)]
async fn health_check() -> impl IntoResponse {
    debug!("Got a healthcheck request");
    let res = "Healthy".to_string();
    (StatusCode::OK, res)
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
    match generate_project(req).await {
        Ok(archive) => Response::builder()
            .header(header::CONTENT_TYPE, "application/zip")
            .header(
                header::CONTENT_DISPOSITION,
                format!("attachment; filename=\"{}\"", archive.file_name),
            )
            .body(Body::from(archive.bytes))
            .unwrap(),
        Err(err) => {
            eprintln!("Error: {:?}", err);
            Response::builder()
                .status(500)
                .body(Body::from("Internal Server Error"))
                .unwrap()
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
