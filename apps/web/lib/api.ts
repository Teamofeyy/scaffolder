import axios from 'axios'
import {
  Framework,
  Linting,
  ProjectConfig,
  Routing,
  StateManagement,
  Styling,
  Testing,
} from '@/types/project-config'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/i18n/config'
import type { ProjectConfig as BackendProjectConfig } from '../../api/api/bindings/ProjectConfig'
import type { SupportStatus } from '../../api/api/bindings/SupportStatus'

type BackendPresetConfig = Omit<BackendProjectConfig, 'project_name'>
export type { SupportStatus }

export interface BuildResponse {
  success: boolean
  error?: string
}

export interface ProjectTreeNode {
  name: string
  type: 'file' | 'folder'
  children?: ProjectTreeNode[]
}

export interface FeatureResponse {
  name: string
  label: string
  description: string
  category: string
  requires: string[]
  conflicts: string[]
  support_status: SupportStatus
}

export interface ProjectPreset {
  id: string
  label: string
  description: string
  status: SupportStatus
  config: BackendPresetConfig
}

export interface VerifiedCombination {
  framework: string
  routing: string
  styling: string
  state_management?: string
  testing?: Testing
  generate: boolean
  install: boolean
  build: boolean
}

export interface VerificationMatrix {
  version: string
  verified_at: string
  combinations: VerifiedCombination[]
}

export interface PreviewFile {
  path: string
  language: string
  content: string
  truncated: boolean
}

export interface PreviewDetails {
  tree: ProjectTreeNode
  files: PreviewFile[]
  dependencies: string[]
  dev_dependencies: string[]
  commands: string[]
  support_status: SupportStatus
  verification: {
    matrix: string
    generate: boolean
    install: boolean
    build: boolean
  }
}

export interface DependencySearchResult {
  name: string
  version: string
  description?: string
}

export interface AiConfigPatch {
  framework?: Framework
  routing?: Routing
  styling?: Styling
  linting?: Linting
  state_management?: StateManagement
  testing?: Testing
  dependencies?: string[]
  dev_dependencies?: string[]
}

export interface AiRecommendationResponse {
  requestId: string
  message: string
  configPatch: AiConfigPatch
  warnings: string[]
}

export interface CapabilitiesResponse {
  aiRecommendations: boolean
}

// URL агента (можно вынести в env переменные)
const AGENT_URL = '/api'

/**
 * Маппинг значений фронтенда в значения бэкенда
 */
export function mapConfigToBackend(
  config: ProjectConfig,
): BackendProjectConfig {
  return {
    project_name: config.projectName,
    framework: config.framework,
    styling: config.styling,
    linting: config.linting,
    state_management: config.stateManagement,
    routing: config.routing,
    dependencies: config.dependencies,
    dev_dependencies: config.devDependencies,
    testing: config.testing,
  }
}

/**
 * Валидация конфигурации перед отправкой
 */
type ErrorDictionary = Dictionary['errors']

function formatMessage(
  template: string,
  values: Record<string, string | number>,
) {
  return Object.entries(values).reduce(
    (message, [key, value]) => message.replace(`{${key}}`, String(value)),
    template,
  )
}

export function validateConfig(
  config: ProjectConfig,
  errors: ErrorDictionary,
): { valid: boolean; error?: string } {
  if (!config.projectName || config.projectName.trim() === '') {
    return { valid: false, error: errors.projectNameRequired }
  }

  // Проверка формата названия проекта (должно быть валидным именем пакета)
  const nameRegex = /^[a-z0-9-_]+$/
  if (!nameRegex.test(config.projectName)) {
    return {
      valid: false,
      error: errors.projectNameInvalid,
    }
  }

  if (!config.framework) {
    return { valid: false, error: errors.frameworkRequired }
  }

  return { valid: true }
}

/**
 * Отправка запроса на сборку проекта
 * Возвращает Blob с ZIP архивом
 */
