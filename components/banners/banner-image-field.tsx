"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import Cropper, { type Area } from "react-easy-crop";
import { toast } from "sonner";
import { ImagePlus } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Banner-ийн харьцаа (өргөн : өндөр). Mobile carousel-тэй ижил байх ёстой. */
export const BANNER_ASPECT = 2.5;

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const MAX_OUTPUT_WIDTH = 1600;

/** Crop хэсгийг canvas-д зурж шахсан JPEG blob гаргана. */
async function getCroppedBlob(src: string, area: Area): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new window.Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = src;
  });

  const scale =
    area.width > MAX_OUTPUT_WIDTH ? MAX_OUTPUT_WIDTH / area.width : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(area.width * scale);
  canvas.height = Math.round(area.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");

  ctx.drawImage(
    img,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob"))),
      "image/jpeg",
      0.85,
    );
  });
}

interface BannerImageFieldProps {
  value?: string;
  onChange: (url: string) => void;
}

export function BannerImageField({ value, onChange }: BannerImageFieldProps) {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [srcToCrop, setSrcToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaPixels, setAreaPixels] = useState<Area | null>(null);
  const [uploading, setUploading] = useState(false);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // ижил файл дахин сонгох боломж
    if (!file) return;
    if (!ALLOWED.includes(file.type)) {
      toast.error("Зөвхөн JPEG, PNG, WEBP зураг.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Зургийн хэмжээ 8MB-аас бага байх ёстой.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setSrcToCrop(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const onCropComplete = useCallback((_: Area, areaPx: Area) => {
    setAreaPixels(areaPx);
  }, []);

  const confirmCrop = async () => {
    if (!srcToCrop || !areaPixels) return;
    setUploading(true);
    try {
      const blob = await getCroppedBlob(srcToCrop, areaPixels);
      const fileName = `banner-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}.jpg`;
      const { error } = await supabase.storage
        .from("order-item-bucket")
        .upload(fileName, blob, { contentType: "image/jpeg", upsert: false });
      if (error) throw error;
      const { data } = supabase.storage
        .from("order-item-bucket")
        .getPublicUrl(fileName);
      onChange(data.publicUrl);
      setSrcToCrop(null);
      toast.success("Зураг бэлэн боллоо");
    } catch (err) {
      console.error("[banner] crop upload error:", err);
      toast.error("Зураг боловсруулахад алдаа гарлаа.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      {value ? (
        <div
          className="relative w-full overflow-hidden rounded-xl border bg-muted"
          style={{ aspectRatio: String(BANNER_ASPECT) }}>
          <Image src={value} alt="banner" fill className="object-cover" />
        </div>
      ) : null}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onFile}
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => fileRef.current?.click()}>
        <ImagePlus className="size-4" />
        {value ? "Зураг солих" : "Зураг сонгож тохируулах"}
      </Button>

      <Dialog
        open={!!srcToCrop}
        onOpenChange={(o) => !o && !uploading && setSrcToCrop(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Зургийг banner-т тааруулах</DialogTitle>
          </DialogHeader>
          <div
            className="relative w-full overflow-hidden rounded-lg bg-black/80"
            style={{ height: 280 }}>
            {srcToCrop ? (
              <Cropper
                image={srcToCrop}
                crop={crop}
                zoom={zoom}
                aspect={BANNER_ASPECT}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            ) : null}
          </div>
          <div className="flex items-center gap-3 pt-1">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              Томруулах
            </span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-primary"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSrcToCrop(null)}
              disabled={uploading}>
              Болих
            </Button>
            <Button
              type="button"
              onClick={confirmCrop}
              disabled={uploading || !areaPixels}>
              {uploading ? "Хадгалж байна..." : "Хэрэглэх"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
