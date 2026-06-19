#!/usr/bin/env bash

set -euo pipefail

if [[ $# -ne 5 ]]; then
  echo "usage: $0 <project-name> <framework> <routing> <styling> <linting>" >&2
  exit 2
fi

project_name=$1
framework=$2
routing=$3
styling=$4
linting=$5

api_binary=${SCAFFOLDER_API_BINARY:-./scaf-api}
api_url=${SCAFFOLDER_API_URL:-http://127.0.0.1:8000}
work_dir=${RUNNER_TEMP:-/tmp}/scaffolder-generated/${project_name}
api_log=${RUNNER_TEMP:-/tmp}/scaffolder-api-${project_name}.log
archive_path="${work_dir}/${project_name}.zip"

mkdir -p "$work_dir"

cleanup() {
  status=$?
  if [[ -n "${api_pid:-}" ]]; then
    kill "$api_pid" 2>/dev/null || true
    wait "$api_pid" 2>/dev/null || true
  fi
  if [[ $status -ne 0 && -f "$api_log" ]]; then
    echo "Backend log:"
    cat "$api_log"
  fi
  exit "$status"
}
trap cleanup EXIT

"$api_binary" >"$api_log" 2>&1 &
api_pid=$!

api_ready=false
for _ in {1..30}; do
  if curl --fail --silent "$api_url/health" >/dev/null; then
    api_ready=true
    break
  fi
  if ! kill -0 "$api_pid" 2>/dev/null; then
    break
  fi
  sleep 1
done

if [[ "$api_ready" != true ]]; then
  echo "Backend did not become healthy" >&2
  exit 1
fi

curl --fail-with-body --silent --show-error \
  --request POST \
  --header "content-type: application/json" \
  --data "{
    \"project_name\": \"${project_name}\",
    \"framework\": \"${framework}\",
    \"styling\": \"${styling}\",
    \"linting\": \"${linting}\",
    \"state_management\": \"none\",
    \"routing\": \"${routing}\",
    \"dependencies\": [],
    \"dev_dependencies\": []
  }" \
  "$api_url/generate" \
  --output "$archive_path"

unzip -q "$archive_path" -d "$work_dir"
cd "${work_dir}/${project_name}"

npm install --no-audit --no-fund
npm run lint --if-present
npm run typecheck
npm run build
