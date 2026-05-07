"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { Eye, Trash2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ImageViewerProps {
  images: string[] | string;
  editable?: boolean;
  onDelete?: (url: string) => void;
  pendingDeletion?: string[];
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClassMap = {
  sm: "size-16",
  md: "size-24",
  lg: "size-36",
};

export default function ImageViewer({
  images,
  editable = false,
  onDelete,
  pendingDeletion = [],
  size = "md",
  className,
}: ImageViewerProps) {
  const [open, setOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const imageArray = useMemo(
    () => (Array.isArray(images) ? images : images ? [images] : []),
    [images],
  );

  const visibleImages = imageArray.filter(
    (url) => !pendingDeletion.includes(url),
  );

  if (visibleImages.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-xl border border-dashed bg-slate-50 text-slate-400",
          sizeClassMap[size],
          className,
        )}>
        <ImageIcon className="size-5" />
      </div>
    );
  }

  return (
    <>
      <div className={cn("flex flex-wrap gap-3", className)}>
        {imageArray.map((url) => {
          const isPendingDeletion = pendingDeletion.includes(url);
          const visibleIndex = visibleImages.indexOf(url);

          return (
            <div
              key={url}
              className={cn(
                "group relative overflow-hidden rounded-xl border bg-white shadow-sm ring-1 ring-slate-100 transition",
                "hover:shadow-md",
                sizeClassMap[size],
                isPendingDeletion && "opacity-50 grayscale",
              )}>
              <button
                type="button"
                disabled={isPendingDeletion}
                onClick={() => {
                  if (visibleIndex >= 0) {
                    setCurrentIndex(visibleIndex);
                    setOpen(true);
                  }
                }}
                className="relative block size-full overflow-hidden"
                aria-label="Зураг харах">
                <Image
                  src={url}
                  alt="Захиалгын сэлбэгийн зураг"
                  fill
                  sizes="(max-width: 768px) 96px, 144px"
                  className="object-cover transition-transform duration-200 group-hover:scale-105"
                />

                {!isPendingDeletion && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/35 group-hover:opacity-100">
                    <div className="rounded-full bg-white/90 p-2 text-slate-900 shadow-sm">
                      <Eye className="size-4" />
                    </div>
                  </div>
                )}
              </button>

              {isPendingDeletion && (
                <div className="absolute inset-0 flex items-center justify-center bg-red-500/15">
                  <div className="rounded-full bg-red-600 px-2.5 py-1 text-xs font-medium text-white shadow-sm">
                    Устгахаар тэмдэглэсэн
                  </div>
                </div>
              )}

              {editable && onDelete && !isPendingDeletion && (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute right-1.5 top-1.5 size-7 opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(url);
                  }}
                  aria-label="Зураг устгах">
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <Lightbox
        open={open}
        close={() => setOpen(false)}
        index={currentIndex}
        slides={visibleImages.map((src) => ({ src }))}
      />
    </>
  );
}