export async function buildProject(
  config: ProjectConfig,
  errors: ErrorDictionary,
): Promise<Blob> {
  // Валидация
  const validation = validateConfig(config, errors)
  if (!validation.valid) {
    throw new Error(validation.error || errors.validation)
  }

  // Маппинг конфигурации
  const backendConfig = mapConfigToBackend(config)

  try {
    const response = await axios.post(`${AGENT_URL}/generate`, backendConfig, {
      responseType: 'blob',
      timeout: 300000, // 5 минут таймаут для сборки
      validateStatus: (status) => status === 200, // Только 200 считается успехом
    })

    return response.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      // Обработка ошибок от сервера
      if (error.response) {
        // При responseType: 'blob' ошибки тоже приходят как Blob
        if (error.response.data instanceof Blob) {
          try {
            const text = await error.response.data.text()
            // Пытаемся распарсить как JSON (ошибки от сервера в формате JSON)
            const errorData = JSON.parse(text)
            throw new Error(errorData.error || errors.build)
          } catch {
            // Если не JSON, значит это неожиданный формат
            throw new Error(
              formatMessage(errors.server, {
                status: error.response.status,
                statusText: error.response.statusText,
              }),
            )
          }
        }

        // Если не Blob, пытаемся прочитать как JSON
        if (
          typeof error.response.data === 'object' &&
          error.response.data !== null
        ) {
          const errorData = error.response.data as { error?: string }
          throw new Error(errorData.error || errors.build)
        }

        throw new Error(
          formatMessage(errors.server, {
            status: error.response.status,
            statusText: error.response.statusText,
          }),
        )
      }

      // Обработка сетевых ошибок
      if (error.request) {
        throw new Error(errors.network)
      }

      throw new Error(error.message || errors.request)
    }
    throw error
  }
}

export async function previewProject(
  config: ProjectConfig,
): Promise<ProjectTreeNode> {
  const backendConfig = mapConfigToBackend({
    ...config,
    projectName: config.projectName.trim() || 'my-project',
  })

  const response = await axios.post(`${AGENT_URL}/preview`, backendConfig, {
    timeout: 30000,
  })

  return response.data
}

export async function previewProjectDetails(
  config: ProjectConfig,
): Promise<PreviewDetails> {
  const backendConfig = mapConfigToBackend({
    ...config,
    projectName: config.projectName.trim() || 'my-project',
  })

  const response = await axios.post(
    `${AGENT_URL}/preview/details`,
    backendConfig,
    {
      timeout: 30000,
    },
  )

  return response.data
}

export async function getFeatures(): Promise<FeatureResponse[]> {
  const response = await axios.get(`${AGENT_URL}/features`, {
    timeout: 5000,
  })

  return response.data
}

export async function getPresets(): Promise<ProjectPreset[]> {
  const response = await axios.get(`${AGENT_URL}/presets`, {
    timeout: 5000,
  })

  return response.data
}

export async function getVerificationMatrix(): Promise<VerificationMatrix> {
  const response = await axios.get(`${AGENT_URL}/verification-matrix`, {
    timeout: 5000,
  })

  return response.data
}

export async function searchDependencies(
  query: string,
): Promise<DependencySearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    limit: '10',
  })
  const response = await axios.get(
    `${AGENT_URL}/dependencies/search?${params.toString()}`,
    {
      timeout: 10000,
    },
  )

  return response.data
}

export async function getCapabilities(): Promise<CapabilitiesResponse> {
  const response = await axios.get(`${AGENT_URL}/capabilities`, {
    timeout: 5000,
  })

  return response.data
}

export async function recommendProjectConfig(
  message: string,
  sessionId: string,
  config: ProjectConfig,
  locale: Locale,
): Promise<AiRecommendationResponse> {
  const currentConfig = mapConfigToBackend({
    ...config,
    projectName: config.projectName.trim() || 'my-project',
  })

  const response = await axios.post(
    `${AGENT_URL}/ai/recommend`,
    {
      sessionId,
      message,
      locale,
      currentConfig,
    },
    {
      timeout: 35000,
    },
  )

  return response.data
}

/**
 * Скачивание файла в браузере
 */
export function downloadFile(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}
