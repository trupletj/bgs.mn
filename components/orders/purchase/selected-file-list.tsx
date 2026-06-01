"use client";

import type React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/lib/file-upload-limits";

export function SelectedFileList({
  files,
  onRemove,
}: SelectedFileListProps) {
  if (files.length === 0) {
    return <p className="mt-1 text-xs text-muted-foreground">Файл сонгоогүй</p>;
  }

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      {files.map((file, index) => (
        <div
          key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
          className="flex items-center gap-2 rounded-md border border-border/60 px-2 py-1.5 text-xs">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{file.name}</p>
            <p className="text-muted-foreground">{formatFileSize(file.size)}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => onRemove(index)}>
            <X className="h-3.5 w-3.5" />
            <span className="sr-only">Файл устгах</span>
          </Button>
        </div>
      ))}
    </div>
  );
}

type SelectedFileListProps = {
  files: File[];
  onRemove: React.Dispatch<number>;
};
