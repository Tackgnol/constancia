import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type FormEventHandler,
  type SetStateAction,
} from 'react';
import { Controller, useForm, type UseFormReturn } from 'react-hook-form';
import type { ActionFunctionArgs } from 'react-router';
import {
  Link,
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
  useRevalidator,
} from 'react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  createQuest,
  createQuestEntry,
  deleteQuest,
  deleteQuestEntry,
  updateQuest,
  updateQuestEntry,
} from '@constancia/api-client/endpoints/journal/journal';
import type {
  CreateQuestBody,
  CreateQuestEntryBody,
  ListQuests200DataItem,
  ListQuests200DataItemEntriesItem,
  UpdateQuestBody,
  UpdateQuestEntryBody,
} from '@constancia/api-client/model';
import { Button } from '@/components/ui/button';
import { ManagementWorkspace } from '@/components/layout/management-workspace';
import { buildServerApiOptions } from '@/lib/api-proxy.server';
import { postRouteAction } from '@/lib/route-action-client';
import { SetupNotice } from '@/components/setup/setup-notice';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { assertApiOk, getApiErrorMessage } from '@/lib/api-errors';
import {
  normalizeQuestEntryStatus,
  normalizeQuestStatus,
  QUEST_ENTRY_STATUSES,
  QUEST_STATUSES,
  sortQuestEntries,
} from '@/lib/quest-status';
import type { WarRoomContext } from '@/lib/war-room-data';

const questSaveError =
  "We couldn't save this quest. Your draft is still in the form; review the highlighted fields and try again.";
const questStepSaveError =
  "We couldn't save this quest step. Your text is still in the form; review it and try again.";
const questDeleteError =
  "We couldn't delete this quest. It is still on the Quests board; reopen it and try again.";
const questStepDeleteError =
  "We couldn't delete this quest step. It is still in the quest; reopen the step and try again.";

const questEditSchema = z.object({
  name: z.string().trim().min(1, 'Give the quest a name.'),
  description: z.string().trim(),
  visible: z.boolean(),
  status: z.enum(QUEST_STATUSES),
});

const questEntrySchema = z.object({
  content: z.string().trim().min(1, 'Quest steps cannot be blank.'),
  status: z.enum(QUEST_ENTRY_STATUSES),
});

type QuestEditValues = z.infer<typeof questEditSchema>;
type QuestEntryValues = z.infer<typeof questEntrySchema>;

function getSetupBase(warRoom: WarRoomContext) {
  return warRoom.demoMode ? '/demo/setup' : '/setup';
}

function getQuestBoardPath(warRoom: WarRoomContext) {
  return warRoom.demoMode ? '/demo/log' : '/log';
}

function nextEntrySortOrder(quest: ListQuests200DataItem): number {
  const entries = quest.entries ?? [];
  return entries.length === 0 ? 0 : Math.max(...entries.map((entry) => entry.sortOrder)) + 1;
}

function createLocalId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultQuestValues(quest: ListQuests200DataItem | null): QuestEditValues {
  return {
    name: quest?.name ?? '',
    description: quest?.description ?? '',
    status: quest ? normalizeQuestStatus(quest.status) : 'active',
    visible: quest?.visible ?? false,
  };
}

