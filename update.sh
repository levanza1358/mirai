#!/usr/bin/env bash
# Mirai updater for Linux / macOS.
#
# Usage:
#   cd ~/mirai && ./update.sh            # or: mirai update
#   curl -fsSL https://raw.githubusercontent.com/levanza1358/mirai/main/update.sh | bash -s -- --dir ~/mirai
#
# What it does, in order:
#   1. Finds the Mirai checkout (the directory holding this script, or --dir).
#   2. Records the current revision so a failure can be reported clearly.
#   3. Fetches the latest commit from GitHub and hard-resets to it.
#   4. Reinstalls npm dependencies (skipped when package.json is unchanged,
#      unless --force-install).
#   5. Rebuilds the production bundle (`npm run build`) — the standalone output
#      is what `mirai start` serves, so a rebuild is required after every pull.
#   6. Restarts a running Mirai so the new build takes effect.
#
# .env, your data dir (~/.mirai) and the database are never touched.
#
# Options:
#   --dir <path>      Checkout to update        (default: directory of this script)
#   --branch <ref>    Git branch/tag to follow  (default: main, or the current branch)
#   --repo <url>      Git remote URL
#   --check           Only report whether an update is available; change nothing
#   --no-restart      Do not restart Mirai after updating
#   --no-build        Skip the production build
#   --force-install   Always run `npm install`, even if package.json is unchanged
#   --yes, -y         Assume yes (non-interactive)
#   -h, --help        Show this help

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="${MIRAI_DIR:-$SCRIPT_DIR}"
REPO_URL="${MIRAI_REPO_URL:-}"
BRANCH="${MIRAI_BRANCH:-}"
CHECK_ONLY=0
DO_RESTART=1
DO_BUILD=1
FORCE_INSTALL=0
ASSUME_YES=0
PORT="${MIRAI_PORT:-1463}"

# ---------------------------------------------------------------- output helpers
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  C_RESET=$'\033[0m'; C_BOLD=$'\033[1m'; C_DIM=$'\033[2m'
  C_RED=$'\033[31m'; C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_BLUE=$'\033[36m'
else
  C_RESET=''; C_BOLD=''; C_DIM=''; C_RED=''; C_GREEN=''; C_YELLOW=''; C_BLUE=''
fi

step()  { printf '%s==>%s %s\n' "$C_BLUE" "$C_RESET" "$*"; }
ok()    { printf '%s  ok%s %s\n' "$C_GREEN" "$C_RESET" "$*"; }
warn()  { printf '%s  !%s  %s\n' "$C_YELLOW" "$C_RESET" "$*" >&2; }
die()   { printf '%s error:%s %s\n' "$C_RED" "$C_RESET" "$*" >&2; exit 1; }
have()  { command -v "$1" >/dev/null 2>&1; }

# ---------------------------------------------------------------- parse arguments
while [ $# -gt 0 ]; do
  case "$1" in
    --dir)            INSTALL_DIR="${2:?--dir needs a path}"; shift 2 ;;
    --branch)         BRANCH="${2:?--branch needs a name}"; shift 2 ;;
    --repo)           REPO_URL="${2:?--repo needs a url}"; shift 2 ;;
    --check)          CHECK_ONLY=1; shift ;;
    --no-restart)     DO_RESTART=0; shift ;;
    --no-build)       DO_BUILD=0; shift ;;
    --force-install)  FORCE_INSTALL=1; shift ;;
    --yes|-y)         ASSUME_YES=1; shift ;;
    -h|--help)        sed -n '2,29p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "unknown option: $1 (try --help)" ;;
  esac
done

case "$INSTALL_DIR" in
  "~")   INSTALL_DIR="$HOME" ;;
  "~/"*) INSTALL_DIR="$HOME/${INSTALL_DIR#\~/}" ;;
esac

printf '\n%s%s Mirai updater %s\n' "$C_BOLD" "$C_BLUE" "$C_RESET"
printf '%s  dir: %s%s\n\n' "$C_DIM" "$INSTALL_DIR" "$C_RESET"

# ---------------------------------------------------------------- 0. sanity
have git || die "git is required. Install it first (Debian/Ubuntu: sudo apt install -y git)."
[ -d "$INSTALL_DIR/.git" ] || \
  die "$INSTALL_DIR is not a git checkout. Install it first: curl -fsSL https://raw.githubusercontent.com/levanza1358/mirai/main/install.sh | bash"

cd "$INSTALL_DIR"

if [ -z "$REPO_URL" ]; then
  REPO_URL="$(git remote get-url origin 2>/dev/null || true)"
fi
[ -n "$REPO_URL" ] || die "no git remote 'origin' found - pass --repo <url>"
if [ -z "$BRANCH" ]; then
  BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)"
  [ "$BRANCH" = "HEAD" ] && BRANCH="main"
fi

