FROM rust:1.88-slim-bookworm AS builder

WORKDIR /app/apps/api

# Build dependencies for common Rust crates and TLS support.
RUN apt-get update \
    && apt-get install -y --no-install-recommends pkg-config libssl-dev ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

# Copy workspace manifests first to improve layer caching.
COPY apps/api/Cargo.toml apps/api/Cargo.lock ./
COPY apps/api/api/Cargo.toml api/Cargo.toml

# Copy sources and build the real binary.
COPY apps/api/api/dependency-presets.json api/dependency-presets.json
COPY apps/api/api/verification-matrix.json api/verification-matrix.json
COPY apps/api/api/src api/src
COPY recipes /app/recipes
RUN cargo build --release --locked --manifest-path api/Cargo.toml \
    && test "$(stat -c%s target/release/scaf-api)" -gt 1000000 \
    && cp target/release/scaf-api /scaf-api

FROM debian:bookworm-slim

WORKDIR /app
ENV SCAFFOLDER_TEMPLATE_ROOT=/app/templates

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates wget \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /scaf-api /usr/local/bin/scaf-api
COPY apps/api/templates templates
RUN test -d templates/react-ts \
    && test -d templates/vue-ts \
    && test -d templates/nextjs \
    && test -d templates/patches

RUN useradd --create-home --uid 10001 appuser

EXPOSE 8000

USER appuser:appuser

ENTRYPOINT ["/usr/local/bin/scaf-api"]
