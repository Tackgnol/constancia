import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useOutletContext, useParams, useRevalidator } from 'react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  createLoreEntry,
  deleteLoreEntry,
  updateLoreEntry,
} from '@constancia/api-client/endpoints/lore/lore';
import type {
  CreateLoreEntryBody,
  ListLoreEntries200DataItem,
  UpdateLoreEntryBody,
} from '@constancia/api-client/model';
import { ManagementWorkspace } from '@/components/layout/management-workspace';
import { SetupNotice } from '@/components/setup/setup-notice';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { assertApiOk, getApiErrorMessage } from '@/lib/api-errors';
import type { WarRoomContext } from '@/lib/war-room-data';

const loreEditSchema = z.object({
  title: z.string().trim().min(1, 'Give the lore entry a title.'),
  content: z.string().trim().min(1, 'Lore content cannot be blank.'),
  sortOrder: z.number().int().min(0, 'Sort order cannot be negative.'),
});

type LoreEditValues = z.infer<typeof loreEditSchema>;

function getSetupBase(warRoom: WarRoomContext) {
  return warRoom.demoMode ? '/demo/setup' : '/setup';
}

function getLoreBoardPath(warRoom: WarRoomContext) {
  return warRoom.demoMode ? '/demo/lore' : '/lore';
}

function createLocalId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function nextLoreSortOrder(loreEntries: ListLoreEntries200DataItem[]): number {
  return loreEntries.length === 0
    ? 0
    : Math.max(...loreEntries.map((loreEntry) => loreEntry.sortOrder)) + 1;
}

function defaultLoreValues(
  loreEntry: ListLoreEntries200DataItem | null,
  loreEntries: ListLoreEntries200DataItem[],
): LoreEditValues {
  return {
    title: loreEntry?.title ?? '',
    content: loreEntry?.content ?? '',
    sortOrder: loreEntry?.sortOrder ?? nextLoreSortOrder(loreEntries),
  };
}

