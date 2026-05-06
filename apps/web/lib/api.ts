import axios from 'axios'
import { ProjectConfig } from '@/types/project-config'

// Типы для бэкенда
export interface MasterConfig {
  appName: string
  packageManager: string
  framework: string
  routing?: string
  styling?: string
  stateManager?: string
  linting?: 'eslint' | 'biome' | 'none'
  extraDependencies?: string[]
}

export interface BuildResponse {
  success: boolean
  error?: string
}

// URL агента (можно вынести в env переменные)
const AGENT_URL = 'http://127.0.0.1:8000'

/**
 * Маппинг значений фронтенда в значения бэкенда
 */
export function mapConfigToBackend(config: ProjectConfig): MasterConfig {
  // Маппинг framework
  const framework = config.framework

  // Маппинг routing
  let routing: string | undefined
  if (framework === 'react' && (config.routing === 'react-router' || config.routing === 'react-router-data')) {
    routing = 'react-router'
  } else if (framework === 'vue' && config.routing === 'vue-router') {
    routing = 'vue-router'
  } else if (framework === 'nextjs') {
    routing = config.routing
  }

  // Маппинг styling
  let styling: string | undefined
  if (config.styling === 'tailwind') {
    styling = 'tailwind'
  } else if (config.styling === 'css-modules') {
    styling = 'css-modules'
  } else if (config.styling === 'styled-components') {
    // styled-components не поддерживается бэкендом, используем css-modules
    styling = 'css-modules'
  }

  // Маппинг stateManager
  let stateManager: string | undefined
  if (config.stateManagement === 'redux') {
    stateManager = 'redux-toolkit'
  } else if (config.stateManagement === 'zustand') {
    stateManager = 'zustand'
  } else if (config.stateManagement === 'jotai') {
    // Jotai не поддерживается бэкендом
    stateManager = undefined
  }

  // Маппинг linting (только для Next.js)
  let linting: MasterConfig['linting'] | undefined
  if (framework === 'nextjs') {
    linting = config.linting
  }

  return {
    appName: config.projectName,
    packageManager: config.packageManager,
    framework,
    routing,
    styling,
    stateManager,
    linting,
    extraDependencies: config.dependencies,
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
    const response = await axios.post(`${AGENT_URL}/build`, backendConfig, {
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