function parseQuestPayload<T>(input: FormDataEntryValue | null): T | null {
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

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get('intent');
  const campaignId = formData.get('campaignId');
  const questId = formData.get('questId');
  const entryId = formData.get('entryId');
  const apiOptions = buildServerApiOptions(request);

  if (typeof campaignId !== 'string' || campaignId.length === 0) {
    return Response.json(
      {
        status: 'error',
        message: "We couldn't identify this campaign. Return to Setup and reopen the quest.",
      },
      { status: 400 },
    );
  }

  try {
    if (intent === 'save-quest') {
      const payload = parseQuestPayload<CreateQuestBody | UpdateQuestBody>(formData.get('payload'));
      if (!payload) {
        return Response.json(
          {
            status: 'error',
            message: "We couldn't read this quest draft. Review the highlighted fields and retry.",
          },
          { status: 400 },
        );
      }

      if (typeof questId === 'string' && questId.length > 0) {
        const response = await updateQuest(
          { id: campaignId, questId },
          payload as UpdateQuestBody,
          apiOptions,
        );
        assertApiOk(response, questSaveError);
      } else {
        const response = await createQuest(
          { id: campaignId },
          payload as CreateQuestBody,
          apiOptions,
        );
        assertApiOk(response, questSaveError);
      }

      return Response.json({ status: 'success' });
    }

    if (intent === 'create-quest-entry') {
      const payload = parseQuestPayload<CreateQuestEntryBody>(formData.get('payload'));
      if (typeof questId !== 'string' || questId.length === 0 || !payload) {
        return Response.json(
          {
            status: 'error',
            message: "We couldn't read this quest step. Reopen the quest and enter the step again.",
          },
          { status: 400 },
        );
      }

      const response = await createQuestEntry({ id: campaignId, questId }, payload, apiOptions);
      assertApiOk(response, questStepSaveError);
      return Response.json({ status: 'success' });
    }

    if (intent === 'update-quest-entry') {
      const payload = parseQuestPayload<UpdateQuestEntryBody>(formData.get('payload'));
      if (
        typeof questId !== 'string' ||
        questId.length === 0 ||
        typeof entryId !== 'string' ||
        entryId.length === 0 ||
        !payload
      ) {
        return Response.json(
          {
            status: 'error',
            message: "We couldn't identify this quest step. Reopen it from the quest and retry.",
          },
          { status: 400 },
        );
      }

      const response = await updateQuestEntry(
        { id: campaignId, questId, entryId },
        payload,
        apiOptions,
      );
      assertApiOk(response, questStepSaveError);
      return Response.json({ status: 'success' });
    }

    if (intent === 'delete-quest-entry') {
      if (
        typeof questId !== 'string' ||
        questId.length === 0 ||
        typeof entryId !== 'string' ||
        entryId.length === 0
      ) {
        return Response.json(
          {
            status: 'error',
            message: "We couldn't identify this quest step. Reopen it from the quest and retry.",
          },
          { status: 400 },
        );
      }

      const response = await deleteQuestEntry({ id: campaignId, questId, entryId }, apiOptions);
      assertApiOk(response, questStepDeleteError);
      return Response.json({ status: 'success' });
    }

    if (intent === 'delete-quest') {
      if (typeof questId !== 'string' || questId.length === 0) {
        return Response.json(
          {
            status: 'error',
            message: "We couldn't identify this quest. Return to Quests and open it again.",
          },
          { status: 400 },
        );
      }

      const response = await deleteQuest({ id: campaignId, questId }, apiOptions);
      assertApiOk(response, questDeleteError);
      return Response.json({ status: 'success' });
    }

    return Response.json(
      { status: 'error', message: 'Unsupported quest action.' },
      { status: 400 },
    );
  } catch (caught) {
    const fallbackMessage =
      intent === 'delete-quest'
        ? questDeleteError
        : intent === 'delete-quest-entry'
          ? questStepDeleteError
          : intent === 'create-quest-entry' || intent === 'update-quest-entry'
            ? questStepSaveError
            : questSaveError;

    return Response.json(
      { status: 'error', message: getApiErrorMessage(caught, fallbackMessage) },
      { status: 500 },
    );
  }
}

