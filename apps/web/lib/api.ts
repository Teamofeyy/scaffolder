import axios from 'axios'
import {
  Framework,
  Linting,
  PackageManager,
  ProjectConfig,
  Routing,
  StateManagement,
  Styling,
} from '@/types/project-config'

export interface BackendProjectConfig {
  project_name: string
  framework: string
  package_manager: string
  styling: string
  linting?: 'eslint' | 'biome' | 'none'
  state_management: string
  routing: string
  dependencies: string[]
  dev_dependencies: string[]
}

export interface BuildResponse {
  success: boolean
  error?: string
}

export interface ProjectTreeNode {
  name: string
  type: 'file' | 'folder'
  children?: ProjectTreeNode[]
}

export interface DependencySearchResult {
  name: string
  version: string
  description?: string
}

export interface AiConfigPatch {
  framework?: Framework
  package_manager?: PackageManager
  routing?: Routing
  styling?: Styling
  linting?: Linting
  state_management?: StateManagement
  dependencies?: string[]
  dev_dependencies?: string[]
}

export interface AiRecommendationResponse {
  requestId: string
  message: string
  configPatch: AiConfigPatch
  warnings: string[]
}

// URL агента (можно вынести в env переменные)
const AGENT_URL = '/api'

/**
 * Маппинг значений фронтенда в значения бэкенда
 */
export function mapConfigToBackend(config: ProjectConfig): BackendProjectConfig {
  return {
    project_name: config.projectName,
    framework: config.framework,
    package_manager: config.packageManager,
    styling: config.styling,
    linting: config.linting,
    state_management: config.stateManagement,
    routing: config.routing,
    dependencies: config.dependencies,
    dev_dependencies: config.devDependencies,
  }
}

/**
 * Валидация конфигурации перед отправкой
 */
export function validateConfig(config: ProjectConfig): { valid: boolean; error?: string } {
  if (!config.projectName || config.projectName.trim() === '') {
    return { valid: false, error: 'Название проекта обязательно' }
  }

  // Проверка формата названия проекта (должно быть валидным именем пакета)
  const nameRegex = /^[a-z0-9-_]+$/
  if (!nameRegex.test(config.projectName)) {
    return {
      valid: false,
      error: 'Название проекта может содержать только строчные буквы, цифры, дефисы и подчеркивания',
    }
  }

  if (!config.framework) {
    return { valid: false, error: 'Фреймворк обязателен' }
  }

  if (!config.packageManager) {
    return { valid: false, error: 'Менеджер пакетов обязателен' }
  }

  return { valid: true }
}

/**
 * Отправка запроса на сборку проекта
 * Возвращает Blob с ZIP архивом
 */
export async function buildProject(config: ProjectConfig): Promise<Blob> {
  // Валидация
  const validation = validateConfig(config)
  if (!validation.valid) {
    throw new Error(validation.error || 'Ошибка валидации')
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
            throw new Error(errorData.error || 'Ошибка при сборке проекта')
          } catch {
            // Если не JSON, значит это неожиданный формат
            throw new Error(`Ошибка сервера: ${error.response.status} ${error.response.statusText}`)
          }
        }

        // Если не Blob, пытаемся прочитать как JSON
        if (typeof error.response.data === 'object' && error.response.data !== null) {
          const errorData = error.response.data as { error?: string }
          throw new Error(errorData.error || 'Ошибка при сборке проекта')
        }

        throw new Error(`Ошибка сервера: ${error.response.status} ${error.response.statusText}`)
      }

      // Обработка сетевых ошибок
      if (error.request) {
        throw new Error('Не удалось подключиться к серверу. Убедитесь, что агент запущен.')
      }

      throw new Error(error.message || 'Ошибка при отправке запроса')
    }
    throw error
  }
}

export async function previewProject(config: ProjectConfig): Promise<ProjectTreeNode> {
  const validation = validateConfig(config)
  const backendConfig = mapConfigToBackend({
    ...config,
    projectName: validation.valid ? config.projectName : 'my-project',
  })

  const response = await axios.post(`${AGENT_URL}/preview`, backendConfig, {
    timeout: 30000,
  })

  return response.data
}

export async function searchDependencies(query: string): Promise<DependencySearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    limit: '10',
  })
  const response = await axios.get(`${AGENT_URL}/dependencies/search?${params.toString()}`, {
    timeout: 10000,
  })

  return response.data
}

export async function recommendProjectConfig(
  message: string,
  sessionId: string,
  config: ProjectConfig,
): Promise<AiRecommendationResponse> {
  const currentConfig = mapConfigToBackend({
    ...config,
    projectName: config.projectName.trim() || 'my-project',
  })

  const response = await axios.post(`${AGENT_URL}/ai/recommend`, {
    sessionId,
    message,
    currentConfig,
  }, {
    timeout: 35000,
  })

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
