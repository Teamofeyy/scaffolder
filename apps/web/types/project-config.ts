export type Framework = "nextjs" | "react" | "vue"
export type Routing =
  | "app-router"
  | "pages-router"
  | "react-router"
  | "react-router-data"
  | "vue-router"
  | "none"

export type Styling = "tailwind" | "css-modules" | "styled-components"
export type Linting = "eslint" | "biome" | "none"
export type StateManagement = "none" | "zustand" | "redux" | "jotai"
export type PackageManager = "npm" | "pnpm" | "yarn" | "bun"

export interface ProjectConfig {
  projectName: string
  framework: Framework
  packageManager: PackageManager
  typescript: boolean
  styling: Styling
  linting: Linting
  stateManagement: StateManagement
  routing: Routing
  dependencies: string[]
}

/* ---------------------------------------------------
   FILE SYSTEM TYPES (исправлено и строго типизировано)
---------------------------------------------------- */

export type FileType = "file" | "folder"

export interface FileBase {
  name: string
  type: FileType
}

export interface FileFile extends FileBase {
  type: "file"
  children?: undefined
}

export interface FileFolder extends FileBase {
  type: "folder"
  children: FileNode[]
}

export type FileNode = FileFile | FileFolder

// Структура проекта — это просто корневой FileNode
export type FileStructure = FileNode

// --------------------------------------
// Helpers
// --------------------------------------
export const file = (name: string): FileFile => ({ name, type: "file" })
export const folder = (name: string, children: FileNode[] = []): FileFolder => ({
  name,
  type: "folder",
  children,
})

/* ---------------------------------------------------
   COMPONENT PROPS
---------------------------------------------------- */

export type ConfigKey = keyof ProjectConfig
export type ConfigValue = ProjectConfig[ConfigKey]

export interface ConfigurationPanelProps {
  config: ProjectConfig
  setConfig: (config: ProjectConfig) => void
}

export interface PreviewPanelProps {
  config: ProjectConfig
}

export interface GenerateButtonProps {
  config: ProjectConfig
}

// --------------------------------------
// POPULAR DEPENDENCIES (for all frameworks)
// --------------------------------------

export interface DependencyOption {
  id: string
  label: string
  description?: string
  dev?: boolean
}

export const popularDependencies: DependencyOption[] = [
  { id: "axios", label: "axios", description: "HTTP client for browsers and Node.js" },
  { id: "zod", label: "zod", description: "Type-safe schema validation" },
  { id: "date-fns", label: "date-fns", description: "Modern date utility library" },
  { id: "lodash", label: "lodash", description: "Utility library for arrays, objects and more" },
  { id: "clsx", label: "clsx", description: "Tiny utility for constructing className strings" },
  { id: "zustand", label: "zustand", description: "Small, fast state-management solution" },
  { id: "jotai", label: "jotai", description: "Primitive and flexible state management for React" },
  { id: "framer-motion", label: "framer-motion", description: "Production-ready animation library for React" },
  { id: "react-hook-form", label: "react-hook-form", description: "React hooks for forms validation" },
  { id: "bcrypt", label: "bcrypt", description: "Library to hash passwords" },
  { id: "jsonwebtoken", label: "jsonwebtoken", description: "JWT implementation for auth" },
  { id: "uuid", label: "uuid", description: "Generate RFC4122 UUIDs" },
  { id: "dotenv", label: "dotenv", description: "Loads environment variables from .env file" },
  { id: "cors", label: "cors", description: "Express middleware for enabling CORS" },
]

// --------------------------------------
// FRAMEWORK BLOCKS — корректная вложенность
// --------------------------------------
export const frameworkBlocks = {
  react: () => [
    folder("public", [file("vite.svg")]),

    folder("src", [
      folder("assets", [file("react.svg")]),
      file("App.css"),
      file("App.tsx"),
      file("index.css"),
      file("main.tsx"),
    ]),

    file("vite.config.ts"),
    file("index.html"),
  ],

  vue: () => [
    folder("public", []),

    folder("src", [
      folder("assets", []),
      file("main.ts"),
      file("App.vue"),
      file("style.css"),
    ]),

    file("vite.config.ts"),
    file("index.html"),
  ],

  nextjs: () => [
    folder("public", []),

    // Next.js всегда на верхнем уровне, НЕ в src
    folder("app", [
      file("layout.tsx"),
      file("page.tsx"),
    ]),

    file("next.config.js"),
  ],
}