function createQuestEntryActions({
  campaignId,
  isDemoMode,
  pathname,
  recordActivity,
  revalidate,
  setEditingEntryId,
  setError,
  setLocalQuests,
  setNotice,
}: {
  campaignId: string;
  isDemoMode: boolean;
  pathname: string;
  recordActivity: ((message: string) => void) | undefined;
  revalidate: () => void;
  setEditingEntryId: Dispatch<SetStateAction<string | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setLocalQuests: Dispatch<SetStateAction<ListQuests200DataItem[]>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
}) {
  const saveQuestEntry = async (targetQuest: ListQuests200DataItem, values: QuestEntryValues) => {
    const payload: CreateQuestEntryBody = {
      content: values.content.trim(),
      status: values.status,
      sortOrder: nextEntrySortOrder(targetQuest),
    };

    try {
      setError(null);
      if (isDemoMode) {
        setLocalQuests((current) =>
          current.map((entry) =>
            entry.id === targetQuest.id
              ? {
                  ...entry,
                  entries: [
                    ...(entry.entries ?? []),
                    {
                      id: createLocalId('quest-entry'),
                      questId: targetQuest.id,
                      content: payload.content,
                      status: payload.status ?? 'pending',
                      sortOrder: payload.sortOrder ?? 0,
                    },
                  ],
                }
              : entry,
          ),
        );
      } else {
        const response = await postRouteAction(pathname, {
          intent: 'create-quest-entry',
          campaignId,
          questId: targetQuest.id,
          payload: JSON.stringify(payload),
        });

        if (response.status !== 'success') {
          throw new Error(response.message);
        }

        revalidate();
      }

      const message = `Quest step added: ${targetQuest.name}`;
      setNotice(message);
      recordActivity?.(message);
    } catch (caught) {
      console.error('Create quest entry error:', caught);
      setNotice(null);
      setError(getApiErrorMessage(caught, questStepSaveError));
      throw caught;
    }
  };

  const patchQuestEntry = async (
    targetQuest: ListQuests200DataItem,
    entry: ListQuests200DataItemEntriesItem,
    values: QuestEntryValues,
  ) => {
    const payload: UpdateQuestEntryBody = {
      content: values.content.trim(),
      status: values.status,
      sortOrder: entry.sortOrder,
    };

    try {
      setError(null);
      if (isDemoMode) {
        setLocalQuests((current) =>
          current.map((candidate) =>
            candidate.id === targetQuest.id
              ? {
                  ...candidate,
                  entries: (candidate.entries ?? []).map((candidateEntry) =>
                    candidateEntry.id === entry.id
                      ? { ...candidateEntry, ...payload }
                      : candidateEntry,
                  ),
                }
              : candidate,
          ),
        );
      } else {
        const response = await postRouteAction(pathname, {
          intent: 'update-quest-entry',
          campaignId,
          questId: targetQuest.id,
          entryId: entry.id,
          payload: JSON.stringify(payload),
        });

        if (response.status !== 'success') {
          throw new Error(response.message);
        }

        revalidate();
      }

      const message = `Quest step updated: ${targetQuest.name}`;
      setNotice(message);
      setEditingEntryId(null);
      recordActivity?.(message);
    } catch (caught) {
      console.error('Update quest entry error:', caught);
      setNotice(null);
      setError(getApiErrorMessage(caught, questStepSaveError));
      throw caught;
    }
  };

  const removeQuestEntry = async (
    targetQuest: ListQuests200DataItem,
    entry: ListQuests200DataItemEntriesItem,
  ) => {
    try {
      setError(null);
      if (isDemoMode) {
        setLocalQuests((current) =>
          current.map((candidate) =>
            candidate.id === targetQuest.id
              ? {
                  ...candidate,
                  entries: (candidate.entries ?? []).filter(
                    (candidateEntry) => candidateEntry.id !== entry.id,
                  ),
                }
              : candidate,
          ),
        );
      } else {
        const response = await postRouteAction(pathname, {
          intent: 'delete-quest-entry',
          campaignId,
          questId: targetQuest.id,
          entryId: entry.id,
        });

        if (response.status !== 'success') {
          throw new Error(response.message);
        }

        revalidate();
      }

      const message = `Quest step removed: ${targetQuest.name}`;
      setNotice(message);
      setEditingEntryId(null);
      recordActivity?.(message);
    } catch (caught) {
      console.error('Delete quest entry error:', caught);
      setNotice(null);
      setError(getApiErrorMessage(caught, questStepDeleteError));
    }
  };

  return { saveQuestEntry, patchQuestEntry, removeQuestEntry };
}

