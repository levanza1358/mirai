# Docker

Run Mirai in a container. Published image: [`decolua/mirai`](https://hub.docker.com/r/decolua/mirai) â€” multi-platform `linux/amd64` + `linux/arm64`.

---

# ðŸ‘¤ For Users

## Quick start

```bash
docker run -d \
  -p 1463:1463 \
  -v "$HOME/.mirai:/app/data" \
  -e DATA_DIR=/app/data \
  --name mirai \
  decolua/mirai:latest
```

App listens on port `1463`. Open: http://localhost:1463

## Manage container

```bash
docker logs -f mirai        # view logs
docker stop mirai           # stop
docker start mirai          # start again
docker rm -f mirai          # remove
```

## Data persistence

```bash
-v "$HOME/.mirai:/app/data" \
-e DATA_DIR=/app/data
```

Without `DATA_DIR`, the app falls back to `~/.mirai/` (macOS/Linux) or `%APPDATA%\mirai\` (Windows). In the container, `DATA_DIR=/app/data` makes the bind mount work.

Data layout under `$DATA_DIR/`:

```text
$DATA_DIR/
├── config/
│   └── port.json         # saved server port (when changed from Settings)
├── db/
│   ├── data.sqlite       # main SQLite database
│   └── backups/          # auto backups
└── ...                   # certs, logs, runtime configs
```

Host path: `$HOME/.mirai/db/data.sqlite`
Container path: `/app/data/db/data.sqlite`

> **Changing the port in Docker:** the container listens on whatever `PORT` is set to. If you change the port from the dashboard in a container, also update the published port (`docker run -p <new>:<new>`) and restart the container - the in-process restart targets a host install, not a container.


## Optional env vars

```bash
docker run -d \
  -p 1463:1463 \
  -v "$HOME/.mirai:/app/data" \
  -e DATA_DIR=/app/data \
  -e PORT=1463 \
  -e HOSTNAME=0.0.0.0 \
  -e DEBUG=true \
  --name mirai \
  decolua/mirai:latest
```

## Optional Headroom sidecar

The Mirai image does not bundle Python or Headroom. To use Headroom in Docker, run it as a separate service and point Mirai at that proxy:

```yaml
services:
  mirai:
    image: decolua/mirai:latest
    ports:
      - "1463:1463"
    volumes:
      - "$HOME/.mirai:/app/data"
    environment:
      DATA_DIR: /app/data
      HEADROOM_URL: http://headroom:8787
    depends_on:
      - headroom

  headroom:
    image: ghcr.io/chopratejas/headroom:latest
    ports:
      - "8787:8787"
```

In the dashboard, open `Endpoint` â†’ `Token Saver` â†’ `Headroom`, confirm the URL is `http://headroom:8787`, recheck status, then enable Headroom.

If Headroom runs on the Docker host instead of as a sidecar, use `http://host.docker.internal:8787` on macOS/Windows. On Linux, add `--add-host=host.docker.internal:host-gateway` or the equivalent compose `extra_hosts` entry.

## Update to latest

```bash
docker pull decolua/mirai:latest
docker rm -f mirai
# re-run the quick start command
```

To pin a specific version instead of following `latest`, use a numbered image tag:

```bash
docker pull decolua/mirai:0.5.81
```

---

# ðŸ›  For Developers

## Build image locally (test)

```bash
docker build -t mirai .

docker run --rm -p 1463:1463 \
  -v "$HOME/.mirai:/app/data" \
  -e DATA_DIR=/app/data \
  mirai
```

The Dockerfile uses the official Alpine and npm registries by default. Regional mirrors can be supplied when needed:

```bash
docker build \
  --build-arg ALPINE_MIRROR=mirrors.aliyun.com \
  --build-arg NPM_REGISTRY=https://registry.npmmirror.com/ \
  -t mirai .
```

## Publish (automatic via CI)

Push a Docker-safe semver git tag `vX.Y.Z` (or a prerelease such as `vX.Y.Z-rc.1`) â†’ GitHub Actions builds `linux/amd64` and `linux/arm64` on native runners, health-checks each platform image, verifies the resulting manifest and `/api/health`, then publishes:

- `ghcr.io/decolua/mirai:X.Y.Z` + `:latest`
- `decolua/mirai:X.Y.Z` + `:latest`

The `v` prefix is used only for the git tag; image tags omit it. A stable tag push promotes `latest`, but a prerelease tag such as `vX.Y.Z-rc.1` publishes only its numbered image by default. Prereleases require an explicit manual `promote_latest` opt-in. Promotion happens only after both native platform builds, both platform health checks, manifest inspection, and the resolved-manifest smoke test succeed. A failed or timed-out platform build therefore cannot move `latest`.

The workflow rejects SemVer build metadata such as `v1.2.3+build.7` because the `+` form is not a valid Docker image tag. The git tag and both `package.json` versions must match exactly.

```bash
# Use scripts/release.js (recommended)
node scripts/release.js "Release title" "Notes"

# Or manually
git tag v0.5.81 && git push origin v0.5.81
```

To republish an existing tag, run the `Build and Push Docker Image` workflow manually and provide the exact tag, for example `v0.5.81`, in the `release_tag` input. Manual runs publish the numbered tag but leave `latest` unchanged by default:

```text
release_tag:     v0.5.81
promote_latest:  false
```

The `promote_latest` checkbox is an explicit opt-in for changing `latest`. Use it when a deliberate rollback or recovery should make that version the current default:

```text
release_tag:     v0.5.75
promote_latest:  true
```

Numbered image tags are mutable because a republish can replace their manifest. For a deployment that must be immutable, pin the image digest instead:

```bash
docker pull decolua/mirai@sha256:<verified-digest>
```

The release workflow runs `/api/health` on each native `amd64` and `arm64` platform image before it uploads the digest artifact or assembles the multi-platform manifest. It then runs a second health check against the resolved version manifest before any requested `latest` promotion.

During recovery, the selected tag remains the application source while the Dockerfile from the workflow revision is used, so an older tag can be rebuilt with the current publishing fixes.

The workflow is tag-driven. Creating a git tag does not automatically create a GitHub Release, so the Releases page and the published package/image tags can be at different versions unless a maintainer creates a release separately.

The upstream repository needs these repository secrets for Docker Hub publishing:

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`

GHCR publishing uses the workflow's `GITHUB_TOKEN` with package write permission. Forks can publish to their own GHCR namespace, but Docker Hub publication is restricted to the upstream `decolua/mirai` repository.

The optional repository variables `ALPINE_MIRROR` and `NPM_REGISTRY` can override the default package mirrors used by the CI Docker build.

Workflow: `.github/workflows/docker-publish.yml`
