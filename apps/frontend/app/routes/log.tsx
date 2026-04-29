import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useOutletContext, useRevalidator } from 'react-router';
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

const questCreateSchema = z.object({
  name: z.string().trim().min(1, 'Give the quest a name.'),
  description: z.string().trim(),
  visible: z.boolean(),
});

const questEditSchema = questCreateSchema.extend({
  status: z.enum(QUEST_STATUSES),
});

const questEntrySchema = z.object({
  content: z.string().trim().min(1, 'Quest steps cannot be blank.'),
  status: z.enum(ENTRY_STATUSES),
});

type QuestCreateValues = z.infer<typeof questCreateSchema>;
type QuestEditValues = z.infer<typeof questEditSchema>;
type QuestEntryValues = z.infer<typeof questEntrySchema>;

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

export default function LogRoute() {
  const warRoom = useOutletContext<WarRoomContext>();
  const revalidator = useRevalidator();
  const [localQuests, setLocalQuests] = useState(warRoom.quests);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isDemoMode = warRoom.demoMode === true;
  const quests = isDemoMode ? localQuests : warRoom.quests;

  useEffect(() => {
    if (isDemoMode) {
      setLocalQuests(warRoom.quests);
    }
  }, [isDemoMode, warRoom.quests]);

  const questStats = useMemo(() => {
    const visible = quests.filter((quest) => quest.visible).length;
    const completed = quests.filter((quest) => quest.status === 'completed').length;
    const steps = quests.reduce((total, quest) => total + (quest.entries?.length ?? 0), 0);

    return { visible, completed, steps };
  }, [quests]);

  const saveQuest = async (values: QuestCreateValues) => {
    const payload: CreateQuestBody = {
      name: values.name.trim(),
      description: values.description.trim(),
      visible: values.visible,
    };

    try {
      setError(null);
      if (isDemoMode) {
        setLocalQuests((current) => [
          ...current,
          {
            id: createLocalId('quest'),
            name: payload.name,
            description: payload.description ?? '',
            campaignId: warRoom.campaign.id,
            status: 'active',
            sortOrder: current.length,
            visible: payload.visible ?? false,
            entries: [],
          },
        ]);
      } else {
        const response = await createQuest({ id: warRoom.campaign.id }, payload, {
          credentials: 'include',
        });
        assertApiOk(response, 'The quest did not bind cleanly. Try again.');
        revalidator.revalidate();
      }

      const message = `Quest added: ${payload.name}`;
      setNotice(message);
      warRoom.recordActivity?.(message);
    } catch (caught) {
      console.error('Create quest error:', caught);
      setNotice(null);
      setError(getApiErrorMessage(caught, 'The quest did not bind cleanly. Try again.'));
      throw caught;
    }
  };

  const patchQuest = async (quest: ListQuests200DataItem, values: QuestEditValues) => {
    const payload: UpdateQuestBody = {
      name: values.name.trim(),
      description: values.description.trim(),
      status: values.status,
      visible: values.visible,
    };

    try {
      setError(null);
      if (isDemoMode) {
        setLocalQuests((current) =>
          current.map((entry) => (entry.id === quest.id ? { ...entry, ...payload } : entry)),
        );
      } else {
        const response = await updateQuest(
          { id: warRoom.campaign.id, questId: quest.id },
          payload,
          { credentials: 'include' },
        );
        assertApiOk(response, 'The quest update did not clear. Try again.');
        revalidator.revalidate();
      }

      const message = `Quest updated: ${payload.name}`;
      setNotice(message);
      warRoom.recordActivity?.(message);
    } catch (caught) {
      console.error('Update quest error:', caught);
      setNotice(null);
      setError(getApiErrorMessage(caught, 'The quest update did not clear. Try again.'));
      throw caught;
    }
  };

  const saveQuestEntry = async (quest: ListQuests200DataItem, values: QuestEntryValues) => {
    const payload: CreateQuestEntryBody = {
      content: values.content.trim(),
      status: values.status,
      sortOrder: nextEntrySortOrder(quest),
    };

    try {
      setError(null);
      if (isDemoMode) {
        setLocalQuests((current) =>
          current.map((entry) =>
            entry.id === quest.id
              ? {
                  ...entry,
                  entries: [
                    ...(entry.entries ?? []),
                    {
                      id: createLocalId('quest-entry'),
                      questId: quest.id,
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
          { id: warRoom.campaign.id, questId: quest.id },
          payload,
          { credentials: 'include' },
        );
        assertApiOk(response, 'The quest step did not file cleanly. Try again.');
        revalidator.revalidate();
      }

      const message = `Quest step added: ${quest.name}`;
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
    quest: ListQuests200DataItem,
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
            candidate.id === quest.id
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
          { id: warRoom.campaign.id, questId: quest.id, entryId: entry.id },
          payload,
          { credentials: 'include' },
        );
        assertApiOk(response, 'The quest step update did not clear. Try again.');
        revalidator.revalidate();
      }

      const message = `Quest step updated: ${quest.name}`;
      setNotice(message);
      warRoom.recordActivity?.(message);
    } catch (caught) {
      console.error('Update quest entry error:', caught);
      setNotice(null);
      setError(getApiErrorMessage(caught, 'The quest step update did not clear. Try again.'));
      throw caught;
    }
  };

  const removeQuestEntry = async (
    quest: ListQuests200DataItem,
    entry: ListQuests200DataItemEntriesItem,
  ) => {
    try {
      setError(null);
      if (isDemoMode) {
        setLocalQuests((current) =>
          current.map((candidate) =>
            candidate.id === quest.id
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
          { id: warRoom.campaign.id, questId: quest.id, entryId: entry.id },
          { credentials: 'include' },
        );
        assertApiOk(response, 'The quest step did not delete cleanly. Try again.');
        revalidator.revalidate();
      }

      const message = `Quest step removed: ${quest.name}`;
      setNotice(message);
      warRoom.recordActivity?.(message);
    } catch (caught) {
      console.error('Delete quest entry error:', caught);
      setNotice(null);
      setError(getApiErrorMessage(caught, 'The quest step did not delete cleanly. Try again.'));
    }
  };

  return (
    <div className="mode-route">
      <section className="hero-strip hero-strip-compact quest-hero">
        <div>
          <p className="eyebrow">Log</p>
          <h1>Quest control</h1>
          <p className="hero-copy">
            Maintain player-visible tasks, hidden GM threads, and completion notes from one dense
            campaign ledger.
          </p>
        </div>
        <div className="log-hero-meta">
          <p className="detail-label">Quest scope</p>
          <strong>
            {quests.length} quest{quests.length === 1 ? '' : 's'}
          </strong>
          <span>
            {questStats.visible} visible · {questStats.completed} closed · {questStats.steps} steps
          </span>
        </div>
      </section>

      {notice ? (
        <section className="setup-notice" role="status">
          <p className="detail-label">Quest board updated</p>
          <span>{notice}</span>
        </section>
      ) : null}

      {error ? (
        <section className="setup-notice is-error" role="alert">
          <p className="detail-label">Quest board failed</p>
          <span>{error}</span>
        </section>
      ) : null}

      <QuestCreateForm onCreate={saveQuest} />

      {quests.length > 0 ? (
        <section className="quest-board" aria-label="Quest board">
          {quests.map((quest) => (
            <QuestCard
              key={quest.id}
              quest={quest}
              onQuestUpdate={patchQuest}
              onEntryCreate={saveQuestEntry}
              onEntryUpdate={patchQuestEntry}
              onEntryDelete={removeQuestEntry}
            />
          ))}
        </section>
      ) : (
        <section className="detail-card board-empty-state">
          <p className="eyebrow">No quests</p>
          <h2>No player work is on the board yet.</h2>
          <p>Create a hidden task first, then reveal it when the table has earned the lead.</p>
        </section>
      )}
    </div>
  );
}

function QuestCreateForm({ onCreate }: { onCreate: (values: QuestCreateValues) => Promise<void> }) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<QuestCreateValues>({
    resolver: zodResolver(questCreateSchema),
    defaultValues: { name: '', description: '', visible: false },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await onCreate(values);
      reset({ name: '', description: '', visible: false });
    } catch {
      setError('root.serverError', {
        type: 'manual',
        message: 'The quest did not bind cleanly. Try again.',
      });
    }
  });

  return (
    <form className="quest-create-panel" onSubmit={onSubmit} noValidate>
      <div className="setup-panel-header">
        <div>
          <p className="eyebrow">New quest</p>
          <h2>Add a task thread</h2>
        </div>
        <p className="form-hint">New quests start hidden unless you mark them visible.</p>
      </div>

      {errors.root?.serverError?.message ? (
        <div className="form-status form-status-error" role="alert">
          {errors.root.serverError.message}
        </div>
      ) : null}

      <div className="quest-create-grid">
        <div className="grid gap-1.5">
          <Label htmlFor="quest-name">Quest Name</Label>
          <Input id="quest-name" placeholder="Recover the blood ledger" {...register('name')} />
          {errors.name ? <span className="form-error">{errors.name.message}</span> : null}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="quest-description">Brief</Label>
          <Textarea
            id="quest-description"
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
            <label className="quest-toggle-row" htmlFor="quest-visible">
              <Checkbox
                id="quest-visible"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
              />
              <span>Reveal to player journals immediately</span>
            </label>
          )}
        />
      </div>

      <div className="form-actions">
        <button className="form-submit" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Adding...' : 'Add Quest'}
        </button>
      </div>
    </form>
  );
}

