import { useEffect, useState } from 'react';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import {
  Link,
  useLoaderData,
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
  useRevalidator,
} from 'react-router';
import { listNpcs } from '@constancia/api-client/endpoints/npcs/npcs';
import { createNpc, createNpcFact, updateNpc } from '@constancia/api-client/endpoints/npcs/npcs';
import type {
  CreateNpcBody,
  CreateNpcFactBody,
  ListNpcs200DataItem,
  UpdateNpcBody,
} from '@constancia/api-client/model';
import { buildServerApiOptions, resolveCurrentCampaignId } from '@/lib/api-proxy.server';
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
import { assertApiOk, getApiErrorMessage } from '@/lib/api-errors';
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

function parsePayload<T>(input: FormDataEntryValue | null): T | null {
  if (typeof input !== 'string' || input.length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(input) as unknown;
    return typeof parsed === 'object' && parsed !== null ? (parsed as T) : null;
  } catch {
    return null;
  }
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const npcId = params.npcId;
  if (!npcId) {
    return null;
  }

  const pathname = new URL(request.url).pathname;
  if (pathname.startsWith('/demo/')) {
    return demoNpcs.find((entry) => entry.id === npcId) ?? null;
  }

  const campaignId = await resolveCurrentCampaignId(request);
  if (!campaignId) {
    return null;
  }

  const response = await listNpcs({ id: campaignId }, buildServerApiOptions(request));
  if (response.status !== 'ok') {
    return null;
  }

  const found = (response.data ?? []).find((entry) => entry.id === npcId);
  return found ? normalizeApiNpc(found) : null;
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get('intent');
  const campaignId = formData.get('campaignId');
  const npcId = formData.get('npcId');
  const apiOptions = buildServerApiOptions(request);

  if (typeof campaignId !== 'string' || campaignId.length === 0) {
    return Response.json(
      { status: 'error', message: 'Campaign context is missing.' },
      { status: 400 },
    );
  }

  try {
    if (intent === 'create-npc') {
      const payload = parsePayload<CreateNpcBody>(formData.get('payload'));
      if (!payload) {
        return Response.json(
          { status: 'error', message: 'NPC payload is missing.' },
          { status: 400 },
        );
      }

      const response = await createNpc({ id: campaignId }, payload, apiOptions);
      assertApiOk(response, 'The dossier did not bind cleanly. Check the fields and try again.');
      return Response.json({
        status: 'success',
        data: {
          name: payload.name,
          factCount: payload.facts?.length ?? 0,
        },
      });
    }

    if (intent === 'update-npc') {
      const payload = parsePayload<UpdateNpcBody>(formData.get('payload'));
      if (typeof npcId !== 'string' || npcId.length === 0 || !payload) {
        return Response.json(
          { status: 'error', message: 'NPC update is incomplete.' },
          { status: 400 },
        );
      }

      const response = await updateNpc({ id: campaignId, npcId }, payload, apiOptions);
      assertApiOk(response, 'The dossier update did not hold. Check the fields and try again.');
      return Response.json({ status: 'success', data: response.data });
    }

    if (intent === 'create-npc-fact') {
      const payload = parsePayload<CreateNpcFactBody>(formData.get('payload'));
      if (typeof npcId !== 'string' || npcId.length === 0 || !payload) {
        return Response.json(
          { status: 'error', message: 'NPC fact payload is incomplete.' },
          { status: 400 },
        );
      }

      const response = await createNpcFact({ id: campaignId, npcId }, payload, apiOptions);
      assertApiOk(response, 'The new fact would not file cleanly. Try again.');
      return Response.json({ status: 'success', data: { ...response.data, knownTo: [] } });
    }

    return Response.json({ status: 'error', message: 'Unsupported NPC action.' }, { status: 400 });
  } catch (caught) {
    const fallbackMessage =
      intent === 'update-npc'
        ? 'The dossier update did not hold. Check the fields and try again.'
        : intent === 'create-npc-fact'
          ? 'The new fact would not file cleanly. Try again.'
          : 'The dossier did not bind cleanly. Check the fields and try again.';

    return Response.json(
      { status: 'error', message: getApiErrorMessage(caught, fallbackMessage) },
      { status: 500 },
    );
  }
}

export default function SetupNpcRoute() {
  const loadedNpc = useLoaderData<typeof loader>();
  const warRoom = useOutletContext<WarRoomContext>();
  const { npcId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const setupBase = getSetupBase(warRoom);
  const npcBoardPath = getNpcBoardPath(warRoom);
  const isDemoCampaign = warRoom.campaign.id.startsWith('demo-');
  const isEditing = Boolean(npcId);
  const actionPath = location.pathname;
  const [npc, setNpc] = useState<CampaignNpc | null>(() => {
    if (isDemoCampaign && npcId) {
      return demoNpcs.find((entry) => entry.id === npcId) ?? null;
    }

    return loadedNpc;
  });
  const [savedNpc, setSavedNpc] = useState<{ name: string; factCount: number } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditing) {
      setNpc(null);
      setError(null);
      return;
    }

    if (isDemoCampaign && npcId) {
      setNpc(demoNpcs.find((entry) => entry.id === npcId) ?? null);
      setError(null);
      return;
    }

    setNpc(loadedNpc);
    if (!loadedNpc) {
      setError('The dossier editor could not load this NPC. Return to the board and try again.');
    } else {
      setError(null);
    }
  }, [isDemoCampaign, isEditing, loadedNpc, npcId]);

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

      {!isEditing ? (
        <section className="setup-panel">
          <SetupNpcForm
            actionPath={actionPath}
            campaignId={warRoom.campaign.id}
            systemId={warRoom.system.id}
            isDemoCampaign={isDemoCampaign}
            onSuccess={setSavedNpc}
            onError={setError}
          />
        </section>
      ) : null}

      {isEditing && !npc ? (
        <SetupNotice label="NPC not found" tone="error">
          <span>This dossier is not present in the current campaign payload.</span>
        </SetupNotice>
      ) : null}

      {isEditing && npc ? (
        <section className="setup-panel">
          <NpcEditForm
            actionPath={actionPath}
            campaignId={warRoom.campaign.id}
            systemId={warRoom.system.id}
            npc={npc}
            isDemoCampaign={isDemoCampaign}
            onCancel={() => navigate(npcBoardPath)}
            onError={setError}
            onSaved={(updatedNpc) => {
              setNpc(normalizeNpc(updatedNpc));
              setStatus(`${updatedNpc.name} is ready on the NPC board.`);
              if (!isDemoCampaign) {
                revalidator.revalidate();
              }
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
              actionPath={actionPath}
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
                if (!isDemoCampaign) {
                  revalidator.revalidate();
                }
              }}
            />
          </section>
        </section>
      ) : null}
    </ManagementWorkspace>
  );
}
