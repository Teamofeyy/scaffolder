use crate::{
    generation_service::{GeneratedArchive, generate_project, preview_project_tree},
    npm_registry::search_dependencies as search_npm_dependencies,
    resolver::resolve_from_config,
    runtime::{AppState, GateRejection, OperationPermit},
    schema::{FeatureResponse, ProjectConfig, feature_registry_for_api},
};
use async_stream::stream;
use axum::{
    Extension, Json, Router,
    body::{Body, Bytes},
    extract::{Query, State},
    http::{
        HeaderName, HeaderValue, Method, Response, StatusCode,
        header::{self, CONTENT_TYPE},
    },
    middleware::{self, Next},
    response::{IntoResponse, Response as AxumResponse},
    routing::{get, post},
};
use color_eyre::Result;
use serde::{Deserialize, Serialize};
use std::{
    io,
    sync::atomic::{AtomicU64, Ordering},
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tokio::io::AsyncReadExt;
use tower_http::{
    cors::{AllowOrigin, CorsLayer},
    limit::RequestBodyLimitLayer,
    trace::TraceLayer,
};
use tracing::{debug, error, info};
use tracing_subscriber::EnvFilter;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

pub mod ai_proxy;
pub mod archive;
pub mod generation_service;
pub mod npm_registry;
pub mod operations;
pub mod resolver;
pub mod runtime;
pub mod schema;
pub mod template_engine;
pub mod workspace;

const X_REQUEST_ID: HeaderName = HeaderName::from_static("x-request-id");
const MAX_SEARCH_QUERY_LENGTH: usize = 100;
static REQUEST_COUNTER: AtomicU64 = AtomicU64::new(1);

#[derive(Clone)]
struct RequestId(String);

#[derive(OpenApi)]
#[openapi(
    paths(health_check, generate, features),
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

    let app = app().map_err(color_eyre::eyre::Report::msg)?;
    let listener = tokio::net::TcpListener::bind("0.0.0.0:8000")
        .await
        .expect("failed to bind backend listener");
    info!("Server started at: {}", listener.local_addr()?);
    if let Err(err) = axum::serve(listener, app).await {
        error!(error = ?err, "Backend server failed");
        return Err(err.into());
    }

    error!("Backend server exited unexpectedly without shutdown signal");
    Err(color_eyre::eyre::eyre!(
        "backend server exited unexpectedly without shutdown signal"
    ))
}

fn app() -> Result<Router, String> {
    let state = AppState::from_env()?;
    let body_limit = runtime::request_body_limit()?;
    let allowed_origins = runtime::cors_allowed_origins()?;

    let mut router = Router::new()
        .route("/health", get(health_check))
        .route("/generate", post(generate))
        .route("/features", get(features))
        .route("/preview", post(preview))
        .route("/dependencies/search", get(search_dependencies))
        .route("/ai/recommend", post(ai_proxy::recommend));

    if runtime::swagger_enabled() {
        router = router.merge(SwaggerUi::new("/swagger-ui").url("/api-docs", ApiDoc::openapi()));
    }

    if !allowed_origins.is_empty() {
        let cors = CorsLayer::new()
            .allow_origin(AllowOrigin::list(allowed_origins))
            .allow_methods([Method::GET, Method::POST])
            .allow_headers([CONTENT_TYPE])
            .expose_headers([X_REQUEST_ID.clone()]);
        router = router.layer(cors);
    }

    Ok(router
        .with_state(state)
        .layer(RequestBodyLimitLayer::new(body_limit))
        .layer(TraceLayer::new_for_http())
        .layer(middleware::from_fn(assign_request_id)))
}

async fn assign_request_id(mut request: axum::extract::Request, next: Next) -> AxumResponse {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default();
    let sequence = REQUEST_COUNTER.fetch_add(1, Ordering::Relaxed);
    let request_id = format!("req-{millis}-{sequence}");
    request
        .extensions_mut()
        .insert(RequestId(request_id.clone()));

    let mut response = next.run(request).await;
    if let Ok(header_value) = HeaderValue::from_str(&request_id) {
        response
            .headers_mut()
            .insert(X_REQUEST_ID.clone(), header_value);
    }
    response
}

