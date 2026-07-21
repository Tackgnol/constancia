import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const sceneNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Give the scene a name.')
    .max(120, 'Keep the scene name under 120 characters.'),
});

type SceneFormValues = z.infer<typeof sceneNameSchema>;

export function SceneForm({
  submitLabel,
  pendingLabel,
  label,
  defaultName = '',
  pending,
  onSubmit,
  onCancel,
}: {
  submitLabel: string;
  pendingLabel: string;
  label: string;
  defaultName?: string;
  pending: boolean;
  onSubmit: (name: string) => Promise<unknown>;
  onCancel?: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SceneFormValues>({
    resolver: zodResolver(sceneNameSchema),
    defaultValues: { name: defaultName },
  });

  return (
    <form
      className="scene-form"
      noValidate
      onSubmit={handleSubmit(async (values) => {
        await onSubmit(values.name.trim());
        if (onCancel === undefined) {
          reset({ name: '' });
        }
      })}
    >
      <label className="detail-label" htmlFor="scene-name">
        {label}
      </label>
      <Input
        aria-invalid={errors.name ? true : undefined}
        autoComplete="off"
        id="scene-name"
        placeholder="Elysium"
        {...register('name')}
      />
      {errors.name ? (
        <span className="form-error" role="alert">
          {errors.name.message}
        </span>
      ) : null}
      <div className="scene-form-actions">
        <Button disabled={pending} type="submit" variant="outline">
          {pending ? pendingLabel : submitLabel}
        </Button>
        {onCancel ? (
          <Button disabled={pending} onClick={onCancel} type="button" variant="ghost">
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