function QuestCard({
  quest,
  onQuestUpdate,
  onEntryCreate,
  onEntryUpdate,
  onEntryDelete,
}: {
  quest: ListQuests200DataItem;
  onQuestUpdate: (quest: ListQuests200DataItem, values: QuestEditValues) => Promise<void>;
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
    <article className={`quest-card quest-card-${normalizeQuestStatus(quest.status)}`}>
      <QuestEditForm quest={quest} onUpdate={onQuestUpdate} />

      <div className="quest-entry-section">
        <div className="setup-subsection-header">
          <div>
            <p className="detail-label">Steps</p>
            <p className="form-hint">
              Edit the line when completion adds new information, then mark it done.
            </p>
          </div>
          <span className="quest-count">
            {entries.filter((entry) => entry.status === 'done').length}/{entries.length} done
          </span>
        </div>

        {entries.length > 0 ? (
          <div className="quest-entry-list">
            {entries.map((entry) => (
              <QuestEntryEditForm
                key={entry.id}
                quest={quest}
                entry={entry}
                onUpdate={onEntryUpdate}
                onDelete={onEntryDelete}
              />
            ))}
          </div>
        ) : (
          <p className="quest-empty">No steps filed yet.</p>
        )}

        <QuestEntryCreateForm quest={quest} onCreate={onEntryCreate} />
      </div>
    </article>
  );
}

