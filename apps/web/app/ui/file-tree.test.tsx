import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { FileTree } from './file-tree'

describe('FileTree', () => {
  it('allows folders to be collapsed and expanded with the keyboard', async () => {
    const user = userEvent.setup()

    render(
      createElement(FileTree, {
        data: {
          name: 'demo',
          type: 'folder',
          children: [
            {
              name: 'src',
              type: 'folder',
              children: [{ name: 'main.tsx', type: 'file' }],
            },
          ],
        },
      }),
    )

    const src = screen.getByRole('treeitem', { name: /src/i })
    src.focus()

    await user.keyboard('{ArrowLeft}')
    expect(
      screen.queryByRole('treeitem', { name: /main\.tsx/i }),
    ).not.toBeInTheDocument()

    await user.keyboard('{ArrowRight}')
    expect(
      screen.getByRole('treeitem', { name: /main\.tsx/i }),
    ).toBeInTheDocument()
  })
})
