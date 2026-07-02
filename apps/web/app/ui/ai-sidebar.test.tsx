import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createElement } from "react"
import { describe, expect, it, vi } from "vitest"
import dictionary from "@/lib/i18n/dictionaries/en.json"
import { AiSidebar } from "./ai-sidebar"
import type { ProjectConfig } from "@/types/project-config"

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()

  return {
    ...actual,
    recommendProjectConfig: vi.fn(),
  }
})

const config: ProjectConfig = {
  projectName: "demo",
  framework: "react",
  typescript: true,
  styling: "tailwind",
  linting: "eslint",
  stateManagement: "none",
  routing: "react-router",
  dependencies: [],
  devDependencies: [],
}

describe("AiSidebar", () => {
  it("behaves as a dialog and restores focus when closed with Escape", async () => {
    const user = userEvent.setup()

    render(
      createElement(AiSidebar, {
        config,
        setConfig: vi.fn(),
        locale: "en",
        dictionary: dictionary.ai,
      }),
    )

    const opener = screen.getByRole("button", { name: /ai/i })
    await user.click(opener)

    expect(screen.getByRole("dialog", { name: dictionary.ai.title })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: dictionary.ai.close })).toHaveFocus()

    await user.keyboard("{Escape}")

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
    expect(opener).toHaveFocus()
  })
})
