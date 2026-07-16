import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { postRouteAction } from '@/lib/route-action-client';
import type { CampaignNpcFact } from './block-registry';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const appendFactSchema = z.object({
  content: z.string().trim().min(1, 'Add a fact before filing it.'),
});

type AppendFactFormValues = z.infer<typeof appendFactSchema>;

export function AppendFactForm({
  actionPath,
  campaignId,
  npcId,
  nextSortOrder,
  isDemoCampaign,
  onAppended,
  onError,
}: {
  actionPath: string;
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

      const response = await postRouteAction<CampaignNpcFact>(actionPath, {
        intent: 'create-npc-fact',
        campaignId,
        npcId,
        payload: JSON.stringify({ content, sortOrder: nextSortOrder }),
      });

      if (response.status !== 'success' || !response.data) {
        throw new Error(response.message);
      }

      onAppended(response.data);
      reset();
    } catch (error) {
      console.error('Create NPC fact error:', error);
      onError(
        "We couldn't save this fact. Your text is still in the form; review it and try again.",
      );
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
