#!/usr/bin/env bash
# Local integration test for install.sh.
# Usage: bash scripts/test-install.sh
# Requires: git, node, npm. Uses a local file:// clone so no network is needed.

set -u

REPO="$(cd "$(dirname "$0")/.." && pwd)"
WORK="${TMPDIR:-/tmp}/mirai-install-tests"
LOG="$WORK/install.log"
FAIL=0

BIN_LS=/usr/bin/ls
BIN_GREP=/usr/bin/grep
[ -x "$BIN_LS" ] || BIN_LS=ls
[ -x "$BIN_GREP" ] || BIN_GREP=grep

pass() { printf 'PASS  %s\n' "$1"; }
fail() { printf 'FAIL  %s\n' "$1"; FAIL=1; }

# Fresh install into <home> + <target>.
install_fresh() { # install_fresh <home> <target> [extra args...]
  local home="$1" target="$2"; shift 2
  rm -rf "$home" "$target"
  mkdir -p "$home"
  ( cd "$REPO" && HOME="$home" MIRAI_DIR="$target" ./install.sh --repo "file://$REPO" "$@" ) \
    > "$LOG" 2>&1
  echo $?
}

# Re-run against an existing checkout (no wipe) - this is the idempotency case.
install_again() { # install_again <home> <target> [extra args...]
  local home="$1" target="$2"; shift 2
  ( cd "$REPO" && HOME="$home" MIRAI_DIR="$target" ./install.sh --repo "file://$REPO" "$@" ) \
    > "$LOG" 2>&1
  echo $?
}

rm -rf "$WORK"
mkdir -p "$WORK"

echo "=== test 1: fresh install with PATH linking ==="
rc=$(install_fresh "$WORK/home1" "$WORK/mirai-p")
[ "$rc" -eq 0 ] && pass "installer exit 0" || { fail "installer exit $rc"; tail -25 "$LOG"; }

"$BIN_GREP" -qE 'ok (linked|installed launcher)' "$LOG" \
  && pass "launcher installation reported" || fail "launcher installation not reported"

LAUNCHER="$WORK/home1/.local/bin/mirai"
if [ -L "$LAUNCHER" ]; then
  pass "~/.local/bin/mirai is a symlink"
  tgt=$(readlink "$LAUNCHER")
  [ "$tgt" = "$WORK/mirai-p/mirai" ] && pass "symlink target correct" || fail "symlink target: $tgt"
elif [ -x "$LAUNCHER" ]; then
  pass "~/.local/bin/mirai is an executable wrapper (no symlink support)"
else
  fail "~/.local/bin/mirai missing"
fi

"$BIN_GREP" -q 'Mirai CLI' "$WORK/home1/.bashrc" 2>/dev/null \
  && pass "PATH export appended to .bashrc" || fail "PATH export missing"

[ -x "$WORK/mirai-p/mirai" ] && pass "launcher is executable" || fail "launcher not executable"
"$BIN_GREP" -qF "env file : $WORK/mirai-p/.env" "$LOG" \
  && pass "env path not duplicated in summary" || fail "env path wrong in summary"

echo
echo "=== test 2: generated .env has no placeholders ==="
"$BIN_GREP" -q 'change-me' "$WORK/mirai-p/.env" \
  && fail ".env still contains change-me" || pass "no change-me placeholders left"
"$BIN_GREP" -qE '^JWT_SECRET=[0-9a-f]{64}$' "$WORK/mirai-p/.env" \
  && pass "JWT_SECRET is 32 random bytes (64 hex)" || fail "JWT_SECRET malformed"
"$BIN_GREP" -q '^DATA_DIR=.*[\\/]\.mirai$' "$WORK/mirai-p/.env" \
  && pass "DATA_DIR points at a .mirai dir in the user home" || fail "DATA_DIR wrong: $("$BIN_GREP" '^DATA_DIR' "$WORK/mirai-p/.env")"
"$BIN_GREP" -q '^DATA_DIR=/var/lib/mirai$' "$WORK/mirai-p/.env" \
  && fail "DATA_DIR kept the container-only default /var/lib/mirai" || pass "container-only default replaced"

echo
echo "=== test 3: re-run preserves secrets and updates the checkout ==="
before=$(cat "$WORK/mirai-p/.env")
rc=$(install_again "$WORK/home1" "$WORK/mirai-p")
[ "$rc" -eq 0 ] && pass "re-run exit 0" || fail "re-run exit $rc"
after=$(cat "$WORK/mirai-p/.env")
[ "$before" = "$after" ] && pass "re-run left .env untouched" || fail "re-run modified .env"
"$BIN_GREP" -q 'kept existing JWT_SECRET' "$LOG" && pass "re-run reported 'kept existing'" || fail "re-run message missing"

echo
echo "=== test 4: the installed mirai command works ==="
out=$(HOME="$WORK/home1" "$LAUNCHER" --help 2>&1)
echo "$out" | "$BIN_GREP" -qiE 'start|stop|restart' \
  && pass "mirai --help lists commands" || { fail "mirai --help gave:"; echo "$out" | head -5; }

echo
echo "=== test 5: --no-path skips PATH setup ==="
rc=$(install_fresh "$WORK/home2" "$WORK/mirai-q" --no-path)
[ "$rc" -eq 0 ] && pass "--no-path exit 0" || fail "--no-path exit $rc"
[ -e "$WORK/home2/.local/bin/mirai" ] && fail "--no-path still linked" || pass "--no-path did not link"
"$BIN_GREP" -q 'skipped PATH setup' "$LOG" && pass "--no-path reported" || fail "--no-path message missing"

echo
echo "=== test 6: bad input is rejected ==="
rc=$(install_fresh "$WORK/home3" "$WORK/mirai-r" --bogus)
[ "$rc" -ne 0 ] && pass "unknown option exits non-zero" || fail "unknown option accepted"

echo
echo "=== test 7: refuses a non-empty non-git target ==="
mkdir -p "$WORK/occupied"
echo "keep me" > "$WORK/occupied/important.txt"
( cd "$REPO" && HOME="$WORK/home4" MIRAI_DIR="$WORK/occupied" ./install.sh --repo "file://$REPO" ) > "$LOG" 2>&1
rc=$?
[ "$rc" -ne 0 ] && pass "refused existing directory" || fail "overwrote existing directory"
[ -f "$WORK/occupied/important.txt" ] && pass "existing files untouched" || fail "existing files destroyed"

echo
if [ "$FAIL" -eq 0 ]; then
  echo "ALL TESTS PASSED"
else
  echo "SOME TESTS FAILED"
fi
exit "$FAIL"
