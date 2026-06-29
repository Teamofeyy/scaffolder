use std::{
    fmt::Write,
    sync::atomic::{AtomicU64, Ordering},
    time::Duration,
};

static GENERATE_TOTAL: AtomicU64 = AtomicU64::new(0);
static GENERATE_ERRORS_TOTAL: AtomicU64 = AtomicU64::new(0);
static GENERATE_LATENCY_MS_TOTAL: AtomicU64 = AtomicU64::new(0);
static HTTP_ERRORS_TOTAL: AtomicU64 = AtomicU64::new(0);

pub fn record_generate(duration: Duration, success: bool) {
    GENERATE_TOTAL.fetch_add(1, Ordering::Relaxed);
    GENERATE_LATENCY_MS_TOTAL.fetch_add(duration.as_millis() as u64, Ordering::Relaxed);

    if !success {
        GENERATE_ERRORS_TOTAL.fetch_add(1, Ordering::Relaxed);
        HTTP_ERRORS_TOTAL.fetch_add(1, Ordering::Relaxed);
    }
}

pub fn record_http_error() {
    HTTP_ERRORS_TOTAL.fetch_add(1, Ordering::Relaxed);
}

pub fn render() -> String {
    let generate_total = GENERATE_TOTAL.load(Ordering::Relaxed);
    let generate_errors_total = GENERATE_ERRORS_TOTAL.load(Ordering::Relaxed);
    let generate_latency_ms_total = GENERATE_LATENCY_MS_TOTAL.load(Ordering::Relaxed);
    let http_errors_total = HTTP_ERRORS_TOTAL.load(Ordering::Relaxed);

    let mut body = String::new();
    writeln!(
        body,
        "# HELP scaffolder_generation_total Total project generation requests."
    )
    .ok();
    writeln!(body, "# TYPE scaffolder_generation_total counter").ok();
    writeln!(body, "scaffolder_generation_total {generate_total}").ok();
    writeln!(
        body,
        "# HELP scaffolder_generation_errors_total Total failed project generation requests."
    )
    .ok();
    writeln!(body, "# TYPE scaffolder_generation_errors_total counter").ok();
    writeln!(
        body,
        "scaffolder_generation_errors_total {generate_errors_total}"
    )
    .ok();
    writeln!(
        body,
        "# HELP scaffolder_generation_latency_ms_total Total project generation latency in milliseconds."
    )
    .ok();
    writeln!(
        body,
        "# TYPE scaffolder_generation_latency_ms_total counter"
    )
    .ok();
    writeln!(
        body,
        "scaffolder_generation_latency_ms_total {generate_latency_ms_total}"
    )
    .ok();
    writeln!(
        body,
        "# HELP scaffolder_http_errors_total Total HTTP errors."
    )
    .ok();
    writeln!(body, "# TYPE scaffolder_http_errors_total counter").ok();
    writeln!(body, "scaffolder_http_errors_total {http_errors_total}").ok();

    body
}