function QuestRecordForm({
  form,
  isEditing,
  onSubmit,
  onDelete,
}: {
  form: UseFormReturn<QuestEditValues>;
  isEditing: boolean;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onDelete: () => void;
}) {
  const {
    register,
    control,
    formState: { errors, isSubmitting },
  } = form;

  return (
    <form className="quest-create-panel" onSubmit={onSubmit} noValidate>
      <div className="form-workbench-heading">
        <div>
          <p className="detail-label">Quest record</p>
          <h2>{isEditing ? 'Edit the objective' : 'Define the objective'}</h2>
        </div>
        <p className="form-hint">
          Keep the brief operational. Individual beats belong in quest steps after the quest exists.
        </p>
      </div>

      {errors.root?.serverError?.message ? (
        <div className="form-status form-status-error" role="alert">
          {errors.root.serverError.message}
        </div>
      ) : null}

      <div className="quest-create-grid">
        <div className={`grid gap-1.5${isEditing ? '' : ' setup-field-wide'}`}>
          <Label htmlFor="setup-quest-name">Quest name</Label>
          <Input
            id="setup-quest-name"
            placeholder="Recover the blood ledger"
            {...register('name')}
          />
          {errors.name ? <span className="form-error">{errors.name.message}</span> : null}
        </div>

        {isEditing ? (
          <div className="grid gap-1.5">
            <Label htmlFor="setup-quest-status">Status</Label>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="setup-quest-status" className="quest-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUEST_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        ) : null}

        <div className="grid gap-1.5 setup-field-wide">
          <Label htmlFor="setup-quest-description">Brief</Label>
          <Textarea
            id="setup-quest-description"
            placeholder="What the players need to do, why it matters, and what changes when they finish."
            {...register('description')}
          />
          {errors.description ? (
            <span className="form-error">{errors.description.message}</span>
          ) : null}
        </div>

        <Controller
          control={control}
          name="visible"
          render={({ field }) => (
            <label className="quest-toggle-row" htmlFor="setup-quest-visible">
              <Checkbox
                id="setup-quest-visible"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
              />
              <span>Reveal to player journals</span>
            </label>
          )}
        />
      </div>

      <div className="form-actions form-action-dock">
        <button className="form-submit" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : isEditing ? 'Save quest' : 'Create quest'}
        </button>
        {isEditing ? (
          <button className="ghost-action ghost-action-inline" type="button" onClick={onDelete}>
            Delete quest
          </button>
        ) : null}
      </div>
    </form>
  );
}

export default function SetupQuestRoute() {
  const warRoom = useOutletContext<WarRoomContext>();
  const { questId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const setupBase = getSetupBase(warRoom);
  const questBoardPath = getQuestBoardPath(warRoom);
  const isDemoMode = warRoom.demoMode === true;
  const [localQuests, setLocalQuests] = useState(warRoom.quests);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const quests = isDemoMode ? localQuests : warRoom.quests;
  const quest = useMemo(
    () => (questId ? (quests.find((entry) => entry.id === questId) ?? null) : null),
    [questId, quests],
  );
  const isEditing = Boolean(questId);

  useEffect(() => {
    if (isDemoMode) {
      setLocalQuests(warRoom.quests);
    }
  }, [isDemoMode, warRoom.quests]);

  const form = useForm<QuestEditValues>({
    resolver: zodResolver(questEditSchema),
    defaultValues: defaultQuestValues(quest),
  });

  const { handleSubmit, reset, setError: setFormError } = form;

  useEffect(() => {
    reset(defaultQuestValues(quest));
  }, [quest, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      setError(null);
      const payload: CreateQuestBody | UpdateQuestBody = {
        name: values.name.trim(),
        description: values.description.trim(),
        visible: values.visible,
        ...(isEditing ? { status: values.status } : {}),
      };

      if (isDemoMode) {
        if (isEditing && quest) {
          setLocalQuests((current) =>
            current.map((entry) => (entry.id === quest.id ? { ...entry, ...payload } : entry)),
          );
        } else {
          setLocalQuests((current) => [
            ...current,
            {
              id: createLocalId('quest'),
              name: values.name.trim(),
              description: payload.description ?? '',
              campaignId: warRoom.campaign.id,
              status: 'active',
              sortOrder: current.length,
              visible: payload.visible ?? false,
              entries: [],
            },
          ]);
          reset(defaultQuestValues(null));
        }
      } else {
        const response = await postRouteAction(location.pathname, {
          intent: 'save-quest',
          campaignId: warRoom.campaign.id,
          questId: questId ?? '',
          payload: JSON.stringify(payload),
        });

        if (response.status !== 'success') {
          throw new Error(response.message);
        }

        revalidator.revalidate();
        if (!isEditing) {
          reset(defaultQuestValues(null));
        }
      }

      const message = `${isEditing ? 'Quest updated' : 'Quest added'}: ${payload.name}`;
      setNotice(message);
      warRoom.recordActivity?.(message);
    } catch (caught) {
      console.error('Save quest error:', caught);
      const message = getApiErrorMessage(caught, questSaveError);
      setNotice(null);
      setError(message);
      setFormError('root.serverError', { type: 'manual', message });
    }
  });

  const { saveQuestEntry, patchQuestEntry, removeQuestEntry } = createQuestEntryActions({
    campaignId: warRoom.campaign.id,
    isDemoMode,
    pathname: location.pathname,
    recordActivity: warRoom.recordActivity,
    revalidate: revalidator.revalidate,
    setEditingEntryId,
    setError,
    setLocalQuests,
    setNotice,
  });

  const removeQuest = async () => {
    if (!isEditing || !questId) {
      return;
    }

    try {
      setError(null);
      if (isDemoMode) {
        setLocalQuests((current) => current.filter((entry) => entry.id !== questId));
        navigate(questBoardPath);
      } else {
        const response = await postRouteAction(location.pathname, {
          intent: 'delete-quest',
          campaignId: warRoom.campaign.id,
          questId,
        });

        if (response.status !== 'success') {
          throw new Error(response.message);
        }

        revalidator.revalidate();
        navigate(questBoardPath);
      }

      const message = `Quest removed: ${quest?.name ?? questId}`;
      setNotice(message);
      warRoom.recordActivity?.(message);
    } catch (caught) {
      console.error('Delete quest error:', caught);
      setNotice(null);
      setError(getApiErrorMessage(caught, questDeleteError));
    }
  };

  return (
    <ManagementWorkspace
      eyebrow="Setup / Quests"
      title={isEditing ? 'Revise a task thread' : 'Bind a task thread'}
      description={
        isEditing
          ? 'Edit quest state through a focused URL, then return to the player-facing ledger.'
          : 'Prepare a quest away from the quest board so the board stays readable.'
      }
      meta={
        <div className="setup-hero-note">
          <p className="detail-label">{isEditing ? 'Quest editor' : 'New quest'}</p>
          <p>{quest ? quest.name : 'New quests start hidden unless you reveal them.'}</p>
        </div>
      }
    >
      <div className="setup-back-row">
        <Link className="setup-inline-link" to={setupBase}>
          Back to setup
        </Link>
        <Link className="setup-inline-link" to={questBoardPath}>
          Open quest board
        </Link>
      </div>

      {isEditing && !quest ? (
        <SetupNotice label="Quest not found" tone="error">
          <span>This quest is not present in the current campaign payload.</span>
        </SetupNotice>
      ) : null}

      {notice ? (
        <SetupNotice label="Quest board updated">
          <span>{notice}</span>
        </SetupNotice>
      ) : null}

      {error ? (
        <SetupNotice label="Quest board failed" tone="error">
          <span>{error}</span>
        </SetupNotice>
      ) : null}

      {!isEditing || quest ? (
        <section className="setup-panel">
          <QuestRecordForm
            form={form}
            isEditing={isEditing}
            onSubmit={onSubmit}
            onDelete={() => void removeQuest()}
          />

          {isEditing && quest ? (
            <QuestStepEditor
              quest={quest}
              editingEntryId={editingEntryId}
              onStartEntryEdit={setEditingEntryId}
              onCancelEntryEdit={() => setEditingEntryId(null)}
              onEntryCreate={saveQuestEntry}
              onEntryUpdate={patchQuestEntry}
              onEntryDelete={removeQuestEntry}
            />
          ) : null}
        </section>
      ) : null}
    </ManagementWorkspace>
  );
}

function QuestStepEditor({
  quest,
  editingEntryId,
  onStartEntryEdit,
  onCancelEntryEdit,
  onEntryCreate,
  onEntryUpdate,
  onEntryDelete,
}: {
  quest: ListQuests200DataItem;
  editingEntryId: string | null;
  onStartEntryEdit: (entryId: string) => void;
  onCancelEntryEdit: () => void;
  onEntryCreate: (quest: ListQuests200DataItem, values: QuestEntryValues) => Promise<void>;
  onEntryUpdate: (
    quest: ListQuests200DataItem,
    entry: ListQuests200DataItemEntriesItem,
    values: QuestEntryValues,
  ) => Promise<void>;
  onEntryDelete: (
    quest: ListQuests200DataItem,
    entry: ListQuests200DataItemEntriesItem,
  ) => Promise<void>;
}) {
  const entries = sortQuestEntries(quest.entries);

  return (
    <section className="quest-entry-section">
      <div className="setup-subsection-header">
        <div>
          <p className="detail-label">Steps</p>
          <p className="form-hint">Manage quest steps here; the quest board stays read-only.</p>
        </div>
      </div>

      <QuestEntryCreateForm quest={quest} onCreate={onEntryCreate} />

      {entries.length > 0 ? (
        <div className="quest-entry-list">
          {entries.map((entry) =>
            editingEntryId === entry.id ? (
              <QuestEntryEditForm
                key={entry.id}
                quest={quest}
                entry={entry}
                onUpdate={onEntryUpdate}
                onDelete={onEntryDelete}
                onCancel={onCancelEntryEdit}
              />
            ) : (
              <QuestEntrySummaryRow
                key={entry.id}
                entry={entry}
                onEdit={() => onStartEntryEdit(entry.id)}
              />
            ),
          )}
        </div>
      ) : (
        <p className="quest-empty">No steps filed yet.</p>
      )}
    </section>
  );
}

function QuestEntryCreateForm({
  quest,
  onCreate,
}: {
  quest: ListQuests200DataItem;
  onCreate: (quest: ListQuests200DataItem, values: QuestEntryValues) => Promise<void>;
}) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<QuestEntryValues>({
    resolver: zodResolver(questEntrySchema),
    defaultValues: { content: '', status: 'pending' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await onCreate(quest, values);
      reset({ content: '', status: 'pending' });
    } catch {
      setError('root.serverError', {
        type: 'manual',
        message: questStepSaveError,
      });
    }
  });

  return (
    <form className="quest-entry-create" onSubmit={onSubmit} noValidate>
      <div className="quest-entry-create-main">
        <div className="grid gap-1.5 form-field-grow">
          <Label htmlFor={`quest-entry-new-${quest.id}`}>New Step</Label>
          <Input
            id={`quest-entry-new-${quest.id}`}
            placeholder="Search the records room before dawn."
            {...register('content')}
          />
          {errors.content ? <span className="form-error">{errors.content.message}</span> : null}
        </div>

        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="quest-entry-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUEST_ENTRY_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {errors.root?.serverError?.message ? (
        <div className="form-status form-status-error" role="alert">
          {errors.root.serverError.message}
        </div>
      ) : null}

      <div className="quest-entry-actions">
        <Button
          className="ghost-action ghost-action-inline"
          type="submit"
          variant="ghost"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Adding...' : 'Add step'}
        </Button>
      </div>
    </form>
  );
}

