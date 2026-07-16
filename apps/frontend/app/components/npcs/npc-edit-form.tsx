import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { UpdateNpcBody } from '@constancia/api-client/model';
import { formFieldLabelClassName } from '@/components/forms/field-label';
import { ImageUploadField } from '@/components/forms/image-upload-field';
import { postRouteAction } from '@/lib/route-action-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SystemBlockEditor } from './system-block-editor';
import { toApiBlocks, toEditorBlocks, type CampaignNpc } from './block-registry';

const editSchema = z.object({
  name: z.string().trim().min(1, 'Give the NPC a name.'),
  imageUrl: z.union([z.literal(''), z.string().trim().url('Paste a valid direct image URL.')]),
  description: z.string().trim().min(1, 'Give the GM a useful read on who this NPC is.'),
  systemBlocks: z.array(
    z.object({
      key: z.string(),
      blockType: z.string(),
      label: z.string(),
      valueText: z.string(),
    }),
  ),
});

type EditDraft = z.infer<typeof editSchema>;

function buildDefaultValues(systemId: string, npc: CampaignNpc): EditDraft {
  return {
    name: npc.name,
    imageUrl: npc.imageUrl ?? '',
    description: npc.description,
    systemBlocks: toEditorBlocks(systemId, npc.systemBlocks),
  };
}

function asNpcSystemBlocks(input: unknown): CampaignNpc['systemBlocks'] {
  return Array.isArray(input) ? (input as CampaignNpc['systemBlocks']) : [];
}

export function NpcEditForm({
  actionPath,
  campaignId,
  systemId,
  npc,
  isDemoCampaign,
  onCancel,
  onSaved,
  onError,
}: {
  actionPath: string;
  campaignId: string;
  systemId: string;
  npc: CampaignNpc;
  isDemoCampaign: boolean;
  onCancel: () => void;
  onSaved: (npc: CampaignNpc) => void;
  onError: (message: string | null) => void;
}) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EditDraft>({
    resolver: zodResolver(editSchema),
    defaultValues: buildDefaultValues(systemId, npc),
  });

  useEffect(() => {
    reset(buildDefaultValues(systemId, npc));
  }, [npc, reset, systemId]);

  const onSubmit = async (values: EditDraft) => {
    try {
      onError(null);

      const name = values.name.trim();
      const description = values.description.trim();
      const payload: UpdateNpcBody = {
        name,
        description,
        systemBlocks: toApiBlocks(systemId, values.systemBlocks),
      };

      const trimmedImageUrl = values.imageUrl.trim();
      if (trimmedImageUrl) {
        payload.imageUrl = trimmedImageUrl;
      }

      if (isDemoCampaign) {
        onSaved({
          ...npc,
          name,
          description,
          imageUrl: payload.imageUrl,
          systemBlocks: toApiBlocks(systemId, values.systemBlocks),
        });
        return;
      }

      const response = await postRouteAction<{
        name?: string;
        description?: string;
        imageUrl?: string | null;
        systemBlocks?: unknown;
      }>(actionPath, {
        intent: 'update-npc',
        campaignId,
        npcId: npc.id,
        payload: JSON.stringify(payload),
      });

      if (response.status !== 'success' || !response.data) {
        throw new Error(response.message);
      }

      onSaved({
        ...npc,
        ...response.data,
        imageUrl: response.data.imageUrl ?? undefined,
        systemBlocks: asNpcSystemBlocks(response.data.systemBlocks),
      });
    } catch (error) {
      console.error('Update NPC error:', error);
      onError('The dossier update did not hold. Check the fields and try again.');
    }
  };

  return (
    <form className="npc-edit-form detail-card" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="setup-subsection-header">
        <div>
          <p className="detail-label">Edit dossier</p>
          <p className="form-hint">Refit the block stack without leaving the board.</p>
        </div>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel changes
        </Button>
      </div>

      <div className="form-section">
        <div className="grid gap-1.5">
          <Label htmlFor={`npc-edit-name-${npc.id}`} className={formFieldLabelClassName}>
            Name
          </Label>
          <Input id={`npc-edit-name-${npc.id}`} {...register('name')} />
          {errors.name ? <span className="form-error">{errors.name.message}</span> : null}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={`npc-edit-description-${npc.id}`} className={formFieldLabelClassName}>
            Description
          </Label>
          <Textarea id={`npc-edit-description-${npc.id}`} {...register('description')} />
          {errors.description ? (
            <span className="form-error">{errors.description.message}</span>
          ) : null}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={`npc-edit-image-${npc.id}`} className={formFieldLabelClassName}>
            Portrait URL <span className="form-optional">optional</span>
          </Label>
          <Controller
            control={control}
            name="imageUrl"
            render={({ field }) => (
              <ImageUploadField
                id={`npc-edit-image-${npc.id}`}
                actionPath={actionPath}
                disabled={isDemoCampaign}
                onChange={field.onChange}
                value={field.value}
              />
            )}
          />
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

      <div className="form-actions form-action-dock">
        <button className="form-submit" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving dossier…' : 'Save dossier'}
        </button>
      </div>
    </form>
  );
}
