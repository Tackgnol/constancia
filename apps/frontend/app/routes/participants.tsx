import { useOutletContext, useFetcher } from 'react-router';
import { updateCharacter } from '@/api/generated/endpoints/characters/characters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { WarRoomContext } from '@/lib/war-room-data';
import type { ActionFunctionArgs } from 'react-router';
import type { ListCharacters200DataItem } from '@/api/generated/model';

export async function action({ request }: ActionFunctionArgs) {
  const cookie = request.headers.get('Cookie') || '';
  const formData = await request.formData();
  const campaignId = formData.get('campaignId') as string;
  const charId = formData.get('charId') as string;
  const gameName = formData.get('gameName') as string;

  if (!campaignId || !charId) return null;

  try {
    await updateCharacter(
      { id: campaignId, charId },
      { gameName },
      { credentials: 'include', headers: { cookie } },
    );
    return { status: 'success' };
  } catch (err) {
    console.error('Failed to update game name', err);
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
}: {
  char: ListCharacters200DataItem;
  discordName: string;
  currentGameName: string;
  campaignId: string;
}) {
  const fetcher = useFetcher();
  const isSaving = fetcher.state !== 'idle';

  return (
    <article className="detail-card flex flex-col gap-4">
      <div>
        <p className="detail-label">Discord User</p>
        <h2 className="text-lg font-bold">{discordName}</h2>
        <p className="text-[0.65rem] text-muted-foreground font-mono">{char.discordUserId}</p>
      </div>

      <fetcher.Form method="post" className="flex gap-2 items-end mt-2">
        <input type="hidden" name="charId" value={char.id} />
        <input type="hidden" name="campaignId" value={campaignId} />

        <div className="flex-1 grid gap-1.5">
          <Label
            htmlFor={`game-name-${char.id}`}
            className="text-muted-foreground text-[0.65rem] tracking-[0.18em] uppercase font-mono font-semibold"
          >
            In-Game Name
          </Label>
          <Input
            id={`game-name-${char.id}`}
            name="gameName"
            defaultValue={currentGameName}
            autoComplete="off"
            placeholder="Leave blank to use Discord name"
          />
        </div>
        <Button variant="outline" type="submit" disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </fetcher.Form>
    </article>
  );
}
