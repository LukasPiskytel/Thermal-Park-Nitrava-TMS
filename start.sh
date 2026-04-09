#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

BACKEND_PORT="${BACKEND_PORT:-3001}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

BACKEND_PID_FILE="$BACKEND_DIR/deploy-backend.pid"
FRONTEND_PID_FILE="$FRONTEND_DIR/deploy-frontend.pid"
BACKEND_LOG_FILE="$BACKEND_DIR/deploy-backend.log"
FRONTEND_LOG_FILE="$FRONTEND_DIR/deploy-frontend.log"

info() {
  printf '[deploy] %s\n' "$*"
}

warn() {
  printf '[deploy][warn] %s\n' "$*" >&2
}

fail() {
  printf '[deploy][error] %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "Missing required command: $1"
  fi
}

detect_local_ip() {
  local ip=""

  if [[ "$(uname -s)" == "Darwin" ]]; then
    ip="$(ipconfig getifaddr en0 2>/dev/null || true)"

    if [[ -z "$ip" ]]; then
      ip="$(ipconfig getifaddr en1 2>/dev/null || true)"
    fi
  else
    ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  fi

  printf '%s' "$ip"
}

install_node_modules() {
  info "Installing backend dependencies..."
  (cd "$BACKEND_DIR" && npm install --omit=dev)

  info "Installing frontend dependencies..."
  (cd "$FRONTEND_DIR" && npm install)
}

stop_process_from_pid_file() {
  local pid_file="$1"
  local service_name="$2"

  if [[ ! -f "$pid_file" ]]; then
    return
  fi

  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"

  if [[ -z "$pid" ]]; then
    rm -f "$pid_file"
    return
  fi

  if kill -0 "$pid" 2>/dev/null; then
    info "Stopping $service_name (PID $pid)..."
    kill "$pid" 2>/dev/null || true

    for _ in {1..20}; do
      if ! kill -0 "$pid" 2>/dev/null; then
        break
      fi
      sleep 0.2
    done

    if kill -0 "$pid" 2>/dev/null; then
      warn "$service_name did not stop gracefully, forcing stop."
      kill -9 "$pid" 2>/dev/null || true
    fi
  fi

  rm -f "$pid_file"
}

wait_for_http() {
  local url="$1"
  local service_name="$2"

  for _ in {1..60}; do
    if curl -fsS "$url" >/dev/null 2>&1; then
      info "$service_name is ready: $url"
      return 0
    fi

    sleep 1
  done

  return 1
}

start_backend() {
  info "Starting backend on port $BACKEND_PORT..."
  (
    cd "$BACKEND_DIR"
    PORT="$BACKEND_PORT" nohup npm start >"$BACKEND_LOG_FILE" 2>&1 &
    echo $! >"$BACKEND_PID_FILE"
  )
}

start_frontend_preview() {
  info "Starting frontend preview on port $FRONTEND_PORT..."
  (
    cd "$FRONTEND_DIR"
    nohup npm run preview -- --host 0.0.0.0 --port "$FRONTEND_PORT" >"$FRONTEND_LOG_FILE" 2>&1 &
    echo $! >"$FRONTEND_PID_FILE"
  )
}

main() {
  require_cmd node
  require_cmd npm
  require_cmd curl

  local host_ip
  host_ip="${DEPLOY_HOST_IP:-$(detect_local_ip)}"

  if [[ -z "$host_ip" ]]; then
    warn "Could not auto-detect LAN IP, falling back to 127.0.0.1"
    host_ip="127.0.0.1"
  fi

  local api_base_url
  api_base_url="${VITE_API_BASE_URL:-http://$host_ip:$BACKEND_PORT/api/pools}"

  info "Deploy root: $ROOT_DIR"
  info "Using API base URL for frontend build: $api_base_url"

  stop_process_from_pid_file "$BACKEND_PID_FILE" "backend"
  stop_process_from_pid_file "$FRONTEND_PID_FILE" "frontend"

  install_node_modules

  info "Building frontend..."
  (
    cd "$FRONTEND_DIR"
    VITE_API_BASE_URL="$api_base_url" npm run build
  )

  start_backend

  if ! wait_for_http "http://127.0.0.1:$BACKEND_PORT/api/pools" "Backend"; then
    fail "Backend failed health check. See log: $BACKEND_LOG_FILE"
  fi

  start_frontend_preview

  if ! wait_for_http "http://127.0.0.1:$FRONTEND_PORT" "Frontend"; then
    fail "Frontend failed health check. See log: $FRONTEND_LOG_FILE"
  fi

  info "Deploy finished successfully."
  info "Frontend (local): http://localhost:$FRONTEND_PORT"
  info "Frontend (LAN):   http://$host_ip:$FRONTEND_PORT"
  info "Backend API:      http://$host_ip:$BACKEND_PORT/api/pools"
  info "Logs:"
  info "  - $BACKEND_LOG_FILE"
  info "  - $FRONTEND_LOG_FILE"
}

main "$@"
