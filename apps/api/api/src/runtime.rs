use std::{
    collections::VecDeque,
    env,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use tokio::sync::{OwnedSemaphorePermit, Semaphore};

const RATE_WINDOW: Duration = Duration::from_secs(60);

#[derive(Clone)]
pub struct AppState {
    pub generate: OperationGate,
    pub preview: OperationGate,
}

impl AppState {
    pub fn from_env() -> Result<Self, String> {
        Ok(Self {
            generate: OperationGate::new(
                env_usize("GENERATE_MAX_CONCURRENCY", 2)?,
                env_usize("GENERATE_RATE_LIMIT_PER_MINUTE", 30)?,
            )?,
            preview: OperationGate::new(
                env_usize("PREVIEW_MAX_CONCURRENCY", 4)?,
                env_usize("PREVIEW_RATE_LIMIT_PER_MINUTE", 120)?,
            )?,
        })
    }
}

#[derive(Clone)]
pub struct OperationGate {
    semaphore: Arc<Semaphore>,
    rate_limiter: Arc<SlidingWindowRateLimiter>,
}

impl OperationGate {
    fn new(max_concurrency: usize, requests_per_minute: usize) -> Result<Self, String> {
        if max_concurrency == 0 {
            return Err("operation concurrency limit must be greater than zero".to_owned());
        }
        if requests_per_minute == 0 {
            return Err("operation rate limit must be greater than zero".to_owned());
        }

        Ok(Self {
            semaphore: Arc::new(Semaphore::new(max_concurrency)),
            rate_limiter: Arc::new(SlidingWindowRateLimiter {
                max_requests: requests_per_minute,
                requests: Mutex::new(VecDeque::with_capacity(requests_per_minute)),
            }),
        })
    }

    pub fn try_enter(&self) -> Result<OperationPermit, GateRejection> {
        let permit = self
            .semaphore
            .clone()
            .try_acquire_owned()
            .map_err(|_| GateRejection::AtCapacity)?;

        if let Err(retry_after) = self.rate_limiter.check() {
            drop(permit);
            return Err(GateRejection::RateLimited { retry_after });
        }

        Ok(OperationPermit(permit))
    }
}

pub struct OperationPermit(#[allow(dead_code)] OwnedSemaphorePermit);

#[derive(Debug)]
pub enum GateRejection {
    AtCapacity,
    RateLimited { retry_after: Duration },
}

struct SlidingWindowRateLimiter {
    max_requests: usize,
    requests: Mutex<VecDeque<Instant>>,
}

impl SlidingWindowRateLimiter {
    fn check(&self) -> Result<(), Duration> {
        let now = Instant::now();
        let mut requests = self
            .requests
            .lock()
            .expect("rate limiter mutex must not be poisoned");

        while requests
            .front()
            .is_some_and(|started_at| now.duration_since(*started_at) >= RATE_WINDOW)
        {
            requests.pop_front();
        }

        if requests.len() >= self.max_requests {
            let retry_after = requests
                .front()
                .map(|started_at| RATE_WINDOW.saturating_sub(now.duration_since(*started_at)))
                .unwrap_or(RATE_WINDOW);
            return Err(retry_after);
        }

        requests.push_back(now);
        Ok(())
    }
}

pub fn request_body_limit() -> Result<usize, String> {
    env_usize("MAX_REQUEST_BODY_BYTES", 65_536)
}

pub fn swagger_enabled() -> bool {
    env::var("SWAGGER_ENABLED")
        .is_ok_and(|value| matches!(value.to_ascii_lowercase().as_str(), "1" | "true" | "yes"))
}

pub fn cors_allowed_origins() -> Result<Vec<axum::http::HeaderValue>, String> {
    let Ok(raw) = env::var("CORS_ALLOWED_ORIGINS") else {
        return Ok(Vec::new());
    };

    raw.split(',')
        .map(str::trim)
        .filter(|origin| !origin.is_empty())
        .map(|origin| {
            if origin == "*" {
                return Err(
                    "CORS_ALLOWED_ORIGINS must list explicit origins; wildcard is not allowed"
                        .to_owned(),
                );
            }
            origin
                .parse()
                .map_err(|_| format!("invalid CORS origin: {origin}"))
        })
        .collect()
}

fn env_usize(name: &str, default: usize) -> Result<usize, String> {
    match env::var(name) {
        Ok(value) => value
            .parse::<usize>()
            .ok()
            .filter(|value| *value > 0)
            .ok_or_else(|| format!("{name} must be a positive integer")),
        Err(env::VarError::NotPresent) => Ok(default),
        Err(env::VarError::NotUnicode(_)) => Err(format!("{name} must be valid UTF-8")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn gate_rejects_excess_concurrency() {
        let gate = OperationGate::new(1, 10).expect("gate");
        let _permit = gate.try_enter().expect("first permit");
        assert!(matches!(gate.try_enter(), Err(GateRejection::AtCapacity)));
    }

    #[test]
    fn gate_rejects_excess_rate() {
        let gate = OperationGate::new(2, 1).expect("gate");
        drop(gate.try_enter().expect("first request"));
        assert!(matches!(
            gate.try_enter(),
            Err(GateRejection::RateLimited { .. })
        ));
    }
}