#[utoipa::path(get, path = "/health", responses())]
async fn health_check() -> impl IntoResponse {
    debug!("Got a healthcheck request");
    (StatusCode::OK, "Healthy")
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
async fn generate(
    State(state): State<AppState>,
    Extension(request_id): Extension<RequestId>,
    Json(req): Json<ProjectConfig>,
) -> Result<Response<Body>, ApiError> {
    let request_id = request_id_string(&request_id);
    validate_config(&req, &request_id)?;
    let permit = enter_gate(&state.generate, &request_id, "generation")?;

    let archive = tokio::task::spawn_blocking(move || generate_project(req))
        .await
        .map_err(|err| {
            error!(request_id, error = ?err, "Generation worker failed");
            ApiError::internal(&request_id)
        })?
        .map_err(|err| {
            error!(request_id, error = ?err, "Failed to generate project archive");
            ApiError::internal(&request_id)
        })?;

    stream_archive(archive, permit, &request_id).await
}

async fn stream_archive(
    archive: GeneratedArchive,
    permit: OperationPermit,
    request_id: &str,
) -> Result<Response<Body>, ApiError> {
    let archive_size = archive
        .archive
        .as_file()
        .metadata()
        .map_err(|err| {
            error!(request_id, error = ?err, "Failed to inspect generated archive");
            ApiError::internal(request_id)
        })?
        .len();
    let archive_path = archive.archive.path().to_owned();
    let file = tokio::fs::File::open(archive_path).await.map_err(|err| {
        error!(request_id, error = ?err, "Failed to open generated archive");
        ApiError::internal(request_id)
    })?;
    let file_name = archive.file_name.clone();

    let stream = stream! {
        let _resources = (archive, permit);
        let mut file = file;
        let mut buffer = vec![0_u8; 64 * 1024];

        loop {
            match file.read(&mut buffer).await {
                Ok(0) => break,
                Ok(read) => yield Ok::<Bytes, io::Error>(Bytes::copy_from_slice(&buffer[..read])),
                Err(err) => {
                    yield Err(err);
                    break;
                }
            }
        }
    };

    info!(
        request_id,
        file_name, archive_size, "Project archive generated"
    );
    Response::builder()
        .header(header::CONTENT_TYPE, "application/zip")
        .header(header::CONTENT_LENGTH, archive_size)
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{file_name}\""),
        )
        .body(Body::from_stream(stream))
        .map_err(|err| {
            error!(request_id, error = ?err, "Failed to build archive response");
            ApiError::internal(request_id)
        })
}

async fn preview(
    State(state): State<AppState>,
    Extension(request_id): Extension<RequestId>,
    Json(req): Json<ProjectConfig>,
) -> Result<Json<schema::ProjectTreeNode>, ApiError> {
    let request_id = request_id_string(&request_id);
    validate_config(&req, &request_id)?;
    let _permit = enter_gate(&state.preview, &request_id, "preview")?;

    tokio::task::spawn_blocking(move || preview_project_tree(req))
        .await
        .map_err(|err| {
            error!(request_id, error = ?err, "Preview worker failed");
            ApiError::internal(&request_id)
        })?
        .map(Json)
        .map_err(|err| {
            error!(request_id, error = ?err, "Failed to preview project structure");
            ApiError::internal(&request_id)
        })
}

#[derive(Debug, Deserialize)]
struct DependencySearchQuery {
    q: String,
    limit: Option<usize>,
}

async fn search_dependencies(
    Extension(request_id): Extension<RequestId>,
    Query(query): Query<DependencySearchQuery>,
) -> Result<Json<Vec<schema::DependencySearchResult>>, ApiError> {
    let request_id = request_id_string(&request_id);
    let q = query.q.trim();
    if q.len() < 2 {
        return Ok(Json(Vec::new()));
    }
    if q.len() > MAX_SEARCH_QUERY_LENGTH {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "search_query_too_long",
            "Search query must be at most 100 characters",
            &request_id,
        ));
    }
    if query.limit.is_some_and(|limit| !(1..=20).contains(&limit)) {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "search_limit_invalid",
            "Search result limit must be between 1 and 20",
            &request_id,
        ));
    }

    search_npm_dependencies(q, query.limit.unwrap_or(10))
        .await
        .map(Json)
        .map_err(|err| {
            error!(request_id, error = ?err, query = %q, "Failed to search npm registry");
            ApiError::new(
                StatusCode::BAD_GATEWAY,
                "npm_registry_unavailable",
                "Failed to search npm registry",
                &request_id,
            )
        })
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
    Json(feature_registry_for_api())
}

