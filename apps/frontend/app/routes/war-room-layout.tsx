import {
  listCampaigns,
  updateCampaign,
} from '@constancia/api-client/endpoints/campaigns/campaigns';
import { listChannels } from '@constancia/api-client/endpoints/channels/channels';
import { listCharacters } from '@constancia/api-client/endpoints/characters/characters';
import { listEvents } from '@constancia/api-client/endpoints/events/events';
import { listQuests, listSessionSummaries } from '@constancia/api-client/endpoints/journal/journal';
import { listLoreEntries } from '@constancia/api-client/endpoints/lore/lore';
import { sendChannelMessage } from '@constancia/api-client/endpoints/messages/messages';
import { getServiceHealth } from '@constancia/api-client/endpoints/meta/meta';
import { listGameSystems } from '@constancia/api-client/endpoints/systems/systems';
import { WarRoomModeTabs } from '@/components/war-room/mode-tabs';
import { GameDateControl } from '@/components/war-room/game-date-control';
import { PlayerRail } from '@/components/war-room/player-rail';
import { QuickNarrationForm } from '@/components/war-room/quick-narration-form';
import { quickNarrationActivityLabel } from '@/components/war-room/quick-narration';
import { SceneRailExtras } from '@/components/war-room/scene-rail-extras';
import { buildWarRoomModeTabs } from '@/components/war-room/war-room-navigation';
import { assertApiOk, getApiErrorMessage } from '@/lib/api-errors';
import { buildServerApiOptions } from '@/lib/api-proxy.server';
import { postRouteAction } from '@/lib/route-action-client';
import {
  CAMPAIGN_RENAME_ERROR,
  GAME_DATE_UPDATE_ERROR,
  QUICK_NARRATION_ERROR,
} from '@/lib/war-room-feedback';
import type { GameDate } from '@constancia/contracts';
import { parseGameDate } from '@constancia/systems';
import type { PlayerPresence } from '@/lib/war-room-data';
import {
  activityFeed,
  fallbackCampaign,
  fallbackSystem,
  normalizeCampaigns,
  normalizeSystems,
  players,
  type WarRoomContext,
} from '@/lib/war-room-data';
import { useEffect, useState } from 'react';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import {
  Form,
  Outlet,
  redirect,
  useFetcher,
  useLoaderData,
  useLocation,
  useRevalidator,
} from 'react-router';

export async function loader({ request }: LoaderFunctionArgs) {
  const fetchOpts: RequestInit = {
    credentials: 'include',
    headers: {
      cookie: request.headers.get('Cookie') || '',
    },
  };

  const [health, campaigns, systems] = await Promise.all([
    getServiceHealth(fetchOpts),
    listCampaigns(fetchOpts),
    listGameSystems(fetchOpts),
  ]);

  if (campaigns.status !== 'ok') {
    throw redirect('/auth');
  }

  const campaignId = campaigns.data[0]?.id;
  const [channels, events, characters, quests, summaries, lore] = campaignId
    ? await Promise.all([
        listChannels({ id: campaignId }, fetchOpts),
        listEvents({ id: campaignId }, fetchOpts),
        listCharacters({ id: campaignId }, fetchOpts),
        listQuests({ id: campaignId }, fetchOpts),
        listSessionSummaries({ id: campaignId }, fetchOpts),
        listLoreEntries({ id: campaignId }, fetchOpts),
      ])
    : [
        { status: 'error', data: [] },
        { status: 'error', data: [] },
        { status: 'error', data: [] },
        { status: 'error', data: [] },
        { status: 'error', data: [] },
        { status: 'error', data: [] },
      ];

  return { health, campaigns, systems, channels, events, characters, quests, summaries, lore };
}

type CampaignActionData = { status: 'success' } | { status: 'error'; message: string };

function isCampaignActionData(value: unknown): value is CampaignActionData {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    ((value as { status?: unknown }).status === 'success' ||
      ((value as { status?: unknown }).status === 'error' &&
        typeof (value as { message?: unknown }).message === 'string'))
  );
}

