#!/usr/bin/env bash
set -Eeuo pipefail

UPSTREAM_NAME="${UPSTREAM_NAME:-upstream}"
UPSTREAM_URL="${UPSTREAM_URL:-https://github.com/decolua/9router.git}"
REMOTE_BRANCH="${REMOTE_BRANCH:-}"
AUTO_STASH=false
INSTALL_GLOBAL=false
PUSH_AFTER=false

usage() {
  cat <<EOF
Usage: ./update-core.sh [options]

Update this fork/custom branch with the latest core code from upstream 9router.

Options:
  --stash           Temporarily stash uncommitted changes before updating
  --install-global  Build CLI and install it globally after update
  --push            Push the updated current branch to origin after update
  -h, --help        Show this help

Environment overrides:
  UPSTREAM_NAME=upstream
  UPSTREAM_URL=https://github.com/decolua/9router.git
  REMOTE_BRANCH=main

Examples:
  ./update-core.sh
  ./update-core.sh --stash
  ./update-core.sh --install-global --push
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

while [ "$#" -gt 0 ]; do
  case "$1" in
    --stash)
      AUTO_STASH=true
      ;;
    --install-global)
      INSTALL_GLOBAL=true
      ;;
    --push)
      PUSH_AFTER=true
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage
      die "Unknown option: $1"
      ;;
  esac
  shift
done

need_cmd git

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

CURRENT_BRANCH="$(git branch --show-current)"
[ -n "$CURRENT_BRANCH" ] || die "Detached HEAD is not supported. Checkout your custom branch first."

if ! git remote get-url "$UPSTREAM_NAME" >/dev/null 2>&1; then
  log "Adding upstream remote: $UPSTREAM_URL"
  git remote add "$UPSTREAM_NAME" "$UPSTREAM_URL"
fi

if [ -z "$REMOTE_BRANCH" ]; then
  if git ls-remote --exit-code --heads "$UPSTREAM_NAME" main >/dev/null 2>&1; then
    REMOTE_BRANCH="main"
  elif git ls-remote --exit-code --heads "$UPSTREAM_NAME" master >/dev/null 2>&1; then
    REMOTE_BRANCH="master"
  else
    die "Cannot find upstream main or master branch. Set REMOTE_BRANCH manually."
  fi
fi

if [ -n "$(git status --porcelain)" ]; then
  if [ "$AUTO_STASH" = "true" ]; then
    log "Stashing uncommitted changes"
    git stash push -u -m "update-core auto-stash $(date -u +%Y%m%dT%H%M%SZ)"
    STASHED=true
  else
    die "Working tree is not clean. Commit your custom changes first, or run: ./update-core.sh --stash"
  fi
else
  STASHED=false
fi

log "Fetching latest core from $UPSTREAM_NAME/$REMOTE_BRANCH"
git fetch "$UPSTREAM_NAME" "$REMOTE_BRANCH"

log "Rebasing $CURRENT_BRANCH onto $UPSTREAM_NAME/$REMOTE_BRANCH"
if ! git rebase "$UPSTREAM_NAME/$REMOTE_BRANCH"; then
  warn "Rebase stopped because of conflicts."
  warn "Fix conflicts, then run: git add <files> && git rebase --continue"
  warn "To cancel this update, run: git rebase --abort"
  exit 1
fi

if [ "$STASHED" = "true" ]; then
  log "Restoring stashed changes"
  if ! git stash pop; then
    warn "Stash pop had conflicts. Resolve them manually, then commit the result."
    exit 1
  fi
fi

if [ "$INSTALL_GLOBAL" = "true" ]; then
  need_cmd npm
  log "Installing app dependencies"
  npm install

  log "Building CLI package"
  npm --prefix cli install
  npm --prefix cli run build

  log "Installing custom 9router globally"
  npm install -g ./cli
fi

if [ "$PUSH_AFTER" = "true" ]; then
  log "Pushing $CURRENT_BRANCH to origin"
  git push --force-with-lease origin "$CURRENT_BRANCH"
fi

log "Core update complete"
