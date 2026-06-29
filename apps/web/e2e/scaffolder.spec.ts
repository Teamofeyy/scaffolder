import { expect, test } from "@playwright/test"

const axePath = require.resolve("axe-core/axe.min.js")

test.beforeEach(async ({ page }) => {
  await page.route("**/api/capabilities", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ aiRecommendations: false }),
    })
  })

  await page.route("**/api/preview", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
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
