#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
service_name="${BENEFIT_HQ_SERVICE:-benefit-hq.service}"
health_url="${BENEFIT_HQ_HEALTH_URL:-http://127.0.0.1:3030/login}"
skip_checks=0
restart_service=1
check_health=1
user_service=0
current_step="initialization"
restart_attempted=0
systemctl_command=()

usage() {
  cat <<'EOF'
Usage: scripts/deploy-release.sh [options]

Pull, verify, migrate, build, and restart a Benefit HQ production checkout.

Options:
  --service NAME       systemd service to restart (default: benefit-hq.service)
  --user-service       use systemctl --user instead of a system service
  --health-url URL     URL checked after restart (default: http://127.0.0.1:3030/login)
  --no-health-check    skip the post-restart HTTP health check
  --no-restart         update/build/migrate without restarting a service
  --skip-checks        skip tests, lint, and the standalone TypeScript check
  -h, --help           show this help

Environment equivalents:
  BENEFIT_HQ_SERVICE
  BENEFIT_HQ_HEALTH_URL
EOF
}

fail() {
  printf 'Deployment stopped: %s\n' "$1" >&2
  exit 1
}

run_step() {
  current_step="$1"
  shift
  printf '\n==> %s\n' "$current_step"
  "$@"
}

on_error() {
  local exit_code=$?
  printf '\nDeployment failed during: %s\n' "$current_step" >&2
  if [[ $restart_attempted -eq 1 && ${#systemctl_command[@]} -gt 0 ]]; then
    "${systemctl_command[@]}" --no-pager --full status "$service_name" >&2 || true
  fi
  printf 'The checkout remains at commit %s. Database migrations are forward-only and were not rolled back.\n' \
    "$(git -C "$repo_root" rev-parse --short=7 HEAD 2>/dev/null || printf 'unknown')" >&2
  exit "$exit_code"
}

trap on_error ERR

while [[ $# -gt 0 ]]; do
  case "$1" in
    --service)
      [[ $# -ge 2 ]] || fail "--service requires a value"
      service_name="$2"
      shift 2
      ;;
    --user-service)
      user_service=1
      shift
      ;;
    --health-url)
      [[ $# -ge 2 ]] || fail "--health-url requires a value"
      health_url="$2"
      shift 2
      ;;
    --no-health-check)
      check_health=0
      shift
      ;;
    --no-restart)
      restart_service=0
      check_health=0
      shift
      ;;
    --skip-checks)
      skip_checks=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "unknown option: $1"
      ;;
  esac
done

for required_command in git npm npx node; do
  command -v "$required_command" >/dev/null 2>&1 || fail "missing required command: $required_command"
done

if [[ $restart_service -eq 1 ]]; then
  case "$service_name" in
    your-service.service|your-service-name.service)
      fail "--service must be the real systemd unit name, not the documentation placeholder; omit --service to use benefit-hq.service"
      ;;
  esac

  command -v systemctl >/dev/null 2>&1 || fail "systemctl is unavailable; use --no-restart if another supervisor starts the app"

  if [[ $user_service -eq 1 ]]; then
    systemctl_command=(systemctl --user)
  elif [[ ${EUID:-$(id -u)} -eq 0 ]]; then
    systemctl_command=(systemctl)
  else
    command -v sudo >/dev/null 2>&1 || fail "sudo is required to restart the system service"
    systemctl_command=(sudo systemctl)
  fi

  service_load_state="$(
    "${systemctl_command[@]}" show "$service_name" --property=LoadState --value 2>/dev/null || true
  )"
  if [[ -z "$service_load_state" || "$service_load_state" == "not-found" ]]; then
    if [[ $user_service -eq 1 ]]; then
      fail "systemd unit $service_name was not found; check available names with: systemctl --user list-unit-files --type=service"
    fi
    fail "systemd unit $service_name was not found; create it with: ./scripts/install-systemd-service.sh"
  fi
fi

cd "$repo_root"

[[ -f package-lock.json ]] || fail "package-lock.json is missing"
[[ -f .env ]] || fail ".env is missing from $repo_root"
[[ -z "$(git status --porcelain)" ]] || \
  fail "working tree is dirty; commit, stash, or remove local changes before deploying"

if command -v flock >/dev/null 2>&1; then
  exec 9>"${TMPDIR:-/tmp}/benefit-hq-deploy-${UID}.lock"
  flock -n 9 || fail "another Benefit HQ deployment is already running"
fi

previous_commit="$(git rev-parse HEAD)"
run_step "Pulling the latest fast-forward GitHub release" git pull --ff-only
release_commit="$(git rev-parse HEAD)"

run_step "Installing the locked dependency set and regenerating Prisma" npm ci --include=dev
run_step "Regenerating Prisma Client explicitly" npx prisma generate

run_step "Validating production environment variables" node -e '
  require("dotenv").config({ quiet: true });
  const missing = ["DATABASE_URL", "AUTH_SECRET"].filter((key) => !process.env[key]);
  if (missing.length) {
    console.error(`Missing required environment variable(s): ${missing.join(", ")}`);
    process.exit(1);
  }
  if (!process.env.STORAGE_DIR) {
    console.warn("Warning: STORAGE_DIR is unset; production files will use ./storage.");
  }
'

if [[ $skip_checks -eq 0 ]]; then
  run_step "Running automated tests" npm test
  run_step "Running ESLint" npm run lint
  run_step "Running the standalone TypeScript check" npx tsc --noEmit --incremental false
fi

# Build before changing the database so a source or type failure cannot leave a
# migrated database waiting on an unusable application build.
run_step "Building the production Next.js release" npm run build
run_step "Applying pending Prisma migrations" npx prisma migrate deploy
run_step "Seeding chart definitions" npm run db:seed
run_step "Removing development-only packages" npm prune --omit=dev

if [[ $restart_service -eq 1 ]]; then
  restart_attempted=1
  run_step "Restarting $service_name" "${systemctl_command[@]}" restart "$service_name"
  run_step "Confirming $service_name is active" "${systemctl_command[@]}" is-active --quiet "$service_name"

  if [[ $check_health -eq 1 ]]; then
    command -v curl >/dev/null 2>&1 || fail "curl is required for the health check; use --no-health-check to skip it"
    current_step="Waiting for $health_url"
    printf '\n==> %s\n' "$current_step"
    healthy=0
    for attempt in {1..15}; do
      if curl --fail --silent --show-error --max-time 5 "$health_url" >/dev/null; then
        healthy=1
        break
      fi
      printf 'Health check attempt %s/15 failed; retrying in 2 seconds...\n' "$attempt"
      sleep 2
    done
    [[ $healthy -eq 1 ]] || fail "service is active but $health_url did not become healthy"
  fi
fi

printf '\nBenefit HQ deployment complete.\n'
printf 'Previous commit: %s\n' "${previous_commit:0:7}"
printf 'Running commit:  %s\n' "${release_commit:0:7}"
if [[ $restart_service -eq 1 ]]; then
  printf 'Service:         %s\n' "$service_name"
fi
