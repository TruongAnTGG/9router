#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="${APP_NAME:-9router}"
IMAGE_NAME="${IMAGE_NAME:-9router:latest}"
PORT="${PORT:-20128}"
DATA_VOLUME="${DATA_VOLUME:-9router-data}"
ENV_FILE="${ENV_FILE:-.env}"
DOCKERFILE="${DOCKERFILE:-Dockerfile}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  cat <<EOF
Usage: ./run.sh <command> [options]

Commands:
  deploy       Build image and start/recreate the container
  update       Pull latest git changes, then deploy
  upgrade      Install npm dependencies, then deploy
  restart      Restart the container
  stop         Stop the container
  logs         Follow container logs
  status       Show container status
  reset        Remove container and data volume (requires --yes)
  ppt-deploy   Build and start/recreate PPT image service container
  ppt-restart  Restart PPT image service container
  ppt-stop     Stop PPT image service container
  ppt-logs     Follow PPT image service logs
  ppt-status   Show PPT image service status
  help         Show this help

Options:
  -y, --yes    Confirm destructive commands such as reset

Environment overrides:
  APP_NAME=9router
  IMAGE_NAME=9router:latest
  PORT=20128
  DATA_VOLUME=9router-data
  ENV_FILE=.env

PPT Image Service overrides:
  PPT_IMAGE_APP_NAME=9router-ppt-image-service
  PPT_IMAGE_IMAGE_NAME=9router-ppt-image-service:latest
  PPT_IMAGE_PORT=20228
  PPT_IMAGE_ENV_FILE=.env.ppt-image-service

Examples:
  ./run.sh deploy
  ./run.sh ppt-deploy
  ./run.sh update
  ./run.sh reset --yes
EOF
}

log() {
  printf '\033[1;34m==>\033[0m %s\n' "$*"
}

warn() {
  printf '\033[1;33mWARN:\033[0m %s\n' "$*" >&2
}

die() {
  printf '\033[1;31mERROR:\033[0m %s\n' "$*" >&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

container_exists() {
  docker inspect "$APP_NAME" >/dev/null 2>&1
}

container_running() {
  [ "$(docker inspect -f '{{.State.Running}}' "$APP_NAME" 2>/dev/null || true)" = "true" ]
}

env_args() {
  if [ -f "$ROOT_DIR/$ENV_FILE" ]; then
    printf '%s\n' "--env-file" "$ROOT_DIR/$ENV_FILE"
  else
    warn "Env file not found: $ENV_FILE. Starting without --env-file."
  fi
}

build_image() {
  need_cmd docker
  log "Building Docker image: $IMAGE_NAME"
  docker build -f "$ROOT_DIR/$DOCKERFILE" -t "$IMAGE_NAME" "$ROOT_DIR"
}

remove_container() {
  need_cmd docker
  if container_exists; then
    log "Removing existing container: $APP_NAME"
    docker rm -f "$APP_NAME" >/dev/null
  fi
}

start_container() {
  need_cmd docker
  local args=()

  while IFS= read -r arg; do
    args+=("$arg")
  done < <(env_args)

  log "Starting container: $APP_NAME on port $PORT"
  docker run -d \
    --name "$APP_NAME" \
    -p "$PORT:20128" \
    "${args[@]}" \
    -e DATA_DIR=/app/data \
    -v "$DATA_VOLUME:/app/data" \
    "$IMAGE_NAME"
}

deploy() {
  build_image
  remove_container
  start_container
  status
}

update() {
  need_cmd git
  log "Pulling latest git changes"
  git -C "$ROOT_DIR" pull --ff-only
  deploy
}

upgrade() {
  need_cmd npm
  log "Installing npm dependencies"
  npm --prefix "$ROOT_DIR" install
  deploy
}

restart() {
  need_cmd docker
  if container_exists; then
    log "Restarting container: $APP_NAME"
    docker restart "$APP_NAME"
  else
    warn "Container $APP_NAME does not exist. Deploying instead."
    deploy
  fi
}

stop_container() {
  need_cmd docker
  if container_running; then
    log "Stopping container: $APP_NAME"
    docker stop "$APP_NAME"
  else
    warn "Container $APP_NAME is not running."
  fi
}

logs() {
  need_cmd docker
  container_exists || die "Container $APP_NAME does not exist."
  docker logs -f "$APP_NAME"
}

status() {
  need_cmd docker
  docker ps -a --filter "name=^/${APP_NAME}$"
}

reset_all() {
  need_cmd docker
  if [ "${YES:-false}" != "true" ]; then
    die "reset removes container and Docker volume '$DATA_VOLUME'. Re-run with --yes to confirm."
  fi

  remove_container
  if docker volume inspect "$DATA_VOLUME" >/dev/null 2>&1; then
    log "Removing data volume: $DATA_VOLUME"
    docker volume rm "$DATA_VOLUME" >/dev/null
  else
    warn "Data volume $DATA_VOLUME does not exist."
  fi
}

run_ppt_image_service() {
  local ppt_command="$1"
  shift || true
  "$ROOT_DIR/services/ppt-image-service/run.sh" "$ppt_command" "$@"
}

main() {
  cd "$ROOT_DIR"

  local command="${1:-help}"
  shift || true

  YES="${YES:-false}"
  while [ "$#" -gt 0 ]; do
    case "$1" in
      -y|--yes)
        YES=true
        ;;
      *)
        die "Unknown option: $1"
        ;;
    esac
    shift
  done

  case "$command" in
    deploy) deploy ;;
    update) update ;;
    upgrade) upgrade ;;
    restart) restart ;;
    stop) stop_container ;;
    logs) logs ;;
    status) status ;;
    reset) reset_all ;;
    ppt-deploy) run_ppt_image_service deploy ;;
    ppt-restart) run_ppt_image_service restart ;;
    ppt-stop) run_ppt_image_service stop ;;
    ppt-logs) run_ppt_image_service logs ;;
    ppt-status) run_ppt_image_service status ;;
    help|-h|--help) usage ;;
    *) usage; die "Unknown command: $command" ;;
  esac
}

main "$@"
