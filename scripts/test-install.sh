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
echo "=== test 8: update.sh reports 'already up to date' on a fresh checkout ==="
UPD="$WORK/mirai-p/update.sh"
# `git clone` only sees committed files; the test runs before update.sh may be
# committed, so sync the working-tree updater into the checkout under test.
for f in update.sh update.cmd; do
  [ -f "$REPO/$f" ] && cp "$REPO/$f" "$WORK/mirai-p/$f"
done
chmod +x "$UPD" 2>/dev/null || true
if [ -f "$UPD" ]; then
  ( cd "$WORK/mirai-p" && ./update.sh --check --repo "file://$REPO" ) > "$WORK/update.log" 2>&1
  rc=$?
  [ "$rc" -eq 0 ] && pass "update --check exit 0" || { fail "update --check exit $rc"; tail -15 "$WORK/update.log"; }
  "$BIN_GREP" -q "already up to date" "$WORK/update.log" \
    && pass "update --check reported up to date" || fail "update --check did not report status"
else
  fail "update.sh missing from the checkout"
fi

echo
echo "=== test 9: update.sh applies a new upstream commit and keeps .env ==="
# Build a throwaway bare repo seeded from the installed checkout, then push a
# commit into it and confirm update.sh picks it up.
if [ -f "$UPD" ]; then
  BARE="$WORK/upstream.git"
  DEV="$WORK/upstream-dev"
  rm -rf "$BARE" "$DEV"
  git clone -q --bare "$WORK/mirai-p" "$BARE" 2>/dev/null
  git --git-dir="$BARE" symbolic-ref HEAD refs/heads/main 2>/dev/null
  # the installed checkout may be detached/shallow; make a real branch
  ( cd "$WORK/mirai-p" && git checkout -q -B main && git push -q --force "file://$BARE" main ) 2>/dev/null
  git clone -q "file://$BARE" "$DEV" 2>/dev/null
  echo "upstream marker $(date +%s)" >> "$DEV/CHANGELOG.md"
  ( cd "$DEV" && git -c user.email=t@t -c user.name=t commit -qam "test: upstream change" && git push -q origin HEAD:main ) 2>/dev/null
  ENV_BEFORE=$(cat "$WORK/mirai-p/.env")
  ( cd "$WORK/mirai-p" && ./update.sh --repo "file://$BARE" --no-build --no-restart --yes ) > "$WORK/update2.log" 2>&1
  rc=$?
  [ "$rc" -eq 0 ] && pass "update ran exit 0" || { fail "update exit $rc"; tail -20 "$WORK/update2.log"; }
  "$BIN_GREP" -q "Mirai updated" "$WORK/update2.log" && pass "update reported success" || fail "update success message missing"
  "$BIN_GREP" -q "upstream marker" "$WORK/mirai-p/CHANGELOG.md" \
    && pass "upstream commit was pulled in" || fail "upstream commit not applied"
  ENV_AFTER=$(cat "$WORK/mirai-p/.env")
  [ "$ENV_BEFORE" = "$ENV_AFTER" ] && pass "update left .env untouched" || fail "update modified .env"
else
  fail "update.sh missing - skipping update tests"
fi

echo
echo "=== test 10: update.sh refuses to clobber local changes ==="
if [ -f "$UPD" ]; then
  echo "local edit" >> "$WORK/mirai-p/CHANGELOG.md"
  ( cd "$WORK/mirai-p" && ./update.sh --repo "file://$WORK/upstream.git" --no-build --no-restart ) > "$WORK/update3.log" 2>&1
  rc=$?
  [ "$rc" -ne 0 ] && pass "dirty tree refused (exit $rc)" || fail "dirty tree was not refused"
  "$BIN_GREP" -qi "local changes" "$WORK/update3.log" && pass "dirty-tree message shown" || fail "dirty-tree message missing"
  ( cd "$WORK/mirai-p" && git checkout -q -- CHANGELOG.md ) 2>/dev/null
fi

echo
if [ "$FAIL" -eq 0 ]; then
  echo "ALL TESTS PASSED"
else
  echo "SOME TESTS FAILED"
fi
exit "$FAIL"
