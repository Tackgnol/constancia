import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createNpcFact } from '@/api/generated/endpoints/npcs/npcs';
import type { CampaignNpcFact } from './block-registry';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const appendFactSchema = z.object({
  content: z.string().trim().min(1, 'Add a fact before filing it.'),
});

type AppendFactFormValues = z.infer<typeof appendFactSchema>;

export function AppendFactForm({
  campaignId,
  npcId,
  nextSortOrder,
  isDemoCampaign,
  onAppended,
  onError,
}: {
  campaignId: string;
  npcId: string;
  nextSortOrder: number;
  isDemoCampaign: boolean;
  onAppended: (fact: CampaignNpcFact) => void;
  onError: (message: string | null) => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AppendFactFormValues>({
    resolver: zodResolver(appendFactSchema),
    defaultValues: { content: '' },
  });

  const contentValue = watch('content');

  const onSubmit = async (values: AppendFactFormValues) => {
    try {
      onError(null);

      const content = values.content.trim();

      if (isDemoCampaign) {
        onAppended({
          id: `demo-fact-${crypto.randomUUID()}`,
          content,
          sortOrder: nextSortOrder,
          npcId,
          knownTo: [],
        });
        reset();
        return;
      }

      const response = await createNpcFact(
        { id: campaignId, npcId },
        { content, sortOrder: nextSortOrder },
        { credentials: 'include' },
      );

      onAppended({ ...response.data, knownTo: [] });
      reset();
    } catch (error) {
      console.error('Create NPC fact error:', error);
      onError('The new fact would not file cleanly. Try again.');
    }
  };

  return (
    <form className="npc-append-form" onSubmit={handleSubmit(onSubmit)} noValidate>
      <p className="detail-label">Append fact</p>
      <Textarea
        placeholder="One atomic secret, tell, or leverage point…"
        {...register('content')}
      />
      {errors.content ? <span className="form-error">{errors.content.message}</span> : null}
      <div className="npc-fact-actions">
        <Button type="submit" variant="outline" disabled={isSubmitting || !contentValue?.trim()}>
          {isSubmitting ? 'Filing…' : 'Add fact'}
        </Button>
        <span className="form-hint">Facts appended here become immediately revealable below.</span>
      </div>
    </form>
  );
}

