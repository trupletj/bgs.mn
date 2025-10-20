"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

interface ImageUploaderProps {
  multiple?: boolean;
  onUpload: (urls: string[] | string) => void;
}

export default function ImageUploader({
  multiple = false,
  onUpload,
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const supabase = createClient();

  const validateFile = (file: File) => {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (file.size > maxSize) {
      toast.error("Зургийн хэмжээ 5MB-аас их байж болохгүй.");
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
    quality = 0.8
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
          quality
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
    [multiple, onUpload, supabase.storage]
  );

  return (
    <div className="relative">
      <div className="flex items-center justify-center space-x-4 mt-2">
        <label className="cursor-pointer">
          <span className="py-2 px-4 rounded-md bg-blue-500 text-white hover:bg-blue-600">
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
        <span className="text-sm text-gray-600">
          Заавал зураг оруулах шаардлагагүй
        </span>
      </div>

      {uploading && (
        <div className="mt-2">
          <progress value={progress} max="100" className="w-1/2" />
          <span> {Math.round(progress)}%</span>
        </div>
      )}
    </div>
  );
}
