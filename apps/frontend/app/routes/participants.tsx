import { useEffect, useState } from 'react';
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
import { ManagementWorkspace } from '@/components/layout/management-workspace';
import { formFieldLabelClassName } from '@/components/forms/field-label';

const participantFormSchema = z.object({
  gameName: z.string().trim().max(80, 'Keep the in-game name concise.'),
  archetype: z.string().trim(),
});

type ParticipantFormValues = z.infer<typeof participantFormSchema>;

export async function action({ request }: ActionFunctionArgs) {
  const cookie = request.headers.get('Cookie') || '';
  const formData = await request.formData();
  const readString = (key: string) => {
    const value = formData.get(key);
    return typeof value === 'string' ? value : '';
  };
  const campaignId = readString('campaignId');
  const charId = readString('charId');
  const gameName = readString('gameName');
  const archetype = readString('archetype');
  const systemDataRaw = readString('systemData');

  if (!campaignId || !charId) return null;

  try {
    const parsedSystemData: unknown = systemDataRaw ? JSON.parse(systemDataRaw) : {};
    const systemData: Record<string, unknown> =
      typeof parsedSystemData === 'object' &&
      parsedSystemData !== null &&
      !Array.isArray(parsedSystemData)
        ? { ...parsedSystemData }
        : {};
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
    <ManagementWorkspace
      eyebrow="Participants"
      title="Campaign participants"
      description="Match Discord identities to their in-game names and system archetypes."
      meta={
        <div className="participant-roster-meta">
          <p className="detail-label">Participant state</p>
          <strong>{warRoom.rawCharacters.length} connected</strong>
          <span>
            {warRoom.players.filter((player) => player.status === 'online').length} online now
          </span>
        </div>
      }
    >
      <section className="participant-roster">
        {warRoom.rawCharacters.length === 0 ? (
          <div className="detail-card participant-empty-state">
            <p className="detail-label">No participants connected</p>
            <p>
              Run <code>/participants add @user</code> in Discord to add the first player.
            </p>
          </div>
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
                actionPath={warRoom.demoMode ? '/demo/participants' : '/participants'}
                demoMode={warRoom.demoMode === true}
              />
            );
          })
        )}
      </section>
    </ManagementWorkspace>
  );
}

function ParticipantRow({
  char,
  discordName,
  currentGameName,
  campaignId,
  gameSystemId,
  actionPath,
  demoMode,
}: {
  char: ListCharacters200DataItem;
  discordName: string;
  currentGameName: string;
  campaignId: string;
  gameSystemId: string;
  actionPath: string;
  demoMode: boolean;
}) {
  const fetcher = useFetcher<typeof action>();
  const [demoMessage, setDemoMessage] = useState<string | null>(null);
  const isSaving = !demoMode && fetcher.state !== 'idle';

  const archetypes = gameSystemId === 'mork-borg' ? MB_CLASSES : VTM_CLANS;
  const systemData: Record<string, unknown> = { ...(char.systemData ?? {}) };
  const currentArchetype = typeof systemData.clan === 'string' ? systemData.clan : '';

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
    if (demoMode) {
      reset(values);
      setDemoMessage(`${values.gameName.trim() || discordName} updated locally for this demo.`);
      return;
    }

    setDemoMessage(null);
    fetcher.submit(
      {
        charId: char.id,
        campaignId,
        systemData: JSON.stringify(systemData),
        gameName: values.gameName.trim(),
        archetype: values.archetype,
      },
      { action: actionPath, method: 'post' },
    );
  };

  const saveMessage = demoMessage
    ? demoMessage
    : fetcher.data?.status === 'success'
      ? 'Participant updated.'
      : fetcher.data?.status === 'error'
        ? "We couldn't update this participant. Your changes are still in the form; review them and try again."
        : null;

  return (
    <article className="detail-card participant-card">
      <header className="participant-card-header">
        <div className="participant-identity">
          <p className="detail-label">Discord identity</p>
          <h2>{discordName}</h2>
          <p>{char.discordUserId}</p>
        </div>

        {selectedArchetype && (
          <div className="participant-archetype">
            <div className="participant-archetype-icon">
              <span aria-hidden="true">{selectedArchetype.name.slice(0, 2).toUpperCase()}</span>
            </div>
            <div>
              <p className="detail-label">{gameSystemId === 'mork-borg' ? 'Class' : 'Clan'}</p>
              <strong>{selectedArchetype.name}</strong>
            </div>
          </div>
        )}
      </header>

      <form className="participant-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="participant-form-grid">
          <div className="grid gap-1.5">
            <Label htmlFor={`game-name-${char.id}`} className={formFieldLabelClassName}>
              In-game name
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
            <Label htmlFor={`archetype-${char.id}`} className={formFieldLabelClassName}>
              {gameSystemId === 'mork-borg' ? 'Character class' : 'Vampire clan'}
            </Label>
            <Controller
              control={control}
              name="archetype"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id={`archetype-${char.id}`} className="w-full">
                    <SelectValue placeholder="Select archetype" />
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
          <div className="participant-archetype-note">
            <p>{selectedArchetype.description}</p>
          </div>
        )}

        <div className="participant-form-footer">
          {saveMessage ? (
            <p
              className={`participant-save-message${fetcher.data?.status === 'error' ? ' is-error' : ''}`}
              role="status"
            >
              {saveMessage}
            </p>
          ) : (
            <span />
          )}
          <div className="sheet-row-actions">
            <Button asChild variant="ghost">
              <Link to={demoMode ? '/demo/player/sheet' : `/participants/${char.id}`}>
                {demoMode ? 'Preview player view' : 'Open sheet'}
              </Link>
            </Button>
            <Button variant="outline" type="submit" disabled={isSaving} className="min-w-25">
              {isSaving ? 'Saving…' : 'Update participant'}
            </Button>
          </div>
        </div>
      </form>
    </article>
  );
}
