"use client";

import { useState, useRef } from "react";

interface ReferenceUploadProps {
  onUploadComplete: (result: { added: number; skippedDuplicates: number; totalEntries: number }) => void;
}

export default function ReferenceUpload({ onUploadComplete }: ReferenceUploadProps) {
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<{ added: number; skippedDuplicates: number; warnings: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("csv", file);

      const res = await fetch("/api/reference/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }

      const data = await res.json();
      setResult({
        added: data.added,
        skippedDuplicates: data.skippedDuplicates,
        warnings: data.warnings || [],
      });
      onUploadComplete({
        added: data.added,
        skippedDuplicates: data.skippedDuplicates,
        totalEntries: data.totalEntries,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    }

    setLoading(false);
  }

  return (
    <div className="bg-surface border border-border rounded-[10px] p-3.5">
      <div className="text-[9px] font-mono text-[#9E9C97] tracking-widest mb-2">
        UPLOAD REFERENCE CSV
      </div>

      <div
        onClick={() => fileRef.current?.click()}
        className="border border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors hover:border-accent"
        style={{ borderColor: "var(--color-border)" }}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.tsv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              setFileName(file.name);
              handleUpload(file);
            }
          }}
        />
        <div className="text-[10px] text-[#9E9C97]">
          {loading ? (
            "Uploading..."
          ) : fileName ? (
            <>
              <span style={{ color: "#60A5FA" }}>{fileName}</span>
            </>
          ) : (
            "Click to upload reference CSV (YouTube video data)"
          )}
        </div>
        <div className="text-[8px] text-border-light mt-0.5">
          Columns: url/title/channel/views/likes/comments/date/tags
        </div>
      </div>

      {result && (
        <div className="mt-2 text-[9px] font-mono">
          <span style={{ color: "var(--color-vrs-excellent)" }}>
            +{result.added} added
          </span>
          {result.skippedDuplicates > 0 && (
            <span className="text-[#9E9C97]">
              {" "}&middot; {result.skippedDuplicates} duplicates skipped
            </span>
          )}
          {result.warnings.map((w, i) => (
            <div key={i} className="text-[#9E9C97] mt-0.5">{w}</div>
          ))}
        </div>
      )}

      {error && (
        <div className="mt-2 text-[9px] font-mono" style={{ color: "var(--color-vrs-rework)" }}>
          {error}
        </div>
      )}
    </div>
  );
}