fn validate_config(config: &ProjectConfig, request_id: &str) -> Result<(), ApiError> {
    config
        .validate()
        .map_err(|err| ApiError::new(StatusCode::BAD_REQUEST, err.code, err.message, request_id))?;

    resolve_from_config(config).map(|_| ()).map_err(|err| {
        ApiError::new(
            StatusCode::UNPROCESSABLE_ENTITY,
            "unsupported_configuration",
            err.to_string(),
            request_id,
        )
    })
}

fn enter_gate(
    gate: &runtime::OperationGate,
    request_id: &str,
    operation: &'static str,
) -> Result<OperationPermit, ApiError> {
    gate.try_enter().map_err(|rejection| match rejection {
        GateRejection::AtCapacity => ApiError::new(
            StatusCode::TOO_MANY_REQUESTS,
            "operation_at_capacity",
            format!("{operation} capacity is currently exhausted"),
            request_id,
        )
        .with_retry_after(Duration::from_secs(1)),
        GateRejection::RateLimited { retry_after } => ApiError::new(
            StatusCode::TOO_MANY_REQUESTS,
            "rate_limit_exceeded",
            format!("{operation} rate limit exceeded"),
            request_id,
        )
        .with_retry_after(retry_after),
    })
}

fn request_id_string(request_id: &RequestId) -> String {
    request_id.0.clone()
}

#[derive(Debug)]
struct ApiError {
    status: StatusCode,
    code: &'static str,
    message: String,
    request_id: String,
    retry_after: Option<Duration>,
}

impl ApiError {
    fn new(
        status: StatusCode,
        code: &'static str,
        message: impl Into<String>,
        request_id: &str,
    ) -> Self {
        Self {
            status,
            code,
            message: message.into(),
            request_id: request_id.to_owned(),
            retry_after: None,
        }
    }

    fn internal(request_id: &str) -> Self {
        Self::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            "internal_error",
            "The request could not be completed",
            request_id,
        )
    }

    fn with_retry_after(mut self, retry_after: Duration) -> Self {
        self.retry_after = Some(retry_after);
        self
    }
}

#[derive(Serialize)]
struct ApiErrorBody {
    error: String,
    code: &'static str,
    request_id: String,
}

impl IntoResponse for ApiError {
    fn into_response(self) -> AxumResponse {
        let mut response = (
            self.status,
            Json(ApiErrorBody {
                error: self.message,
                code: self.code,
                request_id: self.request_id,
            }),
        )
            .into_response();

        if let Some(retry_after) = self.retry_after {
            let seconds = retry_after.as_secs().max(1);
            if let Ok(value) = HeaderValue::from_str(&seconds.to_string()) {
                response.headers_mut().insert(header::RETRY_AFTER, value);
            }
        }

        response
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        body::to_bytes,
        http::{Request, header},
    };
    use serde_json::Value;
    use tower::ServiceExt;

    fn valid_payload() -> Value {
        serde_json::json!({
            "project_name": "demo",
            "framework": "react",
            "styling": "tailwind",
            "linting": "eslint",
            "state_management": "none",
            "routing": "react-router",
            "dependencies": [],
            "dev_dependencies": []
        })
    }

    #[tokio::test]
    async fn validation_errors_include_request_id() {
        let mut payload = valid_payload();
        payload["project_name"] = Value::String("A".repeat(65));
        let response = app()
            .expect("app")
            .oneshot(
                Request::post("/preview")
                    .header(header::CONTENT_TYPE, "application/json")
                    .body(Body::from(payload.to_string()))
                    .expect("request"),
            )
            .await
            .expect("response");

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let request_id = response
            .headers()
            .get(&X_REQUEST_ID)
            .expect("request id")
            .to_str()
            .expect("request id string")
            .to_owned();
        let body = to_bytes(response.into_body(), 16 * 1024)
            .await
            .expect("body");
        let body: Value = serde_json::from_slice(&body).expect("json");
        assert_eq!(body["request_id"], request_id);
        assert_eq!(body["code"], "project_name_too_long");
    }

    #[tokio::test]
    async fn oversized_requests_are_rejected_with_request_id() {
        let response = app()
            .expect("app")
            .oneshot(
                Request::post("/preview")
                    .header(header::CONTENT_TYPE, "application/json")
                    .body(Body::from(vec![b'a'; 70_000]))
                    .expect("request"),
            )
            .await
            .expect("response");

        assert_eq!(response.status(), StatusCode::PAYLOAD_TOO_LARGE);
        assert!(response.headers().contains_key(&X_REQUEST_ID));
    }
}
