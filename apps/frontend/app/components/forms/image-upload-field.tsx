import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { postRouteAction, type RouteActionResult } from '@/lib/route-action-client';

interface UploadImageActionData {
  assetId: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
}

function hasUploadImageData(
  response: RouteActionResult<UploadImageActionData>,
): response is RouteActionResult<UploadImageActionData> & {
  status: 'success';
  data: UploadImageActionData;
} {
  return response.status === 'success' && typeof response.data?.url === 'string';
}

export function ImageUploadField({
  id,
  value,
  onChange,
  actionPath,
  caption,
  placeholder = 'https://...',
  disabled = false,
  disabledReason = 'Uploads are unavailable in demo mode.',
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  actionPath: string;
  caption?: string;
  placeholder?: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  async function uploadSelectedFile(file: File | null): Promise<void> {
    if (!file || disabled) {
      return;
    }

    setUploadState('uploading');
    setUploadMessage(null);

    const response = await postRouteAction<UploadImageActionData>(actionPath, {
      intent: 'upload-image',
      file,
      caption: caption ?? '',
    });

    if (!hasUploadImageData(response)) {
      setUploadState('error');
      setUploadMessage(
        response.status === 'error'
          ? response.message
          : "We couldn't upload this image. Check the file and try again.",
      );
      return;
    }

    onChange(response.data.url);
    setUploadState('done');
    setUploadMessage('Uploaded');
  }

  return (
    <div className="grid gap-1.5">
      <Input
        id={id}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder={placeholder}
        type="text"
        value={value}
      />
      <div className="image-upload-row">
        <button
          className="image-upload-button"
          disabled={disabled || uploadState === 'uploading'}
          onClick={() => fileInputRef.current?.click()}
          type="button"
        >
          <Upload size={13} aria-hidden="true" />
          <span>{uploadState === 'uploading' ? 'Uploading' : 'Upload image'}</span>
        </button>
        <input
          ref={fileInputRef}
          accept="image/png,image/jpeg,image/webp"
          disabled={disabled || uploadState === 'uploading'}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0] ?? null;
            void uploadSelectedFile(file);
            event.currentTarget.value = '';
          }}
          type="file"
          className="sr-only"
        />
        {disabled ? (
          <span className="image-upload-status image-upload-status-disabled">{disabledReason}</span>
        ) : uploadMessage ? (
          <span className={`image-upload-status image-upload-status-${uploadState}`}>
            {uploadMessage}
          </span>
        ) : null}
      </div>
    </div>
  );
}
