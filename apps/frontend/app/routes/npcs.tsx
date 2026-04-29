import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router';
import { listNpcs, revealNpcFacts } from '@constancia/api-client/endpoints/npcs/npcs';
import type { ListNpcs200DataItem, RevealNpcFacts200Data } from '@constancia/api-client/model';
import { AppendFactForm } from '@/components/npcs/append-fact-form';
import { SetupNotice } from '@/components/setup/setup-notice';
import {
  normalizeNpc,
  readPrimarySystemBlock,
  formatSystemBlockValue,
  type CampaignNpc,
  type CampaignNpcFact,
  type KnownPlayerRef,
} from '@/components/npcs/block-registry';
import { KnownToPicker } from '@/components/npcs/known-to-picker';
import { NpcPortraitFallback } from '@/components/npcs/npc-portrait-fallback';
import { NpcEditForm } from '@/components/npcs/npc-edit-form';
import { SystemBlockRenderer } from '@/components/npcs/system-block-renderer';
import { buildRecipientOptions, type WarRoomContext } from '@/lib/war-room-data';

type ApiNpc = ListNpcs200DataItem | RevealNpcFacts200Data;

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

const demoNpcs: CampaignNpc[] = [
  {
    id: 'demo-prince-adrian-voss',
    name: 'Prince Adrian Voss',
    imageUrl: null,
    description:
      'Keeps the city stable through debt, spectacle, and the quiet certainty that everybody already owes him twice.',
    systemBlocks: [
      { systemId: 'vtm-v5', blockType: 'clan', label: 'Clan', value: 'Ventrue' },
      { systemId: 'vtm-v5', blockType: 'title', label: 'Title', value: 'Prince' },
      {
        systemId: 'vtm-v5',
        blockType: 'demeanor',
        label: 'Demeanor',
        value: 'Measured, aristocratic, and incapable of sounding hurried even when furious.',
      },
    ],
    campaignId: 'demo-crimson-dynasty',
    facts: [
      {
        id: 'demo-prince-fact-1',
        content: 'He keeps a private ledger of every boon traded in Elysium.',
        sortOrder: 0,
        npcId: 'demo-prince-adrian-voss',
        knownTo: [
          {
            characterId: 'demo-char-aleksei',
            discordUserId: 'aleksei',
            displayName: 'Aleksei Volkov',
            secondaryLabel: 'Marcin · aleksei',
          },
          {
            characterId: 'demo-char-vivienne',
            discordUserId: 'vivienne',
            displayName: 'Vivienne Lacroix',
            secondaryLabel: 'Kasia · vivienne',
          },
        ],
      },
      {
        id: 'demo-prince-fact-2',
        content: 'The Prince still answers to a mortal accountant who never learned the truth.',
        sortOrder: 1,
        npcId: 'demo-prince-adrian-voss',
        knownTo: [],
      },
    ],
  },
  {
    id: 'demo-mara-the-veiled',
    name: 'Mara the Veiled',
    imageUrl: null,
    description:
      'Information broker, court whisperer, and the first person to know when a secret starts to rot.',
    systemBlocks: [
      { systemId: 'vtm-v5', blockType: 'clan', label: 'Clan', value: 'Nosferatu' },
      { systemId: 'vtm-v5', blockType: 'network', label: 'Network', value: 'Sewer couriers' },
    ],
    campaignId: 'demo-crimson-dynasty',
    facts: [
      {
        id: 'demo-mara-fact-1',
        content: 'She trades in rumors only after hearing them from three different mouths.',
        sortOrder: 0,
        npcId: 'demo-mara-the-veiled',
        knownTo: [
          {
            characterId: 'demo-char-marcus',
            discordUserId: 'marcus',
            displayName: 'Marcus Webb',
            secondaryLabel: 'Piotr · marcus',
          },
        ],
      },
      {
        id: 'demo-mara-fact-2',
        content: 'She maintains a dead-drop under the third pew in Saint Brigid’s chapel.',
        sortOrder: 1,
        npcId: 'demo-mara-the-veiled',
        knownTo: [
          {
            characterId: 'demo-char-vivienne',
            discordUserId: 'vivienne',
            displayName: 'Vivienne Lacroix',
            secondaryLabel: 'Kasia · vivienne',
          },
        ],
      },
    ],
  },
];

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