function QuestEditForm({
  quest,
  onUpdate,
}: {
  quest: ListQuests200DataItem;
  onUpdate: (quest: ListQuests200DataItem, values: QuestEditValues) => Promise<void>;
}) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<QuestEditValues>({
    resolver: zodResolver(questEditSchema),
    defaultValues: {
      name: quest.name,
      description: quest.description,
      status: normalizeQuestStatus(quest.status),
      visible: quest.visible,
    },
  });

  useEffect(() => {
    reset({
      name: quest.name,
      description: quest.description,
      status: normalizeQuestStatus(quest.status),
      visible: quest.visible,
    });
  }, [quest.description, quest.name, quest.status, quest.visible, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await onUpdate(quest, values);
    } catch {
      setError('root.serverError', {
        type: 'manual',
        message: 'The quest update did not clear. Try again.',
      });
    }
  });

  return (
    <form className="quest-edit-form" onSubmit={onSubmit} noValidate>
      <div className="quest-card-header">
        <div className="grid gap-1.5 form-field-grow">
          <Label htmlFor={`quest-name-${quest.id}`}>Quest</Label>
          <Input id={`quest-name-${quest.id}`} {...register('name')} />
          {errors.name ? <span className="form-error">{errors.name.message}</span> : null}
        </div>

        <div className="quest-status-grid">
          <div className="grid gap-1.5">
            <Label htmlFor={`quest-status-${quest.id}`}>Status</Label>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id={`quest-status-${quest.id}`} className="quest-select">
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

          <Controller
            control={control}
            name="visible"
            render={({ field }) => (
              <label
                className="quest-toggle-row quest-toggle-compact"
                htmlFor={`quest-vis-${quest.id}`}
              >
                <Checkbox
                  id={`quest-vis-${quest.id}`}
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                />
                <span>Visible</span>
              </label>
            )}
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor={`quest-description-${quest.id}`}>Brief</Label>
        <Textarea id={`quest-description-${quest.id}`} {...register('description')} />
        {errors.description ? (
          <span className="form-error">{errors.description.message}</span>
        ) : null}
      </div>

      {errors.root?.serverError?.message ? (
        <div className="form-status form-status-error" role="alert">
          {errors.root.serverError.message}
        </div>
      ) : null}

      <div className="form-actions quest-actions">
        <button className="form-submit" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save Quest'}
        </button>
      </div>
    </form>
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

      <Button
        className="ghost-action ghost-action-inline"
        type="submit"
        variant="ghost"
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Adding...' : '+ Add Step'}
      </Button>
    </form>
  );
}

function QuestEntryEditForm({
  quest,
  entry,
  onUpdate,
  onDelete,
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
