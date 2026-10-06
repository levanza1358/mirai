#!/usr/bin/env bash
# Mirai one-command installer for Linux / macOS.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/levanza1358/mirai/main/install.sh | bash
#
# What it does:
#   1. Verifies git / node / npm are available (and new enough).
#   2. Clones (or updates) the repository into $MIRAI_DIR (default: $HOME/mirai).
#   3. Installs npm dependencies.
#   4. Creates .env with real generated secrets (never overwrites an existing one).
#   5. Makes ./mirai executable and links it into your PATH so `mirai start` just works.
#   6. Optionally builds + smoke-tests the server (--build / --verify).
#
# Options:
#   --dir <path>     Install directory            (default: $HOME/mirai)
#   --port <n>       Port for the dashboard       (default: 1463)
#   --branch <ref>   Git branch/tag to install    (default: main)
#   --repo <url>     Git repository URL
#   --build          Run `npm run build` after install
#   --verify         Start server, check /api/health, stop it
#   --no-path        Do not install `mirai` into PATH
#   --force          Allow installing into a non-empty directory
#   -h, --help       Show this help

set -euo pipefail

REPO_URL="${MIRAI_REPO_URL:-https://github.com/levanza1358/mirai.git}"
BRANCH="${MIRAI_BRANCH:-main}"
INSTALL_DIR="${MIRAI_DIR:-$HOME/mirai}"
PORT="${MIRAI_PORT:-1463}"
DO_BUILD=0
DO_VERIFY=0
INSTALL_PATH=1
FORCE=0

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
    --dir)     INSTALL_DIR="${2:?--dir needs a path}"; shift 2 ;;
    --port)    PORT="${2:?--port needs a number}"; shift 2 ;;
    --branch)  BRANCH="${2:?--branch needs a name}"; shift 2 ;;
    --repo)    REPO_URL="${2:?--repo needs a url}"; shift 2 ;;
    --build)   DO_BUILD=1; shift ;;
    --verify)  DO_VERIFY=1; shift ;;
    --no-path) INSTALL_PATH=0; shift ;;
    --force)   FORCE=1; shift ;;
    -h|--help) sed -n '2,23p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "unknown option: $1 (try --help)" ;;
  esac
done

# Expand a leading ~ that survived quoting / piping.
case "$INSTALL_DIR" in
  "~")   INSTALL_DIR="$HOME" ;;
  "~/"*) INSTALL_DIR="$HOME/${INSTALL_DIR#\~/}" ;;
esac

printf '\n%s%s Mirai installer %s\n' "$C_BOLD" "$C_BLUE" "$C_RESET"
printf '%s  dir:   %s\n  repo:  %s\n  ref:   %s\n  port:  %s%s\n\n' \
  "$C_DIM" "$INSTALL_DIR" "$REPO_URL" "$BRANCH" "$PORT" "$C_RESET"

# ---------------------------------------------------------------- 1. dependencies
step "Checking prerequisites"

have git || die "git is required. Install it first (Debian/Ubuntu: sudo apt install -y git)."
have node || die "Node.js is required. Install Node.js 20+ (https://nodejs.org or nvm)."
have npm || die "npm is required. It normally ships with Node.js."

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "$NODE_MAJOR" -lt 20 ]; then
  die "Node.js $NODE_MAJOR detected, but >= 20 is required. Install a newer Node (nvm install 20)."
fi
ok "git $(git --version | awk '{print $3}')"
ok "node $(node -v) / npm $(npm -v)"

command -v lsof >/dev/null 2>&1 || \
  warn "lsof not found - 'mirai stop' / 'mirai restart' may be unable to free the port. Install: sudo apt install -y lsof"

# ---------------------------------------------------------------- 2. get sources
if [ -e "$INSTALL_DIR" ]; then
  if [ -d "$INSTALL_DIR/.git" ]; then
    step "Existing checkout found - updating $INSTALL_DIR"
    git -C "$INSTALL_DIR" fetch --depth 1 origin "$BRANCH"
    git -C "$INSTALL_DIR" checkout -q "$BRANCH" 2>/dev/null || \
      git -C "$INSTALL_DIR" checkout -q -B "$BRANCH" "origin/$BRANCH"
    git -C "$INSTALL_DIR" reset -q --hard "origin/$BRANCH"
    ok "updated to origin/$BRANCH"
  elif [ "$FORCE" -eq 1 ]; then
    warn "$INSTALL_DIR exists and is not a git checkout - continuing because of --force"
  else
    die "$INSTALL_DIR already exists and is not a Mirai checkout. Use --dir <other-path> or --force."
  fi