function parseSubmittedGameDate(value: FormDataEntryValue | null): GameDate | null {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(value);
    return parseGameDate(parsed);
  } catch {
    return null;
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get('intent');
  const campaignId = formData.get('campaignId');

  if (intent === 'set-game-date') {
    const gameDate = parseSubmittedGameDate(formData.get('gameDate'));
    if (typeof campaignId !== 'string' || campaignId.length === 0 || gameDate === null) {
      return Response.json(
        { status: 'error', message: 'Choose a complete, valid game date and try again.' },
        { status: 400 },
      );
    }

    try {
      const response = await updateCampaign(
        { id: campaignId },
        { gameDate },
        buildServerApiOptions(request),
      );
      assertApiOk(response, GAME_DATE_UPDATE_ERROR);
      return Response.json({ status: 'success' });
    } catch (caught) {
      return Response.json(
        { status: 'error', message: getApiErrorMessage(caught, GAME_DATE_UPDATE_ERROR) },
        { status: 500 },
      );
    }
  }

  if (intent === 'send-channel-message') {
    const channelId = formData.get('channelId');
    const content = formData.get('content');
    const idempotencyKey = formData.get('idempotencyKey');

    if (
      typeof campaignId !== 'string' ||
      campaignId.length === 0 ||
      typeof channelId !== 'string' ||
      channelId.length === 0 ||
      typeof content !== 'string' ||
      content.trim().length < 8 ||
      content.trim().length > 240 ||
      typeof idempotencyKey !== 'string' ||
      idempotencyKey.length === 0
    ) {
      return Response.json(
        {
          status: 'error',
          message:
            "We couldn't read this narration. Keep it between 8 and 240 characters, then try again.",
        },
        { status: 400 },
      );
    }

    try {
      const apiOptions = buildServerApiOptions(request);
      const response = await sendChannelMessage(
        { id: campaignId },
        { channelId, content: content.trim() },
        {
          ...apiOptions,
          headers: {
            ...apiOptions.headers,
            'idempotency-key': idempotencyKey,
          },
        },
      );
      assertApiOk(response, QUICK_NARRATION_ERROR);
      return Response.json({ status: 'success' });
    } catch (caught) {
      return Response.json(
        { status: 'error', message: getApiErrorMessage(caught, QUICK_NARRATION_ERROR) },
        { status: 500 },
      );
    }
  }

  const name = formData.get('name');

  if (intent !== 'rename-campaign') {
    return Response.json(
      { status: 'error', message: 'Unsupported campaign action.' },
      { status: 400 },
    );
  }

  if (
    typeof campaignId !== 'string' ||
    campaignId.length === 0 ||
    typeof name !== 'string' ||
    name.trim().length === 0
  ) {
    return Response.json(
      {
        status: 'error',
        message: "We couldn't read the campaign name. Keep editing it, then try again.",
      },
      { status: 400 },
    );
  }

  try {
    const response = await updateCampaign(
      { id: campaignId },
      { name: name.trim() },
      buildServerApiOptions(request),
    );
    assertApiOk(response, CAMPAIGN_RENAME_ERROR);
    return Response.json({ status: 'success' });
  } catch (caught) {
    return Response.json(
      {
        status: 'error',
        message: getApiErrorMessage(caught, CAMPAIGN_RENAME_ERROR),
      },
      { status: 500 },
    );
  }
}

const tabs = buildWarRoomModeTabs('');

function formatActivityTime() {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
}

