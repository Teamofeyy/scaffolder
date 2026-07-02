import { expect, test } from "@playwright/test"

const axePath = require.resolve("axe-core/axe.min.js")

test.beforeEach(async ({ page }) => {
  await page.route("**/api/capabilities", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ aiRecommendations: false }),
    })
  })

  await page.route("**/api/features", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([
        { name: "react", label: "React", description: "React framework", category: "framework", requires: [], conflicts: [], support_status: "supported" },
        { name: "nextjs", label: "Next.js", description: "React meta framework", category: "framework", requires: ["react"], conflicts: [], support_status: "supported" },
        { name: "vue", label: "Vue", description: "Vue framework", category: "framework", requires: [], conflicts: [], support_status: "supported" },
        { name: "svelte-ts", label: "Svelte", description: "Svelte framework template", category: "framework", requires: [], conflicts: [], support_status: "experimental" },
        { name: "solid-ts", label: "Solid", description: "Solid framework template", category: "framework", requires: [], conflicts: [], support_status: "experimental" },
        { name: "preact-ts", label: "Preact", description: "Preact framework template", category: "framework", requires: [], conflicts: [], support_status: "experimental" },
        { name: "preact-ts-official", label: "Preact official", description: "Official Preact template", category: "framework", requires: [], conflicts: [], support_status: "unavailable" },
        { name: "nuxt-ts", label: "Nuxt", description: "Nuxt framework template", category: "framework", requires: [], conflicts: [], support_status: "experimental" },
        { name: "angular-ts", label: "Angular", description: "Angular framework template", category: "framework", requires: [], conflicts: [], support_status: "experimental" },
        { name: "qwik-ts", label: "Qwik", description: "Qwik framework template", category: "framework", requires: [], conflicts: [], support_status: "experimental" },
        { name: "lit-ts", label: "Lit", description: "Lit framework template", category: "framework", requires: [], conflicts: [], support_status: "experimental" },
        { name: "ember-ts", label: "Ember", description: "Ember framework template", category: "framework", requires: [], conflicts: [], support_status: "experimental" },
        { name: "marko-ts", label: "Marko", description: "Marko framework template", category: "framework", requires: [], conflicts: [], support_status: "experimental" },
      ]),
    })
  })

  await page.route("**/api/presets", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "react-router-tailwind",
          label: "React Router App",
          description: "React SPA with React Router and Tailwind CSS.",
          status: "supported",
          config: {
            framework: "react",
            styling: "tailwind",
            linting: "eslint",
            state_management: "none",
            routing: "react-router",
            dependencies: [],
            dev_dependencies: [],
            testing: "none",
          },
        },
      ]),
    })
  })

  await page.route("**/api/preview/details", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        tree: {
          name: "demo-app",
          type: "folder",
          children: [
            {
              name: "src",
              type: "folder",
              children: [{ name: "main.tsx", type: "file" }],
            },
            { name: "package.json", type: "file" },
          ],
        },
        files: [
          { path: "package.json", language: "json", content: "{\"name\":\"demo-app\"}", truncated: false },
          { path: "README.md", language: "markdown", content: "# demo-app", truncated: false },
        ],
        dependencies: ["react", "react-dom"],
        dev_dependencies: ["vite", "typescript"],
        commands: ["npm install", "npm run dev", "npm run build"],
        support_status: "supported",
        verification: { matrix: "1.1.0", generate: true, install: true, build: true },
      }),
    })
  })

  await page.route("**/api/generate", async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "application/zip",
        "content-disposition": 'attachment; filename="demo-app.zip"',
      },
      body: Buffer.from("PK\u0003\u0004scaffolder-test-zip"),
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
  await expect(page.getByRole("heading", { name: "Scaffolder" })).toBeVisible()
  await expect(page.getByText("Конфигурация проекта")).toBeVisible()
})

test("renders preview and downloads a generated ZIP", async ({ page }) => {
  await page.goto("/en")

  await page.getByLabel("Project name").fill("demo-app")
  await expect(page.getByRole("treeitem", { name: "src" })).toBeVisible()
  await expect(page.getByRole("treeitem", { name: "package.json" })).toBeVisible()

  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "Generate project" }).click()
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

  await expect(page).toHaveScreenshot("scaffolder-mobile.png", {
    fullPage: true,
    animations: "disabled",
  })
})
