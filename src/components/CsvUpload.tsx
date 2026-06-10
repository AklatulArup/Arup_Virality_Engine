"use client";

import { useState, useRef } from "react";

interface CsvUploadProps {
  onUpload: (file: File) => void;
  loading: boolean;
  lastUpload?: { videoCount: number; uploadCount: number; time: string } | null;
}

export default function CsvUpload({
  onUpload,
  loading,
  lastUpload,
}: CsvUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingFile = useRef<File | null>(null);

  function handleFile(file: File) {
    if (!file.name.endsWith(".csv") && !file.name.endsWith(".tsv")) {
      return;
    }
    setFileName(file.name);
    pendingFile.current = file;
  }

  return (
    <div className="space-y-2">
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors"
        style={{
          borderColor: dragOver
            ? "#60A5FA"
            : "var(--color-border)",
          background: dragOver
            ? "color-mix(in srgb, #60A5FA 5%, transparent)"
            : "transparent",
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.tsv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <div className="text-[11px] text-[#9E9C97]">
          {fileName ? (
            <>
              <span style={{ color: "#60A5FA" }}>{fileName}</span>
              <span className="text-[#9E9C97]"> selected</span>
            </>
          ) : (
            "Drop TikTok CSV here or click to browse"
          )}
        </div>
        <div className="text-[9px] text-border-light mt-1">
          Supports: Apify, Piloterr, native TikTok exports
        </div>
      </div>

      {/* Upload button */}
      {fileName && (
        <button
          onClick={() => {
            if (pendingFile.current && !loading) {
              onUpload(pendingFile.current);
            }
          }}
          disabled={loading}
          className="w-full py-2 rounded-lg text-[11px] font-mono font-bold transition-colors"
          style={{
            background: loading
              ? "rgba(255,255,255,0.05)"
              : "#60A5FA",
            color: loading ? "var(--color-text-[#9E9C97])" : "#000",
          }}
        >
          {loading ? "Analyzing..." : "Upload & Analyze"}
        </button>
      )}

      {/* Last upload status */}
      {lastUpload && (
        <div className="text-[9px] text-[#9E9C97] font-mono">
          Last upload: {lastUpload.videoCount} videos &middot; Upload #{lastUpload.uploadCount}
        </div>
      )}
    </div>
  );
}
