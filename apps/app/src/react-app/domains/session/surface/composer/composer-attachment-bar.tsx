/** @jsxImportSource react */
import { File, FileArchive, FileAudio, FileCode, FileSpreadsheet, FileText, Film, Loader2, X } from "lucide-react";
import type { ComposerAttachment } from "@/app/types";

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(attachment: ComposerAttachment) {
  return attachment.kind === "image" || attachment.mimeType.startsWith("image/");
}

function AttachmentIcon({ attachment }: { attachment: ComposerAttachment }) {
  const name = attachment.name.toLowerCase();
  const mime = attachment.mimeType.toLowerCase();

  if (mime.includes("pdf") || name.endsWith(".pdf")) {
    return <FileText className="size-4 text-red-500 shrink-0" />;
  }
  if (mime.includes("video") || name.match(/\.(mp4|mov|avi|mkv|webm)$/)) {
    return <Film className="size-4 text-purple-500 shrink-0" />;
  }
  if (mime.includes("audio") || name.match(/\.(mp3|wav|m4a|ogg|aac|flac)$/)) {
    return <FileAudio className="size-4 text-pink-500 shrink-0" />;
  }
  if (name.match(/\.(xlsx|xls|csv|numbers)$/) || mime.includes("spreadsheet") || mime.includes("csv")) {
    return <FileSpreadsheet className="size-4 text-emerald-600 shrink-0" />;
  }
  if (name.match(/\.(zip|tar|gz|rar|7z|bz2)$/) || mime.includes("zip") || mime.includes("archive")) {
    return <FileArchive className="size-4 text-amber-500 shrink-0" />;
  }
  if (name.match(/\.(json|ts|tsx|js|jsx|py|html|css|md|yaml|yml|sql|rs|go|c|cpp|java|sh)$/)) {
    return <FileCode className="size-4 text-blue-500 shrink-0" />;
  }
  return <File className="size-4 text-muted-foreground shrink-0" />;
}

export function ComposerAttachmentChip({
  attachment,
  uploading,
  onRemove,
}: {
  attachment: ComposerAttachment;
  uploading?: boolean;
  onRemove?: () => void;
}) {
  const isImg = isImage(attachment);
  const sizeText = formatFileSize(attachment.size);

  return (
    <div
      className="group relative inline-flex items-center gap-2 rounded-xl border border-border/80 bg-background/90 px-2 py-1.5 shadow-xs transition-all hover:border-border hover:bg-accent/40"
      title={`${attachment.name} (${sizeText})`}
    >
      {isImg && attachment.previewUrl ? (
        <div className="relative size-7 shrink-0 overflow-hidden rounded-md border border-border/50 bg-muted">
          <img
            src={attachment.previewUrl}
            alt={attachment.name}
            className="size-full object-cover"
          />
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-xs">
              <Loader2 className="size-3.5 animate-spin text-white" />
            </div>
          )}
        </div>
      ) : (
        <div className="relative flex size-7 shrink-0 items-center justify-center rounded-md border border-border/50 bg-muted/60">
          <AttachmentIcon attachment={attachment} />
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/40 backdrop-blur-xs">
              <Loader2 className="size-3.5 animate-spin text-white" />
            </div>
          )}
        </div>
      )}

      <div className="flex min-w-0 flex-col pr-1">
        <span className="max-w-[140px] truncate text-[12px] font-medium leading-tight text-foreground sm:max-w-[180px]">
          {attachment.name}
        </span>
        {sizeText && (
          <span className="text-[10px] leading-tight text-muted-foreground">
            {sizeText}
          </span>
        )}
      </div>

      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="flex size-4.5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-hidden"
          aria-label="Remove attachment"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}

export function ComposerAttachmentBar({
  attachments,
  uploading,
  onRemove,
}: {
  attachments: ComposerAttachment[];
  uploading?: boolean;
  onRemove: (id: string) => void;
}) {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border/40 px-4 pb-2.5 pt-1">
      {attachments.map((attachment) => (
        <ComposerAttachmentChip
          key={attachment.id}
          attachment={attachment}
          uploading={uploading}
          onRemove={() => onRemove(attachment.id)}
        />
      ))}
    </div>
  );
}
