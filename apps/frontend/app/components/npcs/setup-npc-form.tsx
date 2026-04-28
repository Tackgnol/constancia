import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createNpc } from '@/api/generated/endpoints/npcs/npcs';
import type { CreateNpcBody } from '@/api/generated/model';
import { formFieldLabelClassName } from '@/components/forms/field-label';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { SystemBlockEditor } from './system-block-editor';
import { toApiBlocks } from './block-registry';

const setupNpcBaseSchema = z.object({
  name: z.string().trim().min(1, 'Give the NPC a name.'),
  imageUrl: z.union([z.literal(''), z.string().trim().url('Paste a valid direct image URL.')]),
  description: z.string().trim().min(1, 'Give the GM a useful read on who this NPC is.'),
});

const npcEditorBlockSchema = z.object({
  key: z.string(),
  blockType: z.string(),
  label: z.string(),
  valueText: z.string(),
});

const setupNpcFormSchema = setupNpcBaseSchema.extend({
  facts: z
    .array(z.object({ content: z.string().trim().min(1, 'Facts cannot be blank.') }))
    .min(1, 'Add at least one fact to the dossier.'),
  systemBlocks: z.array(npcEditorBlockSchema),
});

type SetupNpcFormValues = z.infer<typeof setupNpcFormSchema>;

const createDefaultValues = (): SetupNpcFormValues => ({
  name: '',
  imageUrl: '',
  description: '',
  facts: [{ content: '' }],
  systemBlocks: [],
});

export function SetupNpcForm({
  campaignId,
  systemId,
  isDemoCampaign,
  onSuccess,
  onError,
}: {
  campaignId: string;
  systemId: string;
  isDemoCampaign: boolean;
  onSuccess: (payload: { name: string; factCount: number }) => void;
  onError: (message: string | null) => void;
}) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { errors, isSubmitting, submitCount },
  } = useForm<SetupNpcFormValues>({
    resolver: zodResolver(setupNpcFormSchema),
    defaultValues: createDefaultValues(),
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'facts',
  });

  const factRootError = Array.isArray(errors.facts) ? undefined : errors.facts?.message;
  const hasValidationErrors = submitCount > 0 && Object.keys(errors).some((key) => key !== 'root');

  const onSubmit = async (values: SetupNpcFormValues) => {
    try {
      clearErrors('root');
      onError(null);

      const payload: CreateNpcBody = {
        name: values.name.trim(),
        description: values.description.trim(),
        facts: values.facts.map((fact, index) => ({
          content: fact.content.trim(),
          sortOrder: index,
        })),
        systemBlocks: toApiBlocks(systemId, values.systemBlocks),
      };

      const imageUrl = values.imageUrl.trim();
      if (imageUrl) {
        payload.imageUrl = imageUrl;
      }

      if (!isDemoCampaign) {
        await createNpc({ id: campaignId }, payload, { credentials: 'include' });
      }

      onSuccess({ name: payload.name, factCount: values.facts.length });
      reset(createDefaultValues());
    } catch (error) {
      console.error('Create NPC error:', error);
      const message = 'The dossier did not bind cleanly. Check the fields and try again.';
      setError('root.serverError', { type: 'manual', message });
      onError(message);
    }
  };

  return (
    <form className="event-form" onSubmit={handleSubmit(onSubmit)} noValidate>
      {hasValidationErrors ? (
        <div className="form-status form-status-error" role="alert">
          The dossier is not ready yet. Fix the highlighted fields before you bind it to the board.
        </div>
      ) : null}
      {errors.root?.serverError?.message ? (
        <div className="form-status form-status-error" role="alert">
          {errors.root.serverError.message}
        </div>
      ) : null}
      <div className="form-section">
        <div className="form-row">
          <div className="form-field form-field-grow">
            <Label htmlFor="npc-name" className={formFieldLabelClassName}>
              Name
            </Label>
            <Input
              id="npc-name"
              type="text"
              placeholder="Regent Sabine Vale"
              {...register('name')}
            />
            {errors.name ? <span className="form-error">{errors.name.message}</span> : null}
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="npc-description" className={formFieldLabelClassName}>
            Description
          </Label>
          <Textarea
            id="npc-description"
            placeholder="What they project, what they want, and why the room should fear the moment they speak."
            {...register('description')}
          />
          {errors.description ? (
            <span className="form-error">{errors.description.message}</span>
          ) : null}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="npc-image-url" className={formFieldLabelClassName}>
            Portrait URL <span className="form-optional">optional</span>
          </Label>
          <Input
            id="npc-image-url"
            type="url"
            placeholder="https://i.imgur.com/example.png"
            {...register('imageUrl')}
          />
          <span className="form-hint">
            No uploads in this panel. Host the portrait elsewhere — Imgur, Discord CDN, or a similar
            service — then paste the direct image URL.
          </span>
          {errors.imageUrl ? <span className="form-error">{errors.imageUrl.message}</span> : null}
        </div>
      </div>

      <div className="form-section">
        <Controller
          control={control}
          name="systemBlocks"
          render={({ field }) => (
            <SystemBlockEditor
              systemId={systemId}
              blocks={field.value ?? []}
              onChange={field.onChange}
            />
          )}
        />
      </div>

      <div className="form-section">
        <div className="setup-subsection-header">
          <div>
            <p className="detail-label">Facts</p>
            <p className="form-hint">
              Keep these atomic. Each line should be a single secret, leverage point, or tell.
            </p>
          </div>
          <Button
            className="ghost-action ghost-action-inline"
            type="button"
            variant="ghost"
            onClick={() => append({ content: '' })}
          >
            + Add Fact
          </Button>
        </div>

        <div className="npc-fact-stack">
          {fields.map((field, index) => (
            <div key={field.id} className="npc-fact-row">
              <div className="npc-fact-index">{String(index + 1).padStart(2, '0')}</div>
              <div className="grid gap-1.5 form-field-grow">
                <Textarea
                  placeholder="Keeps a ledger of every boon owed inside the chantry."
                  {...register(`facts.${index}.content` as const)}
                />
                {errors.facts?.[index]?.content ? (
                  <span className="form-error">{errors.facts[index]?.content?.message}</span>
                ) : null}
              </div>
              <Button
                type="button"
                variant="ghost"
                className="npc-fact-remove"
                onClick={() => remove(index)}
                disabled={fields.length === 1}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>

        {factRootError ? <span className="form-error">{factRootError}</span> : null}
      </div>

      <div className="form-actions">
        <button className="form-submit" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Binding dossier…' : 'Add NPC'}
        </button>
      </div>
    </form>
  );
}