export default function NpcsRoute() {
  const warRoom = useOutletContext<WarRoomContext>();
  const isDemoCampaign = warRoom.campaign.id.startsWith('demo-');
  const [npcs, setNpcs] = useState<CampaignNpc[]>(() => (isDemoCampaign ? demoNpcs : []));
  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(
    isDemoCampaign ? (demoNpcs[0]?.id ?? null) : null,
  );
  const [pendingAssignments, setPendingAssignments] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(!isDemoCampaign);
  const [error, setError] = useState<string | null>(null);
  const [assigningFactId, setAssigningFactId] = useState<string | null>(null);
  const [isEditingNpc, setIsEditingNpc] = useState(false);
  const [activeDossierTab, setActiveDossierTab] = useState<'bio' | 'stats' | 'facts'>('bio');
  const [copiedLinkRecipientId, setCopiedLinkRecipientId] = useState<string | null>(null);

  const recipientOptions = useMemo(
    () => buildRecipientOptions(warRoom.rawCharacters, isDemoCampaign ? warRoom.players : []),
    [isDemoCampaign, warRoom.players, warRoom.rawCharacters],
  );

  useEffect(() => {
    if (isDemoCampaign) {
      setNpcs(demoNpcs.map(normalizeNpc));
      setSelectedNpcId((current) => current ?? demoNpcs[0]?.id ?? null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    async function loadNpcDossiers() {
      try {
        setLoading(true);
        setError(null);
        const response = await listNpcs({ id: warRoom.campaign.id }, { credentials: 'include' });
        if (cancelled) {
          return;
        }

        const next = (response.data ?? []).map(normalizeApiNpc);
        setNpcs(next);
        setSelectedNpcId((current) => current ?? next[0]?.id ?? null);
      } catch (loadError) {
        console.error('List NPCs error:', loadError);
        if (!cancelled) {
          setError('The dossier board is not responding. Reload the page and try again.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadNpcDossiers();

    return () => {
      cancelled = true;
    };
  }, [isDemoCampaign, warRoom.campaign.id]);

  useEffect(() => {
    if (selectedNpcId && npcs.some((npc) => npc.id === selectedNpcId)) {
      return;
    }

    setSelectedNpcId(npcs[0]?.id ?? null);
  }, [npcs, selectedNpcId]);

  useEffect(() => {
    setIsEditingNpc(false);
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
        const response = await revealNpcFacts(
          { id: warRoom.campaign.id, npcId: npc.id },
          { npcFactIds: [fact.id], discordUserIds },
          { credentials: 'include' },
        );
        const refreshedNpc = normalizeApiNpc(response.data);
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

  if (loading && npcs.length === 0) {
    return (
      <div className="mode-route">
        <section className="hero-strip hero-strip-compact">
          <div>
            <p className="eyebrow">NPCs</p>
            <h1>Pressure points</h1>
            <p className="hero-copy">Pulling the dossiers out of the archive…</p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mode-route">
      <section className="hero-strip hero-strip-compact npc-hero">
        <div>
          <p className="eyebrow">NPCs</p>
          <h1>Pressure points, leverage, witnesses.</h1>
          <p className="hero-copy">
            Track the court exactly as the GM needs it: who they are, what matters about them, and
            which players have seen the edge beneath the mask.
          </p>
        </div>
        <div className="npc-hero-meta">
          <p className="detail-label">Board state</p>
          <strong>{npcs.length} dossiers active</strong>
          <span>
            {npcs.reduce((total, npc) => total + npc.facts.length, 0)} revealable fact
            {npcs.reduce((total, npc) => total + npc.facts.length, 0) === 1 ? '' : 's'} on file
          </span>
        </div>
      </section>

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
                    <button
                      className="ghost-action ghost-action-inline"
                      type="button"
                      onClick={() => setIsEditingNpc((current) => !current)}
                    >
                      {isEditingNpc ? 'Close editor' : 'Edit dossier'}
                    </button>
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

              {isEditingNpc ? (
                <NpcEditForm
                  campaignId={warRoom.campaign.id}
                  systemId={warRoom.system.id}
                  npc={selectedNpc}
                  isDemoCampaign={isDemoCampaign}
                  onCancel={() => setIsEditingNpc(false)}
                  onError={setError}
                  onSaved={(updatedNpc) => {
                    setNpcs((current) =>
                      current.map((entry) =>
                        entry.id === updatedNpc.id ? normalizeNpc(updatedNpc) : entry,
                      ),
                    );
                    setIsEditingNpc(false);
                  }}
                />
              ) : null}

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
                            <button
                              className="ghost-action ghost-action-inline"
                              type="button"
                              disabled={isDemoCampaign || recipient.knownFacts === 0}
                              onClick={() => {
                                void copyPlayerDossierLink(recipient.discordUserId);
                              }}
                            >
                              {isDemoCampaign
                                ? 'Demo only'
                                : recipient.knownFacts === 0
                                  ? 'No dossier yet'
                                  : copiedLinkRecipientId === recipient.discordUserId
                                    ? 'Copied'
                                    : 'Copy link'}
                            </button>
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
                    </div>

                    <AppendFactForm
                      campaignId={warRoom.campaign.id}
                      npcId={selectedNpc.id}
                      nextSortOrder={selectedNpc.facts.length}
                      isDemoCampaign={isDemoCampaign}
                      onError={setError}
                      onAppended={(fact) => {
                        setNpcs((current) =>
                          current.map((entry) =>
                            entry.id === selectedNpc.id
                              ? normalizeNpc({ ...entry, facts: [...entry.facts, fact] })
                              : entry,
                          ),
                        );
                      }}
                    />

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
    </div>
  );
}
