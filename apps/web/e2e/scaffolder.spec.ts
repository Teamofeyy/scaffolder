import { expect, test, type Page } from "@playwright/test"

const axePath = require.resolve("axe-core/axe.min.js")

async function hideNextDevtools(page: Page) {
  await page.addStyleTag({
    content: `
      nextjs-portal,
      body > div[style*="position: fixed"],
      [data-nextjs-dev-tools-button],
      [data-next-mark],
      [data-nextjs-toast],
      [data-nextjs-dev-tools-menu] {
        display: none !important;
      }
    `,
  })
  await page.getByText(/Issue/).evaluateAll((nodes) => {
    for (const node of nodes) {
      let current = node as HTMLElement
      while (current.parentElement && current.parentElement !== document.body) {
        current = current.parentElement
      }
      current.style.display = "none"
    }
  })
  await page.evaluate(() => {
    document.querySelectorAll("nextjs-portal").forEach((node) => node.remove())
  })
}

const recipeCatalog = [
  {
    id: "react-router-app",
    name: "React Router App",
    description: "Vite, React, TypeScript, Tailwind CSS, and React Router baseline.",
    tier: "experimental",
    status: "draft",
    baseTemplate: "vite-react-ts",
    options: {
      ui: {
        label: "UI kit",
        description: "Optional component-system integration.",
        default: "none",
        values: [
          { id: "none", label: "None", description: "Do not add a UI kit.", blocks: [] },
          { id: "shadcn", label: "shadcn/ui", description: "Add shadcn/ui.", blocks: ["shadcn"] },
        ],
      },
      testing: {
        label: "Testing",
        description: "Optional test runner setup.",
        default: "none",
        values: [
          { id: "none", label: "None", description: "Do not add tests.", blocks: [] },
          { id: "vitest", label: "Vitest", description: "Add Vitest.", blocks: ["vitest"] },
        ],
      },
      state: {
        label: "State management",
        description: "Optional client state setup.",
        default: "none",
        values: [
          { id: "none", label: "None", description: "Use React state only.", blocks: [] },
          { id: "zustand", label: "Zustand", description: "Add Zustand.", blocks: ["zustand"] },
        ],
      },
    },
    verification: { generate: true, install: true, build: true, test: "optional" },
  },
]

const recipeDetails = {
  ...recipeCatalog[0],
  blocks: ["tailwind-vite", "react-router"],
  customDependencies: {
    allow: true,
    policy: "package-json-only",
  },
  preview: {
    curatedFiles: ["package.json", "README.md", "vite.config.ts", "src/main.tsx"],
    showAllFiles: true,
  },
}

const previewResponse = {
  recipeId: "react-router-app",
  projectName: "demo-app",
  tree: {
    name: "demo-app",
    type: "folder",
    children: [
      {
        name: "src",
        type: "folder",
        children: [
          { name: "main.tsx", type: "file", children: [] },
          {
            name: "routes",
            type: "folder",
            children: [{ name: "home.tsx", type: "file", children: [] }],
          },
        ],
      },
      { name: "package.json", type: "file", children: [] },
      { name: "README.md", type: "file", children: [] },
      { name: "vite.config.ts", type: "file", children: [] },
    ],
  },
  curatedTree: {
    name: "demo-app",
    type: "folder",
    children: [
      {
        name: "src",
        type: "folder",
        children: [{ name: "main.tsx", type: "file", children: [] }],
      },
      { name: "package.json", type: "file", children: [] },
      { name: "README.md", type: "file", children: [] },
      { name: "vite.config.ts", type: "file", children: [] },
    ],
  },
  selectedFiles: [
    {
      path: "package.json",
      language: "json",
      content: "{\"name\":\"demo-app\",\"scripts\":{\"build\":\"vite build\"}}",
      truncated: false,
    },
    { path: "README.md", language: "markdown", content: "# demo-app", truncated: false },
    { path: "vite.config.ts", language: "typescript", content: "import react from '@vitejs/plugin-react'", truncated: false },
    { path: "src/main.tsx", language: "typescript", content: "import React from 'react'", truncated: false },
  ],
  files: [
    {
      path: "package.json",
      language: "json",
      content: "{\"name\":\"demo-app\",\"scripts\":{\"build\":\"vite build\"}}",
      truncated: false,
    },
    { path: "README.md", language: "markdown", content: "# demo-app", truncated: false },
    { path: "vite.config.ts", language: "typescript", content: "import react from '@vitejs/plugin-react'", truncated: false },
    { path: "src/main.tsx", language: "typescript", content: "import React from 'react'", truncated: false },
  ],
  dependencies: ["@vitejs/plugin-react", "react", "react-dom"],
  devDependencies: ["vite", "typescript"],
  commands: ["npm install", "npm run dev", "npm run build"],
  selectedBlocks: ["tailwind-vite", "react-router"],
  customDependencies: [],
  customDevDependencies: [],
  recipeTier: "experimental",
  recipeStatus: "draft",
  supportStatus: "experimental",
  baseTemplate: "vite-react-ts",
  templateSnapshot: "apps/api/templates/template-react-ts",
  verification: { generate: true, install: true, build: true, test: "optional" },
  warnings: ["This recipe is experimental."],
}