export default function WarRoomLayout() {
  const location = useLocation();
  const { health, campaigns, systems, channels, events, characters, quests, summaries, lore } =
    useLoaderData<typeof loader>();
  const renameFetcher = useFetcher<CampaignActionData>();
  const gameDateFetcher = useFetcher<CampaignActionData>();
  const revalidator = useRevalidator();

  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [activity, setActivity] = useState(activityFeed);
  const [isEditingName, setIsEditingName] = useState(false);
  const [mobilePlayersOpen, setMobilePlayersOpen] = useState(false);

  const liveCampaign = normalizeCampaigns(campaigns).at(0) ?? fallbackCampaign;
  const normalizedSystems = normalizeSystems(systems);
  const liveSystem =
    normalizedSystems.find((system) => system.id === liveCampaign.gameSystemId) ??
    normalizedSystems.at(0) ??
    fallbackSystem;
  const [editNameValue, setEditNameValue] = useState(liveCampaign.name);

  const liveChannels = (channels.status === 'ok' ? channels.data : []).map((ch) => ({
    id: ch.id,
    discordId: ch.discordChannelId,
    name: ch.name,
  }));

  const liveEvents = events.status === 'ok' ? events.data : [];
  const liveQuests = quests.status === 'ok' ? quests.data : [];
  const liveSummaries = summaries.status === 'ok' ? summaries.data : [];
  const liveLore = lore.status === 'ok' ? lore.data : [];
  const isPlayRoute = location.pathname === '/';
  const tagEventCounts = new Map<string, number>();
  for (const event of liveEvents) {
    tagEventCounts.set(event.channelId, (tagEventCounts.get(event.channelId) ?? 0) + 1);
  }

  const liveCharacters = characters.status === 'ok' ? characters.data : [];
  const livePlayers: PlayerPresence[] = liveCharacters.map((char) => {
    const systemData = char.systemData as Record<string, unknown> | undefined;
    const clan = typeof systemData?.clan === 'string' ? systemData.clan : 'Unknown';
    const discordName = (char as Record<string, unknown>).discordName as string | undefined;
    const gameName = (char as Record<string, unknown>).gameName as string | undefined;

    return {
      id: char.id,
      name: gameName || discordName || char.name, // game name when set, else discord name
      character: clan,
      player: discordName || char.name, // always the Discord display name
      status: 'online',
    };
  });

  const renameActionData = isCampaignActionData(renameFetcher.data)
    ? renameFetcher.data
    : undefined;
  const renameError = renameActionData?.status === 'error' ? renameActionData.message : null;
  const gameDateActionData = isCampaignActionData(gameDateFetcher.data)
    ? gameDateFetcher.data
    : undefined;
  const gameDateError = gameDateActionData?.status === 'error' ? gameDateActionData.message : null;
  const activeCalendarId = liveCampaign.gameDate?.calendarId ?? liveSystem.defaultCalendarId;
  const activeCalendar = liveSystem.calendars[activeCalendarId];

  const recordActivity = (label: string) => {
    setActivity((current) => [
      {
        id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        time: formatActivityTime(),
        label,
      },
      ...current,
    ]);
  };

  useEffect(() => {
    if (!isEditingName) {
      setEditNameValue(liveCampaign.name);
    }
  }, [isEditingName, liveCampaign.name]);

  useEffect(() => {
    if (renameActionData?.status === 'success') {
      setIsEditingName(false);
      revalidator.revalidate();
    }
  }, [renameActionData, revalidator]);

  const submitCampaignName = () => {
    const trimmed = editNameValue.trim();
    if (trimmed.length === 0 || trimmed === liveCampaign.name || renameFetcher.state !== 'idle') {
      if (trimmed === liveCampaign.name) {
        setIsEditingName(false);
      }
      return;
    }

    renameFetcher.submit(
      {
        intent: 'rename-campaign',
        campaignId: liveCampaign.id,
        name: trimmed,
      },
      { method: 'post' },
    );
  };

  const outletContext: WarRoomContext = {
    campaign: {
      ...liveCampaign,
      connectedPlayers: livePlayers.length,
    },
    channels: liveChannels,
    system: liveSystem,
    tags: liveChannels.map((ch) => ({ id: ch.id, label: `# ${ch.name}` })),
    activeTag,
    players: livePlayers.length > 0 ? livePlayers : players,
    rawCharacters: liveCharacters.length > 0 ? liveCharacters : [],
    activity,
    apiOnline: health.status === 'ok',
    events: liveEvents,
    quests: liveQuests,
    summaries: liveSummaries,
    lore: liveLore,
    recordActivity,
  };

  return (
    <div className={`war-room-shell ${isPlayRoute ? 'is-live-play' : 'is-management'}`}>
      <header className="topbar">
        <div className="topbar-group">
          {isEditingName ? (
            <form
              className="campaign-name-form"
              onSubmit={(event) => {
                event.preventDefault();
                submitCampaignName();
              }}
            >
              <input
                aria-describedby={renameError ? 'campaign-name-error' : undefined}
                aria-invalid={renameError ? true : undefined}
                aria-label="Campaign name"
                className="campaign-name-input"
                onChange={(event) => {
                  setEditNameValue(event.target.value);
                  if (renameError) {
                    renameFetcher.reset();
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    setEditNameValue(liveCampaign.name);
                    setIsEditingName(false);
                  }
                }}
                value={editNameValue}
              />
              <button
                className="campaign-name-action"
                disabled={renameFetcher.state !== 'idle'}
                type="submit"
              >
                {renameFetcher.state === 'idle' ? 'Save' : 'Saving…'}
              </button>
              {renameError ? (
                <span className="campaign-name-error" id="campaign-name-error" role="alert">
                  {renameError}
                </span>
              ) : null}
            </form>
          ) : (
            <button
              className="campaign-name campaign-name-button"
              onClick={() => setIsEditingName(true)}
              type="button"
            >
              {outletContext.campaign.name}
            </button>
          )}
          <span className="system-badge">{outletContext.system.name}</span>
          {activeCalendar ? (
            <GameDateControl
              busy={gameDateFetcher.state !== 'idle'}
              calendar={activeCalendar}
              error={gameDateError}
              onDraftChange={() => {
                if (gameDateError) {
                  gameDateFetcher.reset();
                }
              }}
              onSave={(gameDate) => {
                gameDateFetcher.submit(
                  {
                    intent: 'set-game-date',
                    campaignId: liveCampaign.id,
                    gameDate: JSON.stringify(gameDate),
                  },
                  { method: 'post' },
                );
              }}
              value={liveCampaign.gameDate}
            />
          ) : null}
          <span className="channel-name campaign-channel">{outletContext.campaign.channel}</span>
          <span className="channel-name gm-name">GM: authenticated</span>
        </div>

        <div className="topbar-group topbar-status">
          <span
            className={`status-dot ${outletContext.apiOnline ? 'is-live' : 'is-stale'}`}
            aria-hidden="true"
          />
          <span className={outletContext.apiOnline ? 'status-live' : 'status-stale'}>
            {outletContext.apiOnline ? 'Live' : 'Offline'}
          </span>
          <span className="status-meta">{outletContext.campaign.connectedPlayers} online</span>
          <Form action="/logout" method="post">
            <button className="signout-button" type="submit">
              Sign Out
            </button>
          </Form>
        </div>
      </header>

      <WarRoomModeTabs tabs={tabs} />

      <div className="war-room-grid">
        {isPlayRoute ? (
          <aside className="filter-panel">
            <div className="panel-title">Scene Filter</div>
            <div className="filter-tag-list">
              <button
                className={`filter-tag${activeTag === null ? ' is-active' : ''}`}
                onClick={() => setActiveTag(null)}
                type="button"
              >
                All Scenes
              </button>
              {outletContext.tags.map((tag) => {
                const count = tagEventCounts.get(tag.id) ?? 0;
                return (
                  <button
                    key={tag.id}
                    className={`filter-tag${activeTag === tag.id ? ' is-active' : ''}`}
                    disabled={count === 0}
                    onClick={() => setActiveTag(activeTag === tag.id ? null : tag.id)}
                    type="button"
                  >
                    {tag.label}
                    {count > 0 && <span className="filter-tag-count">{count}</span>}
                  </button>
                );
              })}
            </div>

            <SceneRailExtras
              tags={outletContext.tags}
              activeTag={activeTag}
              eventCount={Array.from(tagEventCounts.values()).reduce((a, b) => a + b, 0)}
              activeEventCount={activeTag ? (tagEventCounts.get(activeTag) ?? 0) : 0}
            />
          </aside>
        ) : null}

        <main className="route-panel">
          <Outlet context={outletContext} />
        </main>

        {isPlayRoute ? (
          <PlayerRail
            contentId="live-players-panel-content"
            mobileOpen={mobilePlayersOpen}
            onToggleMobile={() => setMobilePlayersOpen((current) => !current)}
            resetKey={location.pathname}
            warRoom={outletContext}
          />
        ) : null}
      </div>

      {isPlayRoute ? (
        <QuickNarrationForm
          onBroadcast={async ({ idempotencyKey, message }) => {
            const channelId = outletContext.channels[0]?.id;
            if (!channelId) {
              throw new Error(
                "We couldn't find a campaign channel. Return to Setup, connect one, and try again.",
              );
            }

            const response = await postRouteAction('/', {
              intent: 'send-channel-message',
              campaignId: outletContext.campaign.id,
              channelId,
              content: message,
              idempotencyKey,
            });

            if (response.status !== 'success') {
              throw new Error(response.message);
            }

            recordActivity(quickNarrationActivityLabel(message));
          }}
        />
      ) : null}
    </div>
  );
}
