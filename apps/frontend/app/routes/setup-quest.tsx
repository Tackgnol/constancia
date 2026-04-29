import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link, useOutletContext, useParams, useRevalidator } from 'react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  createQuest,
  createQuestEntry,
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
import type { WarRoomContext } from '@/lib/war-room-data';

const QUEST_STATUSES = ['active', 'completed', 'failed'] as const;
const ENTRY_STATUSES = ['pending', 'done'] as const;

type QuestStatus = (typeof QUEST_STATUSES)[number];
type QuestEntryStatus = (typeof ENTRY_STATUSES)[number];

const questEditSchema = z.object({
  name: z.string().trim().min(1, 'Give the quest a name.'),
  description: z.string().trim(),
  visible: z.boolean(),
  status: z.enum(QUEST_STATUSES),
});

const questEntrySchema = z.object({
  content: z.string().trim().min(1, 'Quest steps cannot be blank.'),
  status: z.enum(ENTRY_STATUSES),
});

type QuestEditValues = z.infer<typeof questEditSchema>;
type QuestEntryValues = z.infer<typeof questEntrySchema>;

function getSetupBase(warRoom: WarRoomContext) {
  return warRoom.demoMode ? '/demo/setup' : '/setup';
}

function getQuestBoardPath(warRoom: WarRoomContext) {
  return warRoom.demoMode ? '/demo/log' : '/log';
}

function normalizeQuestStatus(status: string): QuestStatus {
  return QUEST_STATUSES.includes(status as QuestStatus) ? (status as QuestStatus) : 'active';
}

function normalizeEntryStatus(status: string): QuestEntryStatus {
  return ENTRY_STATUSES.includes(status as QuestEntryStatus)
    ? (status as QuestEntryStatus)
    : 'pending';
}

function sortQuestEntries(
  entries: ListQuests200DataItemEntriesItem[] | undefined,
): ListQuests200DataItemEntriesItem[] {
  return [...(entries ?? [])].sort((left, right) => left.sortOrder - right.sortOrder);
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

export default function SetupQuestRoute() {
  const warRoom = useOutletContext<WarRoomContext>();
  const { questId } = useParams();
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

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError: setFormError,
    formState: { errors, isSubmitting },
  } = form;

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
      } else if (isEditing && questId) {
        const response = await updateQuest(
          { id: warRoom.campaign.id, questId },
          payload as UpdateQuestBody,
          { credentials: 'include' },
        );
        assertApiOk(response, 'The quest update did not clear. Try again.');
        revalidator.revalidate();
      } else {
        const response = await createQuest(
          { id: warRoom.campaign.id },
          payload as CreateQuestBody,
          {
            credentials: 'include',
          },
        );
        assertApiOk(response, 'The quest did not bind cleanly. Try again.');
        revalidator.revalidate();
        reset(defaultQuestValues(null));
      }

      const message = `${isEditing ? 'Quest updated' : 'Quest added'}: ${payload.name}`;
      setNotice(message);
      warRoom.recordActivity?.(message);
    } catch (caught) {
      console.error('Save quest error:', caught);
      const message = getApiErrorMessage(
        caught,
        isEditing
          ? 'The quest update did not clear. Try again.'
          : 'The quest did not bind cleanly. Try again.',
      );
      setNotice(null);
      setError(message);
      setFormError('root.serverError', { type: 'manual', message });
    }
  });

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
        const response = await createQuestEntry(
          { id: warRoom.campaign.id, questId: targetQuest.id },
          payload,
          { credentials: 'include' },
        );
        assertApiOk(response, 'The quest step did not file cleanly. Try again.');
        revalidator.revalidate();
      }

      const message = `Quest step added: ${targetQuest.name}`;
      setNotice(message);
      warRoom.recordActivity?.(message);
    } catch (caught) {
      console.error('Create quest entry error:', caught);
      setNotice(null);
      setError(getApiErrorMessage(caught, 'The quest step did not file cleanly. Try again.'));
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
        const response = await updateQuestEntry(
          { id: warRoom.campaign.id, questId: targetQuest.id, entryId: entry.id },
          payload,
          { credentials: 'include' },
        );
        assertApiOk(response, 'The quest step update did not clear. Try again.');
        revalidator.revalidate();
      }

      const message = `Quest step updated: ${targetQuest.name}`;
      setNotice(message);
      setEditingEntryId(null);
      warRoom.recordActivity?.(message);
    } catch (caught) {
      console.error('Update quest entry error:', caught);
      setNotice(null);
      setError(getApiErrorMessage(caught, 'The quest step update did not clear. Try again.'));
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
        const response = await deleteQuestEntry(
          { id: warRoom.campaign.id, questId: targetQuest.id, entryId: entry.id },
          { credentials: 'include' },
        );
        assertApiOk(response, 'The quest step did not delete cleanly. Try again.');
        revalidator.revalidate();
      }

      const message = `Quest step removed: ${targetQuest.name}`;
      setNotice(message);
      setEditingEntryId(null);
      warRoom.recordActivity?.(message);
    } catch (caught) {
      console.error('Delete quest entry error:', caught);
      setNotice(null);
      setError(getApiErrorMessage(caught, 'The quest step did not delete cleanly. Try again.'));
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
          <form className="quest-create-panel" onSubmit={onSubmit} noValidate>
            {errors.root?.serverError?.message ? (
              <div className="form-status form-status-error" role="alert">
                {errors.root.serverError.message}
              </div>
            ) : null}

            <div className="quest-create-grid">
              <div className="grid gap-1.5">
                <Label htmlFor="setup-quest-name">Quest Name</Label>
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

              <div className="grid gap-1.5">
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

            <div className="form-actions">
              <button className="form-submit" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : isEditing ? 'Save Quest' : 'Add Quest'}
              </button>
            </div>
          </form>

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
        message: 'The quest step did not file cleanly. Try again.',
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
                {ENTRY_STATUSES.map((status) => (
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
  const status = normalizeEntryStatus(entry.status);

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
      status: normalizeEntryStatus(entry.status),
    },
  });

  useEffect(() => {
    reset({
      content: entry.content,
      status: normalizeEntryStatus(entry.status),
    });
  }, [entry.content, entry.status, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await onUpdate(quest, entry, values);
    } catch {
      setError('root.serverError', {
        type: 'manual',
        message: 'The quest step update did not clear. Try again.',
      });
    }
  });

  return (
    <form className="quest-entry-row" onSubmit={onSubmit} noValidate>
      <span className={`quest-entry-led quest-entry-${normalizeEntryStatus(entry.status)}`}>
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
              {ENTRY_STATUSES.map((status) => (
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
