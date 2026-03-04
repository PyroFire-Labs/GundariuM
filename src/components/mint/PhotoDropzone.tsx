"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useMintStore } from "@/store/useMintStore";

export function PhotoDropzone() {
  const { step, imagePreviewUrl, imageFile, goTo, setImage, setTraits, setError } =
    useMintStore();

  const onDrop = useCallback(
    (accepted: File[]) => {
      const file = accepted[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      setImage(file, url);
    },
    [setImage]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/jpeg": [], "image/png": [], "image/webp": [] },
    maxSize: 10 * 1024 * 1024,
    multiple: false,
  });

  const analyze = async () => {
    if (!imageFile) return;
    const form = new FormData();
    form.append("image", imageFile);

    try {
      goTo("analyzing");
      const res = await fetch("/api/analyze-gunpla", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTraits(data.traits);
      goTo("reviewing");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
      goTo("idle");
    }
  };

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
            onClick={analyze}
            className="w-full py-3 bg-[var(--accent)] text-black font-bold font-[family-name:var(--font-orbitron)] text-sm rounded-lg hover:brightness-110 transition-all"
          >
            ANALYZE WITH AI
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
