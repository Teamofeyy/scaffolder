const DEFAULT_BASE_URL = 'http://127.0.0.1:8000'

const baseUrl = process.env.LOAD_TEST_BASE_URL ?? DEFAULT_BASE_URL
const concurrency = Number(process.env.LOAD_TEST_CONCURRENCY ?? 8)
const requests = Number(process.env.LOAD_TEST_REQUESTS ?? 40)
const endpoint = process.env.LOAD_TEST_ENDPOINT ?? 'generate'
const maxP95Ms = Number(process.env.LOAD_TEST_MAX_P95_MS ?? 15_000)
const maxErrorRate = Number(process.env.LOAD_TEST_MAX_ERROR_RATE ?? 0)

const config = {
  project_name: 'load-test-app',
  framework: 'react',
  package_manager: 'npm',
  styling: 'tailwind',
  linting: 'eslint',
  state_management: 'none',
  routing: 'react-router',
  dependencies: ['zod@^4.2.0'],
  dev_dependencies: ['vitest@^4.0.0'],
}

function percentile(values, p) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))]
}

async function postJson(path) {
  const startedAt = performance.now()
  const response = await fetch(`${baseUrl}/${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(config),
  })
  const bytes = await response.arrayBuffer()
  const durationMs = performance.now() - startedAt

  return {
    ok: response.ok,
    status: response.status,
    durationMs,
    bytes: bytes.byteLength,
  }
}

async function worker(state, results) {
  while (state.next < requests) {
    const index = state.next
    state.next += 1

    try {
      results[index] = await postJson(endpoint)
    } catch (error) {
      results[index] = {
        ok: false,
        status: 0,
        durationMs: 0,
        bytes: 0,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
}

const state = { next: 0 }
const results = new Array(requests)
const startedAt = performance.now()

await Promise.all(
  Array.from({ length: concurrency }, () => worker(state, results)),
)

const totalMs = performance.now() - startedAt
const durations = results.filter((result) => result.ok).map((result) => result.durationMs)
const failed = results.filter((result) => !result.ok)
const errorRate = failed.length / requests
const p95 = percentile(durations, 95)
const min = durations.length > 0 ? Math.min(...durations) : 0
const max = durations.length > 0 ? Math.max(...durations) : 0
const statusCounts = results.reduce((acc, result) => {
  const key = String(result.status)
  acc[key] = (acc[key] ?? 0) + 1
  return acc
}, {})

console.log(JSON.stringify({
  baseUrl,
  endpoint,
  requests,
  concurrency,
  thresholds: {
    maxP95Ms,
    maxErrorRate,
  },
  totalMs: Math.round(totalMs),
  requestsPerSecond: Number((requests / (totalMs / 1000)).toFixed(2)),
  statusCounts,
  success: requests - failed.length,
  failed: failed.length,
  errorRate: Number(errorRate.toFixed(4)),
  latencyMs: {
    min: Math.round(min),
    p50: Math.round(percentile(durations, 50)),
    p95: Math.round(p95),
    max: Math.round(max),
  },
  failedSamples: failed.slice(0, 3),
}, null, 2))

if (errorRate > maxErrorRate || p95 > maxP95Ms) {
  process.exitCode = 1
}
