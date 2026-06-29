"use client"

import { ChevronRight, File, Folder, FolderOpen } from "lucide-react"
import { KeyboardEvent, useState } from "react"
import { cn } from "@/lib/utils"

interface FileTreeNode {
  name: string
  type: "file" | "folder"
  children?: FileTreeNode[]
}

interface FileTreeProps {
  data: FileTreeNode
  level?: number
}

export function FileTree({ data, level = 0 }: FileTreeProps) {
  const [isOpen, setIsOpen] = useState(level < 2)

  const isFolder = data.type === "folder"
  const toggleFolder = () => {
    if (isFolder) setIsOpen((current) => !current)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!isFolder) return

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      toggleFolder()
    }

    if (event.key === "ArrowRight") {
      event.preventDefault()
      setIsOpen(true)
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault()
      setIsOpen(false)
    }
  }

  return (
    <div className="select-none" role={level === 0 ? "tree" : "group"}>
      <button
        type="button"
        role="treeitem"
        aria-level={level + 1}
        aria-expanded={isFolder ? isOpen : undefined}
        aria-selected={false}
        style={{ paddingLeft: `${level * 12}px` }}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
        onClick={toggleFolder}
        onKeyDown={handleKeyDown}
      >
        {isFolder && (
          <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-90")} />
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

        <span className={cn("text-sm font-mono", isFolder ? "font-semibold text-foreground" : "text-muted-foreground")}>
          {data.name}
        </span>
      </button>

      {isFolder && isOpen && data.children && (
        <div>
          {data.children.map((child, index) => (
            <FileTree key={`${child.name}-${index}`} data={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  )
}
