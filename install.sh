#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${MIRAI_REPO_URL:-https://github.com/levanza1358/mirai.git}"
TARGET_DIR="${MIRAI_DIR:-$HOME/mirai}"

command -v git >/dev/null 2>&1 || { echo "Git required." >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Node.js 18+ required." >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm required." >&2; exit 1; }

if [ -e "$TARGET_DIR" ]; then
  echo "Target already exists: $TARGET_DIR"
  echo "Refusing to overwrite existing files. Remove it or set MIRAI_DIR."
  exit 1
fi

echo "Cloning Mirai into $TARGET_DIR..."
git clone "$REPO_URL" "$TARGET_DIR"
cd "$TARGET_DIR"

echo "Installing dependencies..."
npm install

if [ ! -f .env ] && [ -f .env.example ]; then
  cp .env.example .env
  echo "Created .env from .env.example. Review secrets before production use."
fi

echo "Installed: $TARGET_DIR"
echo "Start: cd \"$TARGET_DIR\" && npm run dev"
