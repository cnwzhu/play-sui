# Build Frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
# Install pnpm
RUN npm install -g pnpm
# Copy frontend dependencies and config
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
# Copy frontend source
COPY frontend/ ./
RUN pnpm build

# Build Backend
FROM rust:1.93-slim-bookworm AS backend-builder
WORKDIR /app

# Install system dependencies (OpenSSL is required for many Rust crates)
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

# Copy frontend build artifacts (expected by backend build)
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

WORKDIR /app/backend
# Copy backend files
COPY backend/Cargo.toml backend/Cargo.lock ./
COPY backend/src ./src

# Build release binary
RUN cargo build --release

# Optional: Stage to extract or run
# For now, we leave the artifact in this stage.
