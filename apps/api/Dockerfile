FROM rust:1.88-slim-bookworm AS builder

WORKDIR /app

# Build dependencies for common Rust crates and TLS support.
RUN apt-get update \
    && apt-get install -y --no-install-recommends pkg-config libssl-dev ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

# Copy workspace manifests first to improve layer caching.
COPY Cargo.toml Cargo.lock ./
COPY api/Cargo.toml api/Cargo.toml

# Prebuild dependency graph cache.
RUN mkdir -p api/src \
    && echo "fn main() {}" > api/src/main.rs \
    && cargo build --release --locked --manifest-path api/Cargo.toml \
    && rm -rf api/src

# Copy real sources and build final binary.
COPY api/src api/src
RUN cargo build --release --locked --manifest-path api/Cargo.toml \
    && cp target/release/scaf-api /scaf-api

FROM debian:bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates wget \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /scaf-api /usr/local/bin/scaf-api

RUN useradd --create-home --uid 10001 appuser

EXPOSE 8000

USER appuser:appuser

ENTRYPOINT ["/usr/local/bin/scaf-api"]
