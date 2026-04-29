import { useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router';
import { listNpcs } from '@constancia/api-client/endpoints/npcs/npcs';
import type { ListNpcs200DataItem } from '@constancia/api-client/model';
import { ManagementWorkspace } from '@/components/layout/management-workspace';
import { AppendFactForm } from '@/components/npcs/append-fact-form';
import {
  normalizeNpc,
  type CampaignNpc,
  type KnownPlayerRef,
} from '@/components/npcs/block-registry';
import { NpcEditForm } from '@/components/npcs/npc-edit-form';
import { SetupNpcForm } from '@/components/npcs/setup-npc-form';
import { SetupNotice } from '@/components/setup/setup-notice';
import { demoNpcs } from '@/lib/demo-npcs';
import type { WarRoomContext } from '@/lib/war-room-data';

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

function getNpcBoardPath(warRoom: WarRoomContext) {
  return warRoom.demoMode ? '/demo/npcs' : '/npcs';
}

function normalizeKnownTo(input: ApiKnownPlayer[] | undefined): KnownPlayerRef[] {
  return (input ?? []).map((entry) => ({
    characterId: entry.characterId,
    discordUserId: entry.discordUserId,
    displayName: entry.displayName,
    secondaryLabel: entry.secondaryLabel,
  }));
}

function normalizeApiNpc(input: ListNpcs200DataItem): CampaignNpc {
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

export default function SetupNpcRoute() {
  const warRoom = useOutletContext<WarRoomContext>();
  const { npcId } = useParams();
  const navigate = useNavigate();
  const setupBase = getSetupBase(warRoom);
  const npcBoardPath = getNpcBoardPath(warRoom);
  const isDemoCampaign = warRoom.campaign.id.startsWith('demo-');
  const isEditing = Boolean(npcId);
  const [npc, setNpc] = useState<CampaignNpc | null>(() =>
    isDemoCampaign && npcId ? (demoNpcs.find((entry) => entry.id === npcId) ?? null) : null,
  );
  const [savedNpc, setSavedNpc] = useState<{ name: string; factCount: number } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(isEditing && !isDemoCampaign);

  useEffect(() => {
    if (!isEditing || !npcId || isDemoCampaign) {
      return;
    }

    let cancelled = false;

    async function loadNpc() {
      try {
        setLoading(true);
        setError(null);
        const response = await listNpcs({ id: warRoom.campaign.id }, { credentials: 'include' });
        if (cancelled) return;

        const found = (response.data ?? []).find((entry) => entry.id === npcId);
        setNpc(found ? normalizeApiNpc(found) : null);
      } catch (caught) {
        console.error('Load NPC editor error:', caught);
        if (!cancelled) {
          setError(
            'The dossier editor could not load this NPC. Return to the board and try again.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadNpc();

    return () => {
      cancelled = true;
    };
  }, [isDemoCampaign, isEditing, npcId, warRoom.campaign.id]);

  return (
    <ManagementWorkspace
      eyebrow="Setup / NPCs"
      title={isEditing ? 'Refit a dossier' : 'Pin a face to the board'}
      description={
        isEditing
          ? 'Edit the NPC through a focused setup URL instead of expanding an editor on the board.'
          : 'Create the dossier here, then use the NPC board for reference and reveals.'
      }
      meta={
        <div className="setup-hero-note">
          <p className="detail-label">{isEditing ? 'Dossier editor' : 'New dossier'}</p>
          <p>{npc ? npc.name : 'Facts stay atomic so they can be revealed one at a time.'}</p>
        </div>
      }
    >
      <div className="setup-back-row">
        <Link className="setup-inline-link" to={setupBase}>
          Back to setup
        </Link>
        <Link className="setup-inline-link" to={npcBoardPath}>
          Open NPC board
        </Link>
      </div>

      {status ? (
        <SetupNotice label="Dossier saved">
          <span>{status}</span>
        </SetupNotice>
      ) : null}

      {savedNpc ? (
        <SetupNotice label="Dossier added">
          <strong>{savedNpc.name}</strong>
          <span>
            {savedNpc.factCount} fact{savedNpc.factCount !== 1 ? 's' : ''} filed for reveal.
          </span>
          <Link className="setup-inline-link" to={npcBoardPath}>
            Review dossiers
          </Link>
        </SetupNotice>
      ) : null}

      {error ? (
        <SetupNotice label="Dossier failed" tone="error">
          <span>{error}</span>
        </SetupNotice>
      ) : null}

      {loading ? (
        <section className="detail-card npc-empty-state">
          <p className="form-hint">Loading dossier editor.</p>
        </section>
      ) : null}

      {!isEditing ? (
        <section className="setup-panel">
          <SetupNpcForm
            campaignId={warRoom.campaign.id}
            systemId={warRoom.system.id}
            isDemoCampaign={isDemoCampaign}
            onSuccess={setSavedNpc}
            onError={setError}
          />
        </section>
      ) : null}

      {isEditing && !loading && !npc ? (
        <SetupNotice label="NPC not found" tone="error">
          <span>This dossier is not present in the current campaign payload.</span>
        </SetupNotice>
      ) : null}

      {isEditing && npc ? (
        <section className="setup-panel">
          <NpcEditForm
            campaignId={warRoom.campaign.id}
            systemId={warRoom.system.id}
            npc={npc}
            isDemoCampaign={isDemoCampaign}
            onCancel={() => navigate(npcBoardPath)}
            onError={setError}
            onSaved={(updatedNpc) => {
              setNpc(normalizeNpc(updatedNpc));
              setStatus(`${updatedNpc.name} is ready on the NPC board.`);
            }}
          />

          <section className="setup-subsection">
            <div className="setup-subsection-header">
              <div>
                <p className="detail-label">Facts</p>
                <p className="form-hint">
                  Add facts from setup so the board stays focused on reveal state.
                </p>
              </div>
            </div>
            <AppendFactForm
              campaignId={warRoom.campaign.id}
              npcId={npc.id}
              nextSortOrder={npc.facts.length}
              isDemoCampaign={isDemoCampaign}
              onError={setError}
              onAppended={(fact) => {
                setNpc((current) =>
                  current ? normalizeNpc({ ...current, facts: [...current.facts, fact] }) : current,
                );
                setStatus(`Fact added to ${npc.name}.`);
              }}
            />
          </section>
        </section>
      ) : null}
    </ManagementWorkspace>
  );
}