test.beforeEach(async ({ page }) => {
  await page.route("**/api/recipes/react-router-app/preview", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(previewResponse),
    })
  })

  await page.route("**/api/recipes/react-router-app/generate", async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "application/zip",
        "content-disposition": 'attachment; filename="demo-app.zip"',
      },
      body: Buffer.from("PK\u0003\u0004scaffolder-test-zip"),
    })
  })

  await page.route("**/api/recipes/react-router-app", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(recipeDetails),
    })
  })

  await page.route("**/api/recipes", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(recipeCatalog),
    })
  })
})

test("switches locale through the header control", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Locale switching is covered on desktop")

  await page.goto("/en")

  const ruLink = page.getByRole("link", { name: /^ru$/ })
  await expect(ruLink).toHaveAttribute("href", "/ru")

  await Promise.all([
    page.waitForURL(/\/ru$/),
    ruLink.evaluate((link: HTMLAnchorElement) => link.click()),
  ])
  await expect(page.getByRole("heading", { name: "Recipe workbench" })).toBeVisible()
  await expect(page.getByPlaceholder("Поиск рецептов")).toBeVisible()
})

test("opens a recipe, previews clickable files, and downloads a generated ZIP", async ({ page }) => {
  await page.goto("/en")

  await page.getByRole("tab", { name: /community/i }).click()
  await page.getByRole("button", { name: "Open", exact: true }).click()
  await page.getByLabel("Project name").fill("demo-app")

  await expect(page.getByRole("treeitem", { name: "package.json" })).toBeVisible()
  await page.getByRole("treeitem", { name: "package.json" }).click()
  await expect(page.getByText("\"name\":\"demo-app\"")).toBeVisible()

  await page.getByRole("treeitem", { name: "README.md" }).click()
  await expect(page.getByText("# demo-app")).toBeVisible()

  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "Generate ZIP" }).click()
  const download = await downloadPromise

  expect(download.suggestedFilename()).toBe("demo-app.zip")
})

test("has no critical accessibility violations", async ({ page }) => {
  await page.goto("/en")
  await page.addScriptTag({ path: axePath })

  const results = await page.evaluate(async () => {
    return await window.axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa"],
      },
    })
  })

  expect(results.violations).toEqual([])
})

test("keeps a mobile regression screenshot", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chrome", "Mobile screenshot runs only on the mobile project")

  await page.goto("/en")
  await expect(page.getByText("React Router App")).toBeVisible()
  await hideNextDevtools(page)

  await expect(page).toHaveScreenshot("scaffolder-mobile.png", {
    fullPage: true,
    animations: "disabled",
  })
})