else
  step "Cloning Mirai into $INSTALL_DIR"
  mkdir -p "$(dirname -- "$INSTALL_DIR")"
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
  ok "cloned $BRANCH"
fi

cd "$INSTALL_DIR"

# ---------------------------------------------------------------- 3. dependencies
step "Installing dependencies (npm install)"
npm install --no-audit --no-fund
ok "dependencies installed"

# ---------------------------------------------------------------- 4. .env
step "Configuring .env"

rand_hex() {
  if have openssl; then
    openssl rand -hex "$1"
  else
    node -e "process.stdout.write(require('crypto').randomBytes($1).toString('hex'))"
  fi
}

upsert() { # upsert <file> <KEY> <VALUE>
  node -e '
    const fs = require("fs");
    const [file, key, value] = process.argv.slice(1);
    const re = new RegExp("^" + key + "=.*$", "m");
    let text = fs.readFileSync(file, "utf8");
    if (re.test(text)) text = text.replace(re, key + "=" + value);
    else text = text.replace(/\s*$/, "") + "\n" + key + "=" + value + "\n";
    fs.writeFileSync(file, text);
  ' "$1" "$2" "$3"
}

placeholder() { # placeholder <file> <KEY> -> true when key is missing or still "change-me"
  node -e '
    const fs = require("fs");
    const [file, key] = process.argv.slice(1);
    const text = fs.readFileSync(file, "utf8");
    const m = text.match(new RegExp("^" + key + "=(.*)$", "m"));
    if (!m) process.exit(0);
    const v = m[1].trim();
    process.exit(v === "" || v.startsWith("change-me") || v.startsWith("endpoint-proxy") ? 0 : 1);
  ' "$1" "$2"
}

ENV_FILE="$INSTALL_DIR/.env"
ENV_EXISTED=0
if [ -f "$ENV_FILE" ]; then
  ENV_EXISTED=1
  warn ".env already exists - keeping it (only filling in missing keys)"
elif [ -f .env.example ]; then
  cp .env.example "$ENV_FILE"
else
  : > "$ENV_FILE"
fi

# Install-local, correct-by-construction values (these are never "user secrets").
DATA_DIR_VALUE="${MIRAI_DATA_DIR:-$HOME/.mirai}"
mkdir -p "$DATA_DIR_VALUE"
upsert "$ENV_FILE" DATA_DIR "$DATA_DIR_VALUE"
upsert "$ENV_FILE" PORT "$PORT"
upsert "$ENV_FILE" NODE_ENV "production"
upsert "$ENV_FILE" BASE_URL "http://localhost:$PORT"
upsert "$ENV_FILE" NEXT_PUBLIC_BASE_URL "http://localhost:$PORT"

# Secrets: generate for a fresh file, and rotate only untouched placeholders otherwise.
rotate() { # rotate <KEY> <bytes>
  if [ "$ENV_EXISTED" -eq 0 ] || placeholder "$ENV_FILE" "$1"; then
    upsert "$ENV_FILE" "$1" "$(rand_hex "$2")"
    return 0
  fi
  return 1
}
rotate JWT_SECRET 32       && ok "generated JWT_SECRET"       || ok "kept existing JWT_SECRET"
rotate API_KEY_SECRET 24   && ok "generated API_KEY_SECRET"   || ok "kept existing API_KEY_SECRET"
rotate MACHINE_ID_SALT 16  && ok "generated MACHINE_ID_SALT"  || ok "kept existing MACHINE_ID_SALT"
rotate INITIAL_PASSWORD 8  && ok "generated INITIAL_PASSWORD" || ok "kept existing INITIAL_PASSWORD"

chmod 600 "$ENV_FILE" 2>/dev/null || true
ok ".env ready at $ENV_FILE"

# ---------------------------------------------------------------- 5. launcher
step "Preparing the mirai launcher"

[ -f mirai ] || die "launcher './mirai' missing from the checkout - the repo is incomplete."
chmod +x mirai
ok "./mirai is executable"