// --------------------------------------
// ROUTING BLOCKS — исправлено, без "src/routes"
// --------------------------------------
export const routingBlocks = {
  // --- React Router ---
  "react-router": () => [
    folder("src", [
      folder("routes", [file("index.tsx")]),
      folder("pages", [file("Home.tsx"), file("About.tsx")]),
    ]),
  ],

  "react-router-data": () => [
    folder("src", [
      folder("routes", [
        file("loader.ts"),
        file("index.tsx"),
      ]),
      folder("pages", [file("Home.tsx"), file("About.tsx")]),
    ]),
  ],

  none: () => [],

  // --- Next.js App Router ---
  "app-router": () => [
    folder("app", [
      file("page.tsx"),
      folder("about", [file("page.tsx")]),
    ]),
  ],

  // --- Next.js Pages Router ---
  "pages-router": () => [
    folder("pages", [
      file("index.tsx"),
      file("about.tsx"),
    ]),
  ],

  // --- Vue ---
  "vue-router": () => [
    folder("src", [
      folder("router", [file("index.ts")]),
      folder("pages", [file("Home.vue"), file("About.vue")]),
    ]),
  ],
}

// --------------------------------------
// STYLING BLOCKS
// --------------------------------------
export const stylingBlocks = {
  tailwind: () => [],
  "css-modules": () => [],
  "styled-components": () => [],
}

// --------------------------------------
// STATE MANAGEMENT BLOCKS
// --------------------------------------
export const stateBlocks = {
  none: () => [],

  zustand: () => [
    folder("src", [
      folder("store", [file("useStore.ts")]),
    ]),
  ],

  redux: () => [
    folder("src", [
      folder("store", [file("store.ts")]),
    ]),
  ],

  jotai: () => [
    folder("src", [
      folder("state", [file("atoms.ts")]),
    ]),
  ],
}

// --------------------------------------
// SHARED BLOCKS
// --------------------------------------
export const sharedBlocks = {
  base: () => [
    file(".gitignore"),
    file("README.md"),
    file("package.json"),
  ],

  linting: () => [
    file("eslint.config.js"),
    file(".prettierrc"),
  ],
}


function mergeChildren(a: FileNode[], b: FileNode[]): FileNode[] {
  const map = new Map<string, FileNode>()

  const push = (node: FileNode) => {
    const key = node.name
    if (!map.has(key)) {
      // shallow clone to avoid mutation of original blocks
      map.set(key, node.type === "folder" ? { ...node, children: [...node.children!] } : { ...node })
      return
    }

    const existing = map.get(key)!
    // both folders -> merge children
    if (existing.type === "folder" && node.type === "folder") {
      existing.children = mergeChildren(existing.children ?? [], node.children ?? [])
      return
    }

    // existing folder + incoming file -> keep folder
    if (existing.type === "folder" && node.type === "file") return

    // existing file + incoming folder -> replace file with folder (folder wins)
    if (existing.type === "file" && node.type === "folder") {
      map.set(key, { ...node, children: [...(node.children ?? [])] })
      return
    }

    // both files -> keep existing (first wins)
  }

  for (const n of a) push(n)
  for (const n of b) push(n)

  return Array.from(map.values())
}

export function generateProjectStructure(config: ProjectConfig): FileStructure {
  const blocks: (() => FileNode[])[] = []

  const frameworkBlock = frameworkBlocks[config.framework]
  if (frameworkBlock) blocks.push(frameworkBlock)

  const routingBlock = routingBlocks[config.routing]
  if (routingBlock) blocks.push(routingBlock)

  const stylingBlock = stylingBlocks[config.styling]
  if (stylingBlock) blocks.push(stylingBlock)

  const stateBlock = stateBlocks[config.stateManagement]
  if (stateBlock) blocks.push(stateBlock)

  blocks.push(sharedBlocks.base)

  if (config.linting && sharedBlocks.linting) {
    blocks.push(sharedBlocks.linting)
  }

  // Собираем все children из блоков (игнорируя потенциально отсутствующие блоки)
  const allChildren = blocks.flatMap((fn) => fn())

  // Сливаем узлы с одинаковым именем (в т.ч. несколько src) рекурсивно
  const merged = mergeChildren([], allChildren)

  // Возвращаем корень проекта с корректными вложениями
  return folder(config.projectName || "my-project", merged)
}
