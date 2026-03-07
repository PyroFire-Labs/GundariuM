"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useMintStore } from "@/store/useMintStore";

export function PhotoDropzone() {
  const { step, imagePreviewUrl, imageFile, goTo, setImage } = useMintStore();

  const onDrop = useCallback(
    (accepted: File[]) => {
      const file = accepted[0];
      if (!file) return;

      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const MAX = 1400;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else { width = Math.round(width * MAX / height); height = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) return;
            const compressed = new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
            const preview = URL.createObjectURL(compressed);
            setImage(compressed, preview);
          },
          "image/jpeg",
          0.85
        );
      };
      img.src = objectUrl;
    },
    [setImage]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/jpeg": [], "image/png": [], "image/webp": [] },
    maxSize: 10 * 1024 * 1024,
    multiple: false,
  });

  const isLoading = step === "uploading" || step === "analyzing";

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-md">
      <div
        {...getRootProps()}
        className={`w-full aspect-square rounded-xl border-2 border-dashed cursor-pointer flex flex-col items-center justify-center gap-3 transition-all overflow-hidden
          ${
            isDragActive
              ? "border-[var(--accent)] bg-[var(--accent)]/10"
              : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/60"
          }`}
      >
        <input {...getInputProps()} />
        {imagePreviewUrl ? (
          <img
            src={imagePreviewUrl}
            alt="Preview"
            className="w-full h-full object-cover"
          />
        ) : (
          <>
            <div className="text-5xl">📷</div>
            <p className="text-[var(--foreground)]/60 text-sm text-center px-8">
              {isDragActive
                ? "Drop it here"
                : "Drag your Gunpla photo here, or click to browse"}
            </p>
            <p className="text-[var(--foreground)]/40 text-xs">
              JPEG · PNG · WebP — max 10 MB
            </p>
          </>
        )}
      </div>

      {imageFile && !isLoading && (
        <div className="flex flex-col items-center gap-2 w-full">
          <button
            onClick={() => goTo("grade_select")}
            className="w-full py-3 bg-[var(--accent)] text-black font-bold font-[family-name:var(--font-orbitron)] text-sm rounded-lg hover:brightness-110 transition-all"
          >
            NEXT: SELECT GRADE →
          </button>
          <button
            onClick={() => setImage(null as unknown as File, "")}
            className="text-[var(--foreground)]/40 text-xs hover:text-[var(--foreground)]/60 transition-colors"
          >
            Choose a different photo
          </button>
        </div>
      )}

      {isLoading && (
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          <p className="text-[var(--accent)] text-sm font-[family-name:var(--font-orbitron)] tracking-wider">
            {step === "analyzing" ? "AI ANALYZING..." : "UPLOADING..."}
          </p>
        </div>
      )}
    </div>
  );
}
