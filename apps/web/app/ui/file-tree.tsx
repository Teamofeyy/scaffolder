"use client"

import { ChevronRight, File, Folder, FolderOpen } from "lucide-react"
import { useState } from "react"
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

  return (
    <div className="select-none">
      <div
        style={{ paddingLeft: `${level * 12}px` }}
        className={cn(
          "flex items-center gap-2 py-1 px-2 rounded-md hover:bg-accent/50 cursor-pointer transition-colors",
        )}
        onClick={() => isFolder && setIsOpen(!isOpen)}
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
      </div>

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