export default function SetupLoreRoute() {
  const warRoom = useOutletContext<WarRoomContext>();
  const { loreId } = useParams();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const setupBase = getSetupBase(warRoom);
  const loreBoardPath = getLoreBoardPath(warRoom);
  const isDemoMode = warRoom.demoMode === true;
  const [localLore, setLocalLore] = useState(warRoom.lore);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loreEntries = isDemoMode ? localLore : warRoom.lore;
  const loreEntry = useMemo(
    () => (loreId ? (loreEntries.find((entry) => entry.id === loreId) ?? null) : null),
    [loreId, loreEntries],
  );
  const isEditing = Boolean(loreId);

  useEffect(() => {
    if (isDemoMode) {
      setLocalLore(warRoom.lore);
    }
  }, [isDemoMode, warRoom.lore]);

  const form = useForm<LoreEditValues>({
    resolver: zodResolver(loreEditSchema),
    defaultValues: defaultLoreValues(loreEntry, loreEntries),
  });

  const {
    register,
    handleSubmit,
    reset,
    setError: setFormError,
    formState: { errors, isSubmitting },
  } = form;

  useEffect(() => {
    reset(defaultLoreValues(loreEntry, loreEntries));
  }, [loreEntry, loreEntries, reset]);

  const onSubmit = handleSubmit(async (values) => {
    const payload: CreateLoreEntryBody | UpdateLoreEntryBody = {
      title: values.title.trim(),
      content: values.content.trim(),
      sortOrder: values.sortOrder,
    };

    try {
      setError(null);
      if (isDemoMode) {
        if (isEditing && loreEntry) {
          setLocalLore((current) =>
            current.map((entry) => (entry.id === loreEntry.id ? { ...entry, ...payload } : entry)),
          );
        } else {
          setLocalLore((current) => [
            ...current,
            {
              id: createLocalId('lore'),
              title: payload.title ?? '',
              content: payload.content ?? '',
              campaignId: warRoom.campaign.id,
              sortOrder: payload.sortOrder ?? nextLoreSortOrder(current),
              knownTo: [],
            },
          ]);
          reset(defaultLoreValues(null, loreEntries));
        }
      } else if (isEditing && loreId) {
        const response = await updateLoreEntry(
          { id: warRoom.campaign.id, loreId },
          payload as UpdateLoreEntryBody,
          { credentials: 'include' },
        );
        assertApiOk(response, 'The lore entry update did not clear. Try again.');
        revalidator.revalidate();
      } else {
        const response = await createLoreEntry(
          { id: warRoom.campaign.id },
          payload as CreateLoreEntryBody,
          { credentials: 'include' },
        );
        assertApiOk(response, 'The lore entry did not file cleanly. Try again.');
        revalidator.revalidate();
        reset(defaultLoreValues(null, loreEntries));
      }

      const message = `${isEditing ? 'Lore updated' : 'Lore filed'}: ${payload.title}`;
      setNotice(message);
      warRoom.recordActivity?.(message);
    } catch (caught) {
      console.error('Save lore error:', caught);
      const message = getApiErrorMessage(
        caught,
        isEditing
          ? 'The lore entry update did not clear. Try again.'
          : 'The lore entry did not file cleanly. Try again.',
      );
      setNotice(null);
      setError(message);
      setFormError('root.serverError', { type: 'manual', message });
    }
  });

  const removeLoreEntry = async () => {
    if (!isEditing || !loreId) {
      return;
    }

    try {
      setError(null);
      if (isDemoMode) {
        setLocalLore((current) => current.filter((entry) => entry.id !== loreId));
        navigate(loreBoardPath);
      } else {
        const response = await deleteLoreEntry(
          { id: warRoom.campaign.id, loreId },
          { credentials: 'include' },
        );
        assertApiOk(response, 'The lore entry did not delete cleanly. Try again.');
        revalidator.revalidate();
        navigate(loreBoardPath);
      }

      const message = `Lore removed: ${loreEntry?.title ?? loreId}`;
      setNotice(message);
      warRoom.recordActivity?.(message);
    } catch (caught) {
      console.error('Delete lore error:', caught);
      setNotice(null);
      setError(getApiErrorMessage(caught, 'The lore entry did not delete cleanly. Try again.'));
    }
  };

  return (
    <ManagementWorkspace
      eyebrow="Setup / Lore"
      title={isEditing ? 'Revise world knowledge' : 'File world knowledge'}
      description={
        isEditing
          ? 'Edit the canonical lore entry here, then reveal it from the Lore board.'
          : 'Write private campaign knowledge before any player can see it.'
      }
      meta={
        <div className="setup-hero-note">
          <p className="detail-label">{isEditing ? 'Lore editor' : 'New lore'}</p>
          <p>{loreEntry ? loreEntry.title : 'New lore starts hidden from every player.'}</p>
        </div>
      }
    >
      <div className="setup-back-row">
        <Link className="setup-inline-link" to={setupBase}>
          Back to setup
        </Link>
        <Link className="setup-inline-link" to={loreBoardPath}>
          Open lore board
        </Link>
      </div>

      {isEditing && !loreEntry ? (
        <SetupNotice label="Lore not found" tone="error">
          <span>This lore entry is not present in the current campaign payload.</span>
        </SetupNotice>
      ) : null}

      {notice ? (
        <SetupNotice label="Lore board updated">
          <span>{notice}</span>
        </SetupNotice>
      ) : null}

      {error ? (
        <SetupNotice label="Lore board failed" tone="error">
          <span>{error}</span>
        </SetupNotice>
      ) : null}

      {!isEditing || loreEntry ? (
        <section className="setup-panel">
          <form className="quest-create-panel" onSubmit={onSubmit} noValidate>
            {errors.root?.serverError?.message ? (
              <div className="form-status form-status-error" role="alert">
                {errors.root.serverError.message}
              </div>
            ) : null}

            <div className="quest-create-grid">
              <div className="grid gap-1.5">
                <Label htmlFor="setup-lore-title">Title</Label>
                <Input
                  id="setup-lore-title"
                  placeholder="The Elysium bells"
                  {...register('title')}
                />
                {errors.title ? <span className="form-error">{errors.title.message}</span> : null}
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="setup-lore-sort">Sort Order</Label>
                <Input
                  id="setup-lore-sort"
                  min={0}
                  type="number"
                  {...register('sortOrder', { valueAsNumber: true })}
                />
                {errors.sortOrder ? (
                  <span className="form-error">{errors.sortOrder.message}</span>
                ) : null}
              </div>

              <div className="grid gap-1.5 form-field-grow">
                <Label htmlFor="setup-lore-content">Lore</Label>
                <Textarea
                  id="setup-lore-content"
                  placeholder="What is true in the world, who knows it, and why it matters."
                  {...register('content')}
                />
                {errors.content ? (
                  <span className="form-error">{errors.content.message}</span>
                ) : null}
              </div>
            </div>

            <div className="form-actions">
              <button className="form-submit" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : isEditing ? 'Save Lore' : 'Add Lore'}
              </button>
              {isEditing ? (
                <button
                  className="ghost-action ghost-action-inline"
                  type="button"
                  onClick={() => void removeLoreEntry()}
                >
                  Delete
                </button>
              ) : null}
            </div>
          </form>
        </section>
      ) : null}
    </ManagementWorkspace>
  );
}
