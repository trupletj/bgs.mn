"use client";

import { useState, useCallback, type Dispatch } from "react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import {
  getFileSizeLimitMessage,
  getFileTooLargeMessage,
  IMAGE_UPLOAD_MAX_BYTES,
} from "@/lib/file-upload-limits";

interface ImageUploaderProps {
  multiple?: boolean;
  onUpload: Dispatch<string[] | string>;
  helperText?: string;
  hideHelperText?: boolean;
}

export default function ImageUploader({
  multiple = false,
  onUpload,
  helperText = "Заавал зураг оруулах шаардлагагүй",
  hideHelperText = false,
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const supabase = createClient();

  const validateFile = (file: File) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (file.size > IMAGE_UPLOAD_MAX_BYTES) {
      toast.error(getFileTooLargeMessage(file.name, IMAGE_UPLOAD_MAX_BYTES));
      return false;
    }

    if (!allowedTypes.includes(file.type)) {
      toast.error("Зөвхөн JPEG, PNG, эсвэл WEBP зураг оруулна уу.");
      return false;
    }

    return true;
  };

  const resizeImage = (
    file: File,
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 0.8,
  ): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        if (!e.target?.result) return reject("Failed to load image");
        img.src = e.target.result as string;
      };

      img.onload = () => {
        let { width, height } = img;

        // харьцааг хадгалж багасгах
        if (width > maxWidth || height > maxHeight) {
          const scale = Math.min(maxWidth / width, maxHeight / height);
          width *= scale;
          height *= scale;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject("Failed to get canvas context");

        ctx.drawImage(img, 0, 0, width, height);

        // JPEG болгож шахах
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject("Failed to resize image");
            resolve(blob);
          },
          "image/jpeg",
          quality,
        );
      };

      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      try {
        setUploading(true);
        setProgress(0);
        const files = e.target.files;
        if (!files || files.length === 0) {
          toast.error("Ямар нэгэн зураг сонгоогүй байна.");
          return;
        }

        const validFiles = Array.from(files).filter(validateFile);
        if (validFiles.length === 0) return;

        const uploadedUrls: string[] = [];
        const totalFiles = validFiles.length;

        for (const [index, file] of validFiles.entries()) {
          // ⬇️ compress хийж blob болгож байна
          const compressedBlob = await resizeImage(file);

          const fileExt = "jpg"; // шахалт хийсэн тул бүгд JPEG болно
          const fileName = `${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 15)}.${fileExt}`;

          const { error } = await supabase.storage
            .from("order-item-bucket")
            .upload(fileName, compressedBlob, {
              cacheControl: "3600",
              upsert: false,
              contentType: "image/jpeg",
            });

          if (error) {
            toast.error(`Зураг оруулахад алдаа гарлаа: ${file.name}`);
            throw error;
          }

          const { data } = supabase.storage
            .from("order-item-bucket")
            .getPublicUrl(fileName);

          uploadedUrls.push(data.publicUrl);
          setProgress(((index + 1) / totalFiles) * 100);
        }

        onUpload(multiple ? uploadedUrls : uploadedUrls[0]);
        toast.success("Зураг амжилттай хуулагдлаа!");
      } catch (error) {
        console.error("Upload error:", error);
        toast.error("Зураг хуулахад алдаа гарлаа.");
      } finally {
        setUploading(false);
        setProgress(0);
      }
    },
    [multiple, onUpload, supabase.storage],
  );

  return (
    <div className="relative">
      <div className="mt-2 flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-slate-50/60 p-4">
        <label className="cursor-pointer">
          <span className="inline-flex h-10 items-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700">
            Зураг сонгох
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple={multiple}
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
        {!hideHelperText && helperText && (
          <span className="text-center text-sm text-gray-600">
            {helperText}
          </span>
        )}
        <span className="text-center text-xs text-muted-foreground">
          {getFileSizeLimitMessage(IMAGE_UPLOAD_MAX_BYTES)}
        </span>
      </div>

      {uploading && (
        <div className="mt-2 w-full max-w-xs">
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1 text-center text-xs text-muted-foreground">
            {Math.round(progress)}%
          </p>
        </div>
      )}
    </div>
  );
}
