FROM rust:1.88-slim-bookworm AS builder

WORKDIR /app

# Build dependencies for common Rust crates and TLS support.
RUN apt-get update \
    && apt-get install -y --no-install-recommends pkg-config libssl-dev ca-certificates \
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

FROM gcr.io/distroless/cc-debian12:nonroot

WORKDIR /app

COPY --from=builder /scaf-api /usr/local/bin/scaf-api

EXPOSE 8000

USER nonroot:nonroot

ENTRYPOINT ["/usr/local/bin/scaf-api"]
