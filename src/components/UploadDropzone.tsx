import { useCallback, useRef, useState, type DragEvent } from "react";
import { FileUp } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MAX_PDF_BYTES = 20 * 1024 * 1024;

export function validatePdf(file: File): string | null {
  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return "Only PDF files are supported.";
  if (file.size > MAX_PDF_BYTES) return "PDF is too large — the limit is 20 MB.";
  if (file.size === 0) return "This file is empty.";
  return null;
}

export function UploadDropzone({
  onFile,
  compact,
  className,
}: {
  onFile: (file: File) => void;
  compact?: boolean;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      const error = validatePdf(file);
      if (error) {
        toast.error(error);
        return;
      }
      onFile(file);
    },
    [onFile],
  );

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Select a PDF to upload"
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        "group cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-200",
        "border-input hover:border-primary/60 hover:bg-primary/5",
        dragging && "border-primary bg-primary/10 scale-[1.01]",
        compact ? "p-5" : "p-10 sm:p-14",
        className,
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <div className="flex flex-col items-center gap-3 text-center">
        <div
          className={cn(
            "grid place-items-center rounded-2xl bg-primary/12 text-primary ring-1 ring-primary/25 transition-transform duration-200 group-hover:scale-105",
            compact ? "size-10" : "size-16",
          )}
        >
          <FileUp className={compact ? "size-5" : "size-8"} strokeWidth={1.8} />
        </div>
        <div>
          <p className={cn("font-display font-semibold text-foreground", compact ? "text-sm" : "text-xl")}>
            Select a PDF
          </p>
          <p className={cn("mt-1 text-muted-foreground", compact ? "text-xs" : "text-sm")}>
            Drag &amp; drop your contract here, or click to browse — PDF up to 20 MB
          </p>
        </div>
      </div>
    </div>
  );
}
