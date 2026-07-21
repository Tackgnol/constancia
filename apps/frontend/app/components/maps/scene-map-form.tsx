import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const sceneMapSchema = z.object({
  file: z
    .custom<FileList | null>()
    .refine((list) => (list?.length ?? 0) === 1, 'Choose one image file.'),
});

type SceneMapFormValues = z.infer<typeof sceneMapSchema>;

export function SceneMapForm({
  sceneName,
  hasMap,
  pending,
  quotaWarning,
  onReplace,
  onRemove,
}: {
  sceneName: string;
  hasMap: boolean;
  pending: boolean;
  quotaWarning: string | null;
  onReplace: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SceneMapFormValues>({
    resolver: zodResolver(sceneMapSchema),
    defaultValues: { file: null },
  });

  return (
    <form
      className="scene-map-form"
      noValidate
      onSubmit={handleSubmit(async (values) => {
        const file = values.file?.[0];
        if (file) {
          await onReplace(file);
          reset({ file: null });
        }
      })}
    >
      <label className="detail-label" htmlFor="scene-map-file">
        {hasMap ? 'Replace map image' : 'Upload map image'}
      </label>
      <Input
        accept="image/*"
        aria-describedby="scene-map-hint"
        aria-invalid={errors.file ? true : undefined}
        id="scene-map-file"
        type="file"
        {...register('file')}
      />
      {errors.file ? (
        <span className="form-error" role="alert">
          {errors.file.message}
        </span>
      ) : null}

      <p className="form-hint" id="scene-map-hint">
        {hasMap
          ? `Replacing the map for ${sceneName} keeps every peg where it is. Pegs are stored as a share of the image, not in pixels.`
          : `Upload the map for ${sceneName}. Pegs you place later are stored as a share of the image, so they survive a replacement.`}
      </p>

      {quotaWarning ? (
        <p className="form-hint" role="status">
          {quotaWarning}
        </p>
      ) : null}

      <div className="scene-form-actions">
        <Button disabled={pending} type="submit" variant="outline">
          {pending ? 'Uploading…' : hasMap ? 'Replace map' : 'Upload map'}
        </Button>
        {hasMap ? (
          <Button disabled={pending} onClick={() => void onRemove()} type="button" variant="ghost">
            Remove map
          </Button>
        ) : null}
      </div>
    </form>
  );
}