# Refuse to update over uncommitted work — a hard reset would silently drop it.
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  if [ "$CHECK_ONLY" -eq 1 ]; then
    warn "local modifications present; they would be overwritten by an update"
  elif [ "$ASSUME_YES" -eq 1 ]; then
    warn "local modifications present - discarding them (--yes)"
  else
    die "you have local changes in $INSTALL_DIR. Commit/stash them, or re-run with --yes to discard."
  fi
fi

BEFORE_SHA="$(git rev-parse --short HEAD)"
BEFORE_REF="$(git rev-parse HEAD)"

# Track which remote to fetch from. When --repo is given (or MIRAI_REPO_URL is
# set) it may differ from the configured `origin`, so fetch by URL instead of by
# remote name — otherwise the flag would be silently ignored.
ORIGIN_URL="$(git remote get-url origin 2>/dev/null || true)"
if [ -n "$REPO_URL" ] && [ "$REPO_URL" != "$ORIGIN_URL" ]; then
  FETCH_FROM="$REPO_URL"
  step "Fetching $BRANCH from $REPO_URL"
else
  FETCH_FROM="origin"
  step "Fetching origin/$BRANCH"
fi
git fetch --prune "$FETCH_FROM" "$BRANCH" || die "git fetch failed - check your network / repo URL"
AFTER_REF="$(git rev-parse FETCH_HEAD)"
AFTER_SHA="$(git rev-parse --short FETCH_HEAD)"

if [ "$BEFORE_REF" = "$AFTER_REF" ]; then
  ok "already up to date ($BEFORE_SHA)"
  if [ "$CHECK_ONLY" -eq 0 ]; then
    printf '  %sNothing to do. Use --force-install to reinstall dependencies anyway.%s\n\n' "$C_DIM" "$C_RESET"
  fi
  exit 0
fi

printf '  %s%s -> %s%s\n' "$C_DIM" "$BEFORE_SHA" "$AFTER_SHA" "$C_RESET"
git --no-pager log --oneline --no-decorate "$BEFORE_REF..$AFTER_REF" 2>/dev/null | head -n 20 | sed 's/^/    /'

if [ "$CHECK_ONLY" -eq 1 ]; then
  printf '\n%sAn update is available.%s Run `mirai update` to install it.\n\n' "$C_BOLD" "$C_RESET"
  exit 0
fi

# ---------------------------------------------------------------- 1. update code
step "Updating to $AFTER_SHA"
git checkout -q "$BRANCH" 2>/dev/null || git checkout -q -B "$BRANCH" "$AFTER_REF"
git reset -q --hard "$AFTER_REF"
ok "checked out $AFTER_SHA"

have node || die "Node.js is required to build Mirai."
have npm  || die "npm is required to build Mirai."

# ---------------------------------------------------------------- 2. dependencies
PKG_CHANGED=0
if ! git diff --quiet "$BEFORE_REF" "$AFTER_REF" -- package.json package-lock.json cli/package.json 2>/dev/null; then
  PKG_CHANGED=1
fi

if [ "$FORCE_INSTALL" -eq 1 ] || [ "$PKG_CHANGED" -eq 1 ]; then
  step "Installing dependencies (npm install)"
  npm install --no-audit --no-fund
  ok "dependencies updated"
else
  ok "package.json unchanged - skipping npm install (use --force-install to override)"
fi

# ---------------------------------------------------------------- 3. build
if [ "$DO_BUILD" -eq 1 ]; then
  step "Building production bundle (npm run build)"
  # The default Node heap is too small for this build on modest machines.
  if [ -n "${NODE_OPTIONS:-}" ]; then
    npm run build
  else
    NODE_OPTIONS="--max-old-space-size=6144" npm run build
  fi
  ok "build finished"
else
  warn "skipped build (--no-build) - run it before restarting Mirai"
fi

chmod +x mirai 2>/dev/null || true

# ---------------------------------------------------------------- 4. restart
if [ "$DO_RESTART" -eq 1 ]; then
  RUNNING=0
  if have pgrep && pgrep -f "mirai" >/dev/null 2>&1; then
    RUNNING=1
  fi

  if [ "$RUNNING" -eq 1 ]; then
    step "Restarting Mirai on the new build"
    if [ -x "$INSTALL_DIR/mirai" ]; then
      # `mirai restart` re-execs the launcher detached, preserving tray/env.
      "$INSTALL_DIR/mirai" restart >/dev/null 2>&1 &
      sleep 2
      ok "restart requested - dashboard: http://localhost:$PORT"
    else
      warn "launcher ./mirai not executable - restart Mirai yourself"
    fi
  else
    ok "Mirai was not running - start it with: mirai start"
  fi
else
  warn "skipped restart (--no-restart) - restart Mirai for the new build to take effect"
fi

# ---------------------------------------------------------------- 5. summary
printf '\n%s%s Mirai updated %s\n' "$C_BOLD" "$C_GREEN" "$C_RESET"
printf '  location : %s\n' "$INSTALL_DIR"
printf '  revision : %s\n' "$AFTER_SHA"
printf '  dashboard: http://localhost:%s\n' "$PORT"
printf '\n  %sYour .env and data dir were left untouched.%s\n\n' "$C_DIM" "$C_RESET"
