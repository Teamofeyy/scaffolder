'use client'

import { ChevronRight, File, Folder, FolderOpen } from 'lucide-react'
import { KeyboardEvent, useState } from 'react'
import { cn } from '@/lib/utils'

interface FileTreeNode {
  name: string
  type: 'file' | 'folder'
  children?: FileTreeNode[]
}

interface FileTreeProps {
  data: FileTreeNode
  level?: number
  path?: string
  selectedPath?: string | null
  onSelectFile?: (path: string) => void
}

export function FileTree({
  data,
  level = 0,
  path = '',
  selectedPath,
  onSelectFile,
}: FileTreeProps) {
  const [isOpen, setIsOpen] = useState(level < 2)

  const isFolder = data.type === 'folder'
  const nodePath = level === 0 ? '' : path
  const isSelected = !isFolder && selectedPath === nodePath
  const toggleFolder = () => {
    if (isFolder) setIsOpen((current) => !current)
  }

  const handleClick = () => {
    if (isFolder) {
      toggleFolder()
      return
    }

    if (nodePath) onSelectFile?.(nodePath)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!isFolder) {
      if ((event.key === 'Enter' || event.key === ' ') && nodePath) {
        event.preventDefault()
        onSelectFile?.(nodePath)
      }
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      toggleFolder()
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault()
      setIsOpen(true)
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      setIsOpen(false)
    }
  }

  return (
    <div className="select-none" role={level === 0 ? 'tree' : 'group'}>
      <button
        type="button"
        role="treeitem"
        aria-level={level + 1}
        aria-expanded={isFolder ? isOpen : undefined}
        aria-selected={isSelected}
        style={{ paddingLeft: `${level * 12}px` }}
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          isSelected && 'bg-accent text-accent-foreground',
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        {isFolder && (
          <ChevronRight
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform',
              isOpen && 'rotate-90',
            )}
          />
        )}
        {!isFolder && <div className="w-4" />}

        {isFolder ? (
          isOpen ? (
            <FolderOpen className="h-4 w-4 text-primary" />
          ) : (
            <Folder className="h-4 w-4 text-primary" />
          )
        ) : (
          <File className="h-4 w-4 text-muted-foreground" />
        )}

        <span
          className={cn(
            'text-sm font-mono',
            isFolder
              ? 'font-semibold text-foreground'
              : 'text-muted-foreground',
          )}
        >
          {data.name}
        </span>
      </button>

      {isFolder && isOpen && data.children && (
        <div>
          {data.children.map((child, index) => (
            <FileTree
              key={`${child.name}-${index}`}
              data={child}
              level={level + 1}
              path={level === 0 ? child.name : `${nodePath}/${child.name}`}
              selectedPath={selectedPath}
              onSelectFile={onSelectFile}
            />
          ))}
        </div>
      )}
    </div>
  )
}