function QuestEntrySummaryRow({
  entry,
  onEdit,
}: {
  entry: ListQuests200DataItemEntriesItem;
  onEdit: () => void;
}) {
  const status = normalizeQuestEntryStatus(entry.status);

  return (
    <div className="quest-entry-summary-row">
      <span className={`quest-entry-led quest-entry-${status}`}>
        {String(entry.sortOrder + 1).padStart(2, '0')}
      </span>
      <div className="quest-entry-summary-copy">
        <p>{entry.content}</p>
        <span>{status}</span>
      </div>
      <button className="ghost-action ghost-action-inline" type="button" onClick={onEdit}>
        Edit
      </button>
    </div>
  );
}

function QuestEntryEditForm({
  quest,
  entry,
  onUpdate,
  onDelete,
  onCancel,
}: {
  quest: ListQuests200DataItem;
  entry: ListQuests200DataItemEntriesItem;
  onUpdate: (
    quest: ListQuests200DataItem,
    entry: ListQuests200DataItemEntriesItem,
    values: QuestEntryValues,
  ) => Promise<void>;
  onDelete: (
    quest: ListQuests200DataItem,
    entry: ListQuests200DataItemEntriesItem,
  ) => Promise<void>;
  onCancel: () => void;
}) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<QuestEntryValues>({
    resolver: zodResolver(questEntrySchema),
    defaultValues: {
      content: entry.content,
      status: normalizeQuestEntryStatus(entry.status),
    },
  });

  useEffect(() => {
    reset({
      content: entry.content,
      status: normalizeQuestEntryStatus(entry.status),
    });
  }, [entry.content, entry.status, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await onUpdate(quest, entry, values);
    } catch {
      setError('root.serverError', {
        type: 'manual',
        message: questStepSaveError,
      });
    }
  });

  return (
    <form className="quest-entry-row" onSubmit={onSubmit} noValidate>
      <span className={`quest-entry-led quest-entry-${normalizeQuestEntryStatus(entry.status)}`}>
        {String(entry.sortOrder + 1).padStart(2, '0')}
      </span>

      <div className="grid gap-1.5 form-field-grow">
        <Label htmlFor={`quest-entry-${entry.id}`}>Step</Label>
        <Input id={`quest-entry-${entry.id}`} {...register('content')} />
        {errors.content ? <span className="form-error">{errors.content.message}</span> : null}
      </div>

      <Controller
        control={control}
        name="status"
        render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger className="quest-entry-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUEST_ENTRY_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />

      <Button
        type="button"
        variant="ghost"
        className="ghost-action ghost-action-inline"
        onClick={onCancel}
      >
        Cancel
      </Button>
      <Button
        type="submit"
        variant="ghost"
        className="ghost-action ghost-action-inline"
        disabled={isSubmitting}
      >
        Save
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="ghost-action ghost-action-inline"
        onClick={() => {
          void onDelete(quest, entry);
        }}
      >
        Delete
      </Button>

      {errors.root?.serverError?.message ? (
        <div className="form-status form-status-error quest-entry-error" role="alert">
          {errors.root.serverError.message}
        </div>
      ) : null}
    </form>
  );
}
