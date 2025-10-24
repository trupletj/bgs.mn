"use client";

import { useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";

interface ImageViewerProps {
  images: string[] | string;
  editable?: boolean;
  onDelete?: (url: string) => void;
  pendingDeletion?: string[];
}

export default function ImageViewer({
  images,
  editable,
  onDelete,
  pendingDeletion = [],
}: ImageViewerProps) {
  const [open, setOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const imageArray = Array.isArray(images) ? images : images ? [images] : [];

  const visibleImages = imageArray.filter(
    (url) => !pendingDeletion.includes(url)
  );

  if (visibleImages.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-4">
      {imageArray.map((url, idx) => {
        const isPendingDeletion = pendingDeletion.includes(url);

        return (
          <div
            key={idx}
            className={`relative group rounded-lg overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 ${
              isPendingDeletion ? "opacity-50 grayscale" : ""
            }`}>
            <Image
              src={url}
              alt={`Image ${idx + 1}`}
              width={192}
              height={192}
              className="object-cover cursor-pointer"
              onClick={() => {
                if (!isPendingDeletion) {
                  setCurrentIndex(idx);
                  setOpen(true);
                }
              }}
            />

            {isPendingDeletion && (
              <div className="absolute inset-0 bg-red-100 bg-opacity-50 flex items-center justify-center">
                <span className="text-red-600 font-semibold">Устгах</span>
              </div>
            )}

            {editable && onDelete && !isPendingDeletion && (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 w-7 h-7"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(url);
                }}
                title="Зураг устгах">
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        );
      })}

      <Lightbox
        open={open}
        close={() => setOpen(false)}
        index={currentIndex}
        slides={visibleImages.map((src) => ({ src }))}
      />
    </div>
  );
}