TARGET_DIR=""
if [ "$INSTALL_PATH" -eq 1 ]; then
  for candidate in "$HOME/.local/bin" "/usr/local/bin"; do
    if [ -d "$candidate" ] && [ -w "$candidate" ]; then TARGET_DIR="$candidate"; break; fi
    if [ "$candidate" = "$HOME/.local/bin" ] && [ ! -e "$candidate" ]; then
      mkdir -p "$candidate" 2>/dev/null && TARGET_DIR="$candidate" && break
    fi
  done
  if [ -z "$TARGET_DIR" ] && [ -w /usr/local/bin ]; then TARGET_DIR=/usr/local/bin; fi

  if [ -n "$TARGET_DIR" ]; then
    # Prefer a symlink; fall back to a tiny wrapper when symlinks are unavailable
    # (e.g. Windows without developer mode), so the command still finds cli/cli.js.
    rm -f "$TARGET_DIR/mirai"
    if ln -s "$INSTALL_DIR/mirai" "$TARGET_DIR/mirai" 2>/dev/null && [ -L "$TARGET_DIR/mirai" ]; then
      ok "linked $TARGET_DIR/mirai -> $INSTALL_DIR/mirai"
    else
      {
        printf '#!/bin/sh\n'
        printf '# Mirai launcher wrapper generated by install.sh\n'
        printf 'exec node "%s/cli/cli.js" "$@"\n' "$INSTALL_DIR"
      } > "$TARGET_DIR/mirai"
      chmod +x "$TARGET_DIR/mirai" 2>/dev/null || true
      ok "installed launcher wrapper at $TARGET_DIR/mirai"
    fi

    case ":$PATH:" in
      *":$TARGET_DIR:"*)
        ok "$TARGET_DIR is already in PATH" ;;
      *)
        SHELL_RC=""
        case "${SHELL:-}" in
          */zsh)  SHELL_RC="$HOME/.zshrc" ;;
          */bash) SHELL_RC="$HOME/.bashrc" ;;
          *)      [ -f "$HOME/.profile" ] && SHELL_RC="$HOME/.profile" ;;
        esac
        if [ -n "$SHELL_RC" ] && ! grep -qs "Mirai CLI" "$SHELL_RC"; then
          printf '\n# Mirai CLI\nexport PATH="%s:$PATH"\n' "$TARGET_DIR" >> "$SHELL_RC"
          ok "added $TARGET_DIR to PATH in $SHELL_RC"
        else
          warn "add this to your shell rc yourself: export PATH=\"$TARGET_DIR:\$PATH\""
        fi
        ;;
    esac
  else
    warn "no writable PATH directory found - skipping the global 'mirai' command"
    warn "run it directly instead: cd $INSTALL_DIR && ./mirai start"
  fi
else
  ok "skipped PATH setup (--no-path)"
fi

# ---------------------------------------------------------------- 6. build / verify
if [ "$DO_BUILD" -eq 1 ]; then
  step "Building production bundle (npm run build)"
  npm run build
  ok "build finished"
fi

if [ "$DO_VERIFY" -eq 1 ]; then
  step "Smoke test on port $PORT"
  VERIFY_LOG="${TMPDIR:-/tmp}/mirai-verify.log"
  npm run dev >"$VERIFY_LOG" 2>&1 &
  VERIFY_PID=$!
  VERIFY_OK=0
  for _ in $(seq 1 60); do
    sleep 1
    if have curl && curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
      VERIFY_OK=1; break
    fi
  done
  pkill -P "$VERIFY_PID" 2>/dev/null || true
  kill "$VERIFY_PID" 2>/dev/null || true
  wait "$VERIFY_PID" 2>/dev/null || true
  if [ "$VERIFY_OK" -eq 1 ]; then
    ok "/api/health responded - the server starts correctly"
  else
    warn "server was not healthy within 60s - see $VERIFY_LOG"
  fi
fi

# ---------------------------------------------------------------- 7. summary
printf '\n%s%s Mirai installed%s\n' "$C_BOLD" "$C_GREEN" "$C_RESET"
printf '  location : %s\n' "$INSTALL_DIR"
printf '  launcher : %s/mirai\n' "$INSTALL_DIR"
printf '  env file : %s\n' "$ENV_FILE"
printf '  data dir : %s\n' "$DATA_DIR_VALUE"
printf '  dashboard: http://localhost:%s\n' "$PORT"

if [ -n "$TARGET_DIR" ]; then
  printf '\n  Start it from anywhere:\n    %smirai start%s\n' "$C_BOLD" "$C_RESET"
  printf '  %sNew shell needed once (or: source ~/.bashrc)%s\n' "$C_DIM" "$C_RESET"
else
  printf '\n  Start it:\n    %scd %s && ./mirai start%s\n' "$C_BOLD" "$INSTALL_DIR" "$C_RESET"
fi

printf '\n  %sPassword for the dashboard is in .env -> INITIAL_PASSWORD%s\n' "$C_DIM" "$C_RESET"
printf '  %sOn a headless server the launcher starts the router in the background automatically.%s\n' "$C_DIM" "$C_RESET"
printf '  %smirai stop  |  mirai restart  |  mirai status%s\n\n' "$C_DIM" "$C_RESET"
