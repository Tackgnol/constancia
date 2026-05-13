import { useEffect, useMemo, useState } from 'react';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { Link, useLoaderData, useOutletContext } from 'react-router';
import { listNpcs, revealNpcFacts } from '@constancia/api-client/endpoints/npcs/npcs';
import type { ListNpcs200DataItem } from '@constancia/api-client/model';
import { buildServerApiOptions, resolveCurrentCampaignId } from '@/lib/api-proxy.server';
import { ManagementWorkspace } from '@/components/layout/management-workspace';
import { SetupNotice } from '@/components/setup/setup-notice';
import {
  normalizeNpc,
  readPrimarySystemBlock,
  formatSystemBlockValue,
  type CampaignNpc,
  type CampaignNpcFact,
  type KnownPlayerRef,
} from '@/components/npcs/block-registry';
import { postRouteAction } from '@/lib/route-action-client';
import { KnownToPicker } from '@/components/npcs/known-to-picker';
import { NpcPortraitFallback } from '@/components/npcs/npc-portrait-fallback';
import { SystemBlockRenderer } from '@/components/npcs/system-block-renderer';
import { buildRecipientOptions, type WarRoomContext } from '@/lib/war-room-data';
import { demoNpcs } from '@/lib/demo-npcs';
import { handleUploadImageAction } from '@/lib/upload-image-action.server';

type ApiKnownPlayer = {
  characterId: string;
  discordUserId: string;
  displayName: string;
  secondaryLabel: string;
};

type ApiNpcFact = {
  id: string;
  content: string;
  sortOrder: number;
  npcId: string;
  knownTo?: ApiKnownPlayer[];
};

function getSetupBase(warRoom: WarRoomContext) {
  return warRoom.demoMode ? '/demo/setup' : '/setup';
}

function normalizeKnownTo(input: ApiKnownPlayer[] | undefined): KnownPlayerRef[] {
  return (input ?? []).map((entry) => ({
    characterId: entry.characterId,
    discordUserId: entry.discordUserId,
    displayName: entry.displayName,
    secondaryLabel: entry.secondaryLabel,
  }));
}

function normalizeApiNpc(input: ApiNpc): CampaignNpc {
  return normalizeNpc({
    id: input.id,
    name: input.name,
    imageUrl: input.imageUrl ?? undefined,
    description: input.description,
    systemBlocks: input.systemBlocks.map((block) => ({
      systemId: block.systemId,
      blockType: block.blockType,
      label: block.label,
      value: block.value as CampaignNpc['systemBlocks'][number]['value'],
    })),
    campaignId: input.campaignId,
    facts: input.facts.map((fact) => ({
      id: fact.id,
      content: fact.content,
      sortOrder: fact.sortOrder,
      npcId: fact.npcId,
      knownTo: normalizeKnownTo((fact as ApiNpcFact).knownTo),
    })),
  });
}

type ApiNpc = ListNpcs200DataItem;

function asStringArray(input: FormDataEntryValue | null): string[] {
  if (typeof input !== 'string' || input.length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(input) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === 'string')
      : [];
  } catch {
    return [];
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  const pathname = new URL(request.url).pathname;

  if (pathname.startsWith('/demo/')) {
    return demoNpcs.map(normalizeNpc);
  }

  const campaignId = await resolveCurrentCampaignId(request);
  if (!campaignId) {
    return [] satisfies CampaignNpc[];
  }

  const response = await listNpcs({ id: campaignId }, buildServerApiOptions(request));
  return response.status === 'ok' ? (response.data ?? []).map(normalizeApiNpc) : [];
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'upload-image') {
    return handleUploadImageAction(request, formData);
  }

  const campaignId = formData.get('campaignId');
  const npcId = formData.get('npcId');
  const npcFactIds = asStringArray(formData.get('npcFactIds'));
  const discordUserIds = asStringArray(formData.get('discordUserIds'));

  if (
    typeof campaignId !== 'string' ||
    campaignId.length === 0 ||
    typeof npcId !== 'string' ||
    npcId.length === 0 ||
    npcFactIds.length === 0 ||
    discordUserIds.length === 0
  ) {
    return Response.json(
      { status: 'error', message: 'NPC reveal payload is incomplete.' },
      { status: 400 },
    );
  }

  try {
    const response = await revealNpcFacts(
      { id: campaignId, npcId },
      { npcFactIds, discordUserIds },
      buildServerApiOptions(request),
    );

    if (response.status !== 'ok' || !response.data) {
      return Response.json(
        { status: 'error', message: 'Knowledge assignment failed. Try the reveal again.' },
        { status: 502 },
      );
    }

    return Response.json({ status: 'success', data: normalizeApiNpc(response.data) });
  } catch {
    return Response.json(
      { status: 'error', message: 'Knowledge assignment failed. Try the reveal again.' },
      { status: 500 },
    );
  }
}

