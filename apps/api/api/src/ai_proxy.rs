use crate::metrics;
use crate::schema::{Framework, Linting, ProjectConfig, Routing, StateManagement, Styling};
use axum::{Json, http::StatusCode, response::IntoResponse};
use reqwest::header::{CONTENT_TYPE, HeaderMap, HeaderValue};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tracing::{error, info, warn};

const MAX_MESSAGE_CHARS: usize = 1500;
const AI_PROXY_TIMEOUT: Duration = Duration::from_secs(30);

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiRecommendRequest {
    pub session_id: String,
    pub message: String,
    pub locale: String,
    pub current_config: ProjectConfig,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AiProxyRequest {
    request_id: String,
    session_id: String,
    message: String,
    locale: String,
    current_config: ProjectConfig,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AiRecommendResponse {
    pub request_id: String,
    pub message: String,
    pub config_patch: ConfigPatch,
    #[serde(default)]
    pub warnings: Vec<String>,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "snake_case", deny_unknown_fields)]
pub struct ConfigPatch {
    pub framework: Framework,
    pub routing: Routing,
    pub styling: Styling,
    pub state_management: StateManagement,
    #[serde(default)]
    pub linting: Option<Linting>,
    #[serde(default)]
    pub dependencies: Vec<String>,
    #[serde(default)]
    pub dev_dependencies: Vec<String>,
}

pub async fn recommend(Json(req): Json<AiRecommendRequest>) -> impl IntoResponse {
    let session_id = req.session_id.trim();
    let message = req.message.trim();

    if session_id.is_empty() || session_id.len() > 128 {
        return error_response(StatusCode::BAD_REQUEST, "Invalid session id");
    }

    if message.is_empty() {
        return error_response(StatusCode::BAD_REQUEST, "Message is required");
    }

    if message.chars().count() > MAX_MESSAGE_CHARS {
        return error_response(StatusCode::BAD_REQUEST, "Message is too long");
    }

    let Ok(proxy_url) = std::env::var("AI_PROXY_URL") else {
        warn!("AI_PROXY_URL is not configured");
        return error_response(
            StatusCode::SERVICE_UNAVAILABLE,
            "AI recommendations are not configured",
        );
    };

    let Ok(proxy_secret) = std::env::var("AI_PROXY_SECRET") else {
        warn!("AI_PROXY_SECRET is not configured");
        return error_response(
            StatusCode::SERVICE_UNAVAILABLE,
            "AI recommendations are not configured",
        );
    };

    let request_id = request_id();
    let proxy_request = AiProxyRequest {
        request_id: request_id.clone(),
        session_id: session_id.to_owned(),
        message: message.to_owned(),
        locale: req.locale,
        current_config: req.current_config,
    };

    match call_ai_proxy(&proxy_url, &proxy_secret, &proxy_request).await {
        Ok(response) => {
            info!(request_id = %request_id, "AI recommendation returned");
            Json(response).into_response()
        }
        Err(AiProxyError::NotConfigured) => error_response(
            StatusCode::SERVICE_UNAVAILABLE,
            "AI recommendations are not configured",
        ),
        Err(AiProxyError::Upstream(status)) => {
            error!(request_id = %request_id, status = %status, "AI proxy returned an error");
            error_response(StatusCode::BAD_GATEWAY, "AI recommendation service failed")
        }
        Err(AiProxyError::InvalidResponse) => {
            error!(request_id = %request_id, "AI proxy returned an invalid response");
            error_response(StatusCode::BAD_GATEWAY, "Invalid AI response")
        }
        Err(AiProxyError::RequestFailed) => {
            error!(request_id = %request_id, "AI proxy request failed");
            error_response(StatusCode::BAD_GATEWAY, "AI recommendation service failed")
        }
    }
}

async fn call_ai_proxy(
    proxy_url: &str,
    proxy_secret: &str,
    payload: &AiProxyRequest,
) -> Result<AiRecommendResponse, AiProxyError> {
    let endpoint = format!("{}/recommend", proxy_url.trim_end_matches('/'));
    let secret = HeaderValue::from_str(proxy_secret).map_err(|_| AiProxyError::NotConfigured)?;
    let client = reqwest::Client::builder()
        .timeout(AI_PROXY_TIMEOUT)
        .build()
        .map_err(|_| AiProxyError::RequestFailed)?;

    let mut headers = HeaderMap::new();
    headers.insert("X-Proxy-Secret", secret);
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

    let response = client
        .post(endpoint)
        .headers(headers)
        .json(payload)
        .send()
        .await
        .map_err(|_| AiProxyError::RequestFailed)?;

    let status = response.status();
    if !status.is_success() {
        return Err(AiProxyError::Upstream(status));
    }

    response
        .json::<AiRecommendResponse>()
        .await
        .map_err(|_| AiProxyError::InvalidResponse)
}

fn error_response(status: StatusCode, message: &'static str) -> axum::response::Response {
    if status.is_client_error() || status.is_server_error() {
        metrics::record_http_error();
    }

    (status, Json(json!({ "error": message }))).into_response()
}

fn request_id() -> String {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default();
    format!("req-{millis}")
}

#[derive(Debug)]
enum AiProxyError {
    NotConfigured,
    Upstream(reqwest::StatusCode),
    InvalidResponse,
    RequestFailed,
}
