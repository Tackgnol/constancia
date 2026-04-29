import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useFetcher, useOutletContext } from 'react-router';
import { z } from 'zod';
import { updateCharacter } from '@constancia/api-client/endpoints/characters/characters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VTM_CLANS, MB_CLASSES } from '@constancia/systems';
import type { WarRoomContext } from '@/lib/war-room-data';
import type { ActionFunctionArgs } from 'react-router';
import type { ListCharacters200DataItem } from '@constancia/api-client/model';

const participantFormSchema = z.object({
  gameName: z.string().trim().max(80, 'Keep the in-game name concise.'),
  archetype: z.string().trim(),
});

type ParticipantFormValues = z.infer<typeof participantFormSchema>;

export async function action({ request }: ActionFunctionArgs) {
  const cookie = request.headers.get('Cookie') || '';
  const formData = await request.formData();
  const campaignId = formData.get('campaignId') as string;
  const charId = formData.get('charId') as string;
  const gameName = formData.get('gameName') as string;
  const archetype = formData.get('archetype') as string;
  const systemDataRaw = formData.get('systemData') as string;

  if (!campaignId || !charId) return null;

  try {
    const systemData = systemDataRaw ? JSON.parse(systemDataRaw) : {};
    if (archetype) {
      systemData.clan = archetype;
    }

    await updateCharacter(
      { id: campaignId, charId },
      { gameName, systemData },
      { credentials: 'include', headers: { cookie } },
    );
    return { status: 'success' };
  } catch (err) {
    console.error('Failed to update character', err);
    return { status: 'error' };
  }
}

export default function ParticipantsRoute() {
  const warRoom = useOutletContext<WarRoomContext>();

  const getFallbackName = (char: ListCharacters200DataItem) => {
    return char.discordName || char.name;
  };

  return (
    <div className="mode-route">
      <section className="hero-strip hero-strip-compact">
        <div>
          <p className="eyebrow">Participants</p>
          <h1>Campaign Roster</h1>
          <p className="hero-copy">
            Manage the participants connected via Discord. Set their in-game name to overwrite their
            Discord handle in the sidebar.
          </p>
        </div>
      </section>

      <section className="detail-stack flex flex-col gap-4 max-w-2xl px-6">
        {warRoom.rawCharacters.length === 0 ? (
          <p className="text-muted-foreground p-4">
            No participants connected yet. Run <code>/participants add @user</code> in Discord.
          </p>
        ) : (
          warRoom.rawCharacters.map((char) => {
            const discordName = getFallbackName(char);
            const currentGameName = char.gameName || '';

            return (
              <ParticipantRow
                key={char.id}
                char={char}
                discordName={discordName}
                currentGameName={currentGameName}
                campaignId={warRoom.campaign.id}
                gameSystemId={warRoom.system.id}
              />
            );
          })
        )}
      </section>
    </div>
  );
}

function ParticipantRow({
  char,
  discordName,
  currentGameName,
  campaignId,
  gameSystemId,
}: {
  char: ListCharacters200DataItem;
  discordName: string;
  currentGameName: string;
  campaignId: string;
  gameSystemId: string;
}) {
  const fetcher = useFetcher();
  const isSaving = fetcher.state !== 'idle';

  const archetypes = gameSystemId === 'mork-borg' ? MB_CLASSES : VTM_CLANS;
  const systemData = (char.systemData as Record<string, unknown>) || {};
  const currentArchetype = (systemData.clan as string) || '';

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<ParticipantFormValues>({
    resolver: zodResolver(participantFormSchema),
    defaultValues: {
      gameName: currentGameName,
      archetype: currentArchetype,
    },
  });

  useEffect(() => {
    reset({
      gameName: currentGameName,
      archetype: currentArchetype,
    });
  }, [currentArchetype, currentGameName, reset]);

  const selectedArchetypeName = watch('archetype');
  const selectedArchetype = archetypes.find((a) => a.name === selectedArchetypeName);

  const onSubmit = (values: ParticipantFormValues) => {
    fetcher.submit(
      {
        charId: char.id,
        campaignId,
        systemData: JSON.stringify(systemData),
        gameName: values.gameName.trim(),
        archetype: values.archetype,
      },
      { method: 'post' },
    );
  };

  return (
    <article className="detail-card flex flex-col gap-6">
      <div className="flex justify-between items-start">
        <div>
          <p className="detail-label">Discord User</p>
          <h2 className="text-xl font-bold">{discordName}</h2>
          <p className="text-[0.65rem] text-muted-foreground font-mono">{char.discordUserId}</p>
        </div>

        {selectedArchetype && (
          <div className="flex items-center gap-3 bg-surface-high/50 p-2 rounded-lg border border-border/50">
            <div className="w-10 h-10 flex items-center justify-center bg-black/20 rounded overflow-hidden">
              <img
                src={`/icons/${selectedArchetype.icon}`}
                alt=""
                className="w-8 h-8 object-contain opacity-80"
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
            </div>
            <div>
              <p className="text-[0.6rem] uppercase tracking-widest text-muted-foreground font-bold">
                {gameSystemId === 'mork-borg' ? 'Class' : 'Clan'}
              </p>
              <p className="text-sm font-bold text-primary-glow">{selectedArchetype.name}</p>
            </div>
          </div>
        )}
      </div>

      <form className="grid gap-6" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="grid gap-1.5">
            <Label
              htmlFor={`game-name-${char.id}`}
              className="text-muted-foreground text-[0.65rem] tracking-[0.18em] uppercase font-mono font-semibold"
            >
              In-Game Name
            </Label>
            <Input
              id={`game-name-${char.id}`}
              autoComplete="off"
              placeholder="Discord name fallback"
              {...register('gameName')}
            />
            {errors.gameName ? <span className="form-error">{errors.gameName.message}</span> : null}
          </div>

          <div className="grid gap-1.5">
            <Label
              htmlFor={`archetype-${char.id}`}
              className="text-muted-foreground text-[0.65rem] tracking-[0.18em] uppercase font-mono font-semibold"
            >
              {gameSystemId === 'mork-borg' ? 'Character Class' : 'Vampire Clan'}
            </Label>
            <Controller
              control={control}
              name="archetype"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id={`archetype-${char.id}`} className="w-full">
                    <SelectValue placeholder="Select Archetype" />
                  </SelectTrigger>
                  <SelectContent>
                    {archetypes.map((a) => (
                      <SelectItem key={a.name} value={a.name}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.archetype ? (
              <span className="form-error">{errors.archetype.message}</span>
            ) : null}
          </div>
        </div>

        {selectedArchetype && (
          <div className="bg-muted/30 p-4 rounded-md border border-border/20">
            <p className="text-xs leading-relaxed text-muted-foreground italic">
              &ldquo;{selectedArchetype.description}&rdquo;
            </p>
          </div>
        )}

        <div className="flex justify-end">
          <div className="sheet-row-actions">
            <Button asChild variant="ghost">
              <Link to={`/participants/${char.id}`}>Open Sheet</Link>
            </Button>
            <Button variant="outline" type="submit" disabled={isSaving} className="min-w-25">
              {isSaving ? 'Saving...' : 'Update Participant'}
            </Button>
          </div>
        </div>
      </form>
    </article>
  );
}