export default function NpcsRoute() {
  const initialNpcs = useLoaderData<typeof loader>();
  const warRoom = useOutletContext<WarRoomContext>();
  const isDemoCampaign = warRoom.campaign.id.startsWith('demo-');
  const actionPath = warRoom.demoMode ? '/demo/npcs' : '/npcs';
  const [npcs, setNpcs] = useState<CampaignNpc[]>(() => initialNpcs);
  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(initialNpcs[0]?.id ?? null);
  const [pendingAssignments, setPendingAssignments] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [assigningFactId, setAssigningFactId] = useState<string | null>(null);
  const [activeDossierTab, setActiveDossierTab] = useState<'bio' | 'stats' | 'facts'>('bio');
  const [copiedLinkRecipientId, setCopiedLinkRecipientId] = useState<string | null>(null);
  const setupBase = getSetupBase(warRoom);

  const recipientOptions = useMemo(
    () => buildRecipientOptions(warRoom.rawCharacters, isDemoCampaign ? warRoom.players : []),
    [isDemoCampaign, warRoom.players, warRoom.rawCharacters],
  );

  useEffect(() => {
    setNpcs(initialNpcs);
    setSelectedNpcId((current) => current ?? initialNpcs[0]?.id ?? null);
    setError(null);
  }, [initialNpcs]);

  useEffect(() => {
    if (selectedNpcId && npcs.some((npc) => npc.id === selectedNpcId)) {
      return;
    }

    setSelectedNpcId(npcs[0]?.id ?? null);
  }, [npcs, selectedNpcId]);

  useEffect(() => {
    setActiveDossierTab('bio');
    setCopiedLinkRecipientId(null);
  }, [selectedNpcId]);

  const selectedNpc = npcs.find((npc) => npc.id === selectedNpcId) ?? null;
  const selectedNpcPrimaryBlock = selectedNpc ? readPrimarySystemBlock(selectedNpc) : null;

  const playerDossierRecipients = useMemo(() => {
    if (!selectedNpc) {
      return [];
    }

    return recipientOptions.map((option) => ({
      ...option,
      knownFacts: selectedNpc.facts.filter((fact) =>
        fact.knownTo.some((entry) => entry.discordUserId === option.discordUserId),
      ).length,
    }));
  }, [recipientOptions, selectedNpc]);

  const togglePendingAssignment = (factId: string, playerId: string) => {
    setPendingAssignments((current) => {
      const next = new Set(current[factId] ?? []);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }
      return { ...current, [factId]: [...next] };
    });
  };

  const applyFactKnowledge = async (fact: CampaignNpcFact) => {
    const npc = selectedNpc;
    const discordUserIds = pendingAssignments[fact.id] ?? [];

    if (!npc || discordUserIds.length === 0) {
      return;
    }

    try {
      setAssigningFactId(fact.id);
      setError(null);

      if (isDemoCampaign) {
        setNpcs((current) =>
          current.map((entry) => {
            if (entry.id !== npc.id) {
              return entry;
            }

            return {
              ...entry,
              facts: entry.facts.map((entryFact) => {
                if (entryFact.id !== fact.id) {
                  return entryFact;
                }

                const additions = recipientOptions
                  .filter((option) => discordUserIds.includes(option.id))
                  .map((option) => ({
                    characterId: option.characterId ?? option.id,
                    discordUserId: option.discordUserId,
                    displayName: option.displayName,
                    secondaryLabel: option.secondaryLabel,
                  }));

                return {
                  ...entryFact,
                  knownTo: [...entryFact.knownTo, ...additions].filter(
                    (candidate, index, items) =>
                      items.findIndex(
                        (entryKnownTo) => entryKnownTo.discordUserId === candidate.discordUserId,
                      ) === index,
                  ),
                };
              }),
            };
          }),
        );
      } else {
        const response = await postRouteAction<CampaignNpc>(actionPath, {
          campaignId: warRoom.campaign.id,
          npcId: npc.id,
          npcFactIds: JSON.stringify([fact.id]),
          discordUserIds: JSON.stringify(discordUserIds),
        });

        if (response.status !== 'success' || !response.data) {
          throw new Error(response.message);
        }

        const refreshedNpc = response.data;
        setNpcs((current) =>
          current.map((entry) => (entry.id === refreshedNpc.id ? refreshedNpc : entry)),
        );
      }

      setPendingAssignments((current) => ({ ...current, [fact.id]: [] }));
    } catch (revealError) {
      console.error('Reveal NPC facts error:', revealError);
      setError('Knowledge assignment failed. Try the reveal again.');
    } finally {
      setAssigningFactId(null);
    }
  };

  const copyPlayerDossierLink = async (discordUserId: string) => {
    if (isDemoCampaign || !selectedNpc || typeof window === 'undefined' || !navigator.clipboard) {
      return;
    }

    try {
      const url = new URL(
        `/player/campaigns/${encodeURIComponent(warRoom.campaign.id)}/npcs/${encodeURIComponent(selectedNpc.id)}`,
        window.location.origin,
      );

      await navigator.clipboard.writeText(url.toString());
      setCopiedLinkRecipientId(discordUserId);
      window.setTimeout(() => {
        setCopiedLinkRecipientId((current) => (current === discordUserId ? null : current));
      }, 1800);
    } catch (copyError) {
      console.error('Copy player dossier link error:', copyError);
      setError('Clipboard access failed. Copy the link again after granting browser permissions.');
    }
  };

  return (
    <ManagementWorkspace
      eyebrow="NPCs"
      title="Pressure points, leverage, witnesses"
      description="Track who matters, what they know, and which players have seen the edge beneath the mask."
      meta={
        <div className="npc-hero-meta">
          <p className="detail-label">Board state</p>
          <strong>{npcs.length} dossiers active</strong>
          <span>
            {npcs.reduce((total, npc) => total + npc.facts.length, 0)} revealable fact
            {npcs.reduce((total, npc) => total + npc.facts.length, 0) === 1 ? '' : 's'} on file
          </span>
        </div>
      }
    >
      {error ? (
        <SetupNotice label="NPC board warning" tone="error">
          <span>{error}</span>
        </SetupNotice>
      ) : null}

      {npcs.length === 0 ? (
        <section className="detail-card npc-empty-state">
          <p className="eyebrow">No dossiers yet</p>
          <h2>Start in Setup.</h2>
          <p>
            Add an NPC from the setup panel, shape it through system blocks, and come back here to
            edit the dossier and decide which players learn what.
          </p>
          <Link className="ghost-action ghost-action-inline" to={`${setupBase}/npcs/new`}>
            Add dossier
          </Link>
        </section>
      ) : selectedNpc ? (
        <div className="npc-workbench">
          <aside className="npc-rail">
            {npcs.map((npc) => {
              const knownCount = npc.facts.filter((fact) => fact.knownTo.length > 0).length;
              const primaryBlock = readPrimarySystemBlock(npc);
              return (
                <button
                  key={npc.id}
                  className={`npc-rail-card${selectedNpcId === npc.id ? ' is-active' : ''}`}
                  type="button"
                  onClick={() => setSelectedNpcId(npc.id)}
                >
                  <div>
                    <p className="detail-label">
                      {primaryBlock
                        ? `${primaryBlock.label}: ${formatSystemBlockValue(primaryBlock.value)}`
                        : 'No system block'}
                    </p>
                    <h2>{npc.name}</h2>
                  </div>
                  <p className="npc-rail-meta">
                    {npc.facts.length} fact{npc.facts.length === 1 ? '' : 's'} · {knownCount} in the
                    wild
                  </p>
                </button>
              );
            })}
          </aside>

          <section className="npc-focus detail-card">
            <div className="npc-dossier-sheet">
              <div className="npc-dossier-strip">
                <span>FILE // {selectedNpc.id.slice(0, 12).toUpperCase()}</span>
                <span>CAMPAIGN // {warRoom.campaign.name}</span>
                <span>CLEARANCE // GM</span>
              </div>

              <div className="npc-focus-header npc-focus-header-dossier">
                <div className="npc-portrait-shell npc-portrait-shell-dossier">
                  {selectedNpc.imageUrl ? (
                    <img
                      className="npc-portrait"
                      src={selectedNpc.imageUrl}
                      alt={`${selectedNpc.name} portrait`}
                    />
                  ) : (
                    <NpcPortraitFallback name={selectedNpc.name} />
                  )}
                  <div className="npc-portrait-stamp">verified</div>
                </div>

                <div className="npc-focus-copy npc-focus-copy-dossier">
                  <div className="npc-focus-toolbar">
                    <div>
                      <p className="eyebrow">
                        {selectedNpcPrimaryBlock
                          ? `${selectedNpcPrimaryBlock.label}: ${formatSystemBlockValue(selectedNpcPrimaryBlock.value)}`
                          : 'Unclassified'}
                      </p>
                      <h2>{selectedNpc.name}</h2>
                    </div>
                    <Link
                      className="ghost-action ghost-action-inline"
                      to={`${setupBase}/npcs/${selectedNpc.id}`}
                    >
                      Edit in setup
                    </Link>
                  </div>

                  <div className="npc-identity-grid">
                    <div className="npc-identity-cell">
                      <span className="detail-label">Known facts</span>
                      <strong>{selectedNpc.facts.length}</strong>
                    </div>
                    <div className="npc-identity-cell">
                      <span className="detail-label">Revealed facts</span>
                      <strong>
                        {selectedNpc.facts.filter((fact) => fact.knownTo.length > 0).length}
                      </strong>
                    </div>
                    <div className="npc-identity-cell">
                      <span className="detail-label">Player links</span>
                      <strong>
                        {playerDossierRecipients.filter((entry) => entry.knownFacts > 0).length}
                      </strong>
                    </div>
                  </div>

                  <p>{selectedNpc.description || 'No narrative summary has been written yet.'}</p>
                </div>
              </div>

              <div className="npc-tab-row" role="tablist" aria-label="NPC dossier panels">
                {[
                  { id: 'bio', label: 'Bio' },
                  { id: 'stats', label: 'Stats' },
                  { id: 'facts', label: 'Facts' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    className={`npc-tab${activeDossierTab === tab.id ? ' is-active' : ''}`}
                    type="button"
                    role="tab"
                    aria-selected={activeDossierTab === tab.id}
                    onClick={() => setActiveDossierTab(tab.id as 'bio' | 'stats' | 'facts')}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeDossierTab === 'bio' ? (
                <div className="npc-dossier-panel">
                  <section className="npc-panel-section">
                    <div className="setup-subsection-header">
                      <div>
                        <p className="detail-label">Background summary</p>
                        <p className="form-hint">
                          Use the description for what the GM needs at a glance; revealable truths
                          stay in the facts panel.
                        </p>
                      </div>
                    </div>

                    <div className="npc-dossier-summary">
                      <p>{selectedNpc.description || 'No background summary on file.'}</p>
                    </div>
                  </section>

                  <section className="npc-panel-section">
                    <div className="setup-subsection-header">
                      <div>
                        <p className="detail-label">Player dossier links</p>
                        <p className="form-hint">
                          Copy a player-safe page. It only shows the facts that have already been
                          revealed to that player.
                        </p>
                      </div>
                    </div>

                    {playerDossierRecipients.length > 0 ? (
                      <div className="npc-share-grid">
                        {playerDossierRecipients.map((recipient) => (
                          <article key={recipient.id} className="npc-share-card">
                            <div>
                              <p className="detail-label">{recipient.secondaryLabel}</p>
                              <strong>{recipient.displayName}</strong>
                            </div>
                            <span>
                              {recipient.knownFacts} known fact
                              {recipient.knownFacts === 1 ? '' : 's'}
                            </span>
                            {isDemoCampaign && recipient.knownFacts > 0 ? (
                              <Link
                                className="ghost-action ghost-action-inline"
                                to={`/demo/player/npcs/${selectedNpc.id}`}
                              >
                                View demo
                              </Link>
                            ) : (
                              <button
                                className="ghost-action ghost-action-inline"
                                type="button"
                                disabled={isDemoCampaign || recipient.knownFacts === 0}
                                onClick={() => {
                                  void copyPlayerDossierLink(recipient.discordUserId);
                                }}
                              >
                                {isDemoCampaign
                                  ? 'No demo dossier'
                                  : recipient.knownFacts === 0
                                    ? 'No dossier yet'
                                    : copiedLinkRecipientId === recipient.discordUserId
                                      ? 'Copied'
                                      : 'Copy link'}
                              </button>
                            )}
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="form-hint">
                        Player identities are still loading. Dossier links appear once participants
                        are synced.
                      </p>
                    )}
                  </section>
                </div>
              ) : null}

              {activeDossierTab === 'stats' ? (
                <div className="npc-dossier-panel">
                  <section className="npc-panel-section">
                    <div className="setup-subsection-header">
                      <div>
                        <p className="detail-label">System blocks</p>
                        <p className="form-hint">
                          Full GM reference, including stat-backed blocks that never appear on
                          player dossiers.
                        </p>
                      </div>
                    </div>

                    {selectedNpc.systemBlocks.length > 0 ? (
                      <div className="npc-block-render-grid">
                        {selectedNpc.systemBlocks.map((block) => (
                          <SystemBlockRenderer
                            key={`${block.systemId ?? 'core'}:${block.blockType}`}
                            systemId={warRoom.system.id}
                            block={block}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="form-hint">No system blocks recorded for this dossier yet.</p>
                    )}
                  </section>
                </div>
              ) : null}

              {activeDossierTab === 'facts' ? (
                <div className="npc-dossier-panel">
                  <div className="npc-facts-panel">
                    <div className="setup-subsection-header">
                      <div>
                        <p className="detail-label">Facts on file</p>
                        <p className="form-hint">
                          Reveal one fact at a time. Knowledge only expands from here — the board
                          remembers.
                        </p>
                      </div>
                      <Link
                        className="ghost-action ghost-action-inline"
                        to={`${setupBase}/npcs/${selectedNpc.id}`}
                      >
                        Add or edit facts
                      </Link>
                    </div>

                    <div className="npc-facts-grid">
                      {selectedNpc.facts.map((fact, index) => {
                        const pending = pendingAssignments[fact.id] ?? [];
                        return (
                          <article key={fact.id} className="npc-fact-card">
                            <div className="npc-fact-card-header">
                              <span className="npc-fact-number">
                                {String(index + 1).padStart(2, '0')}
                              </span>
                              <div>
                                <p className="detail-label">Known to</p>
                                {fact.knownTo.length > 0 ? (
                                  <div className="npc-chip-row">
                                    {fact.knownTo.map((player) => (
                                      <span
                                        key={player.discordUserId}
                                        className="npc-chip is-known"
                                      >
                                        {player.displayName}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="form-hint">GM only.</p>
                                )}
                              </div>
                            </div>

                            <p className="npc-fact-copy">{fact.content}</p>

                            <KnownToPicker
                              fact={fact}
                              recipientOptions={recipientOptions}
                              pending={pending}
                              assigning={assigningFactId === fact.id}
                              onToggle={(recipientId) =>
                                togglePendingAssignment(fact.id, recipientId)
                              }
                              onApply={() => void applyFactKnowledge(fact)}
                            />
                          </article>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </ManagementWorkspace>
  );
}
