import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
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
import { buildServerApiOptions } from '@/lib/api-proxy.server';
import { SetupNotice } from '@/components/setup/setup-notice';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { assertApiOk, getApiErrorMessage } from '@/lib/api-errors';
import { postRouteAction } from '@/lib/route-action-client';
import type { WarRoomContext } from '@/lib/war-room-data';

const loreSaveError =
  "We couldn't save this lore entry. Your draft is still in the form; review the highlighted fields and try again.";
const loreDeleteError =
  "We couldn't delete this lore entry. It is still on the Lore board; reopen it and try again.";

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

function parseLorePayload(
  input: FormDataEntryValue | null,
): CreateLoreEntryBody | UpdateLoreEntryBody | null {
  if (typeof input !== 'string' || input.length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(input) as unknown;
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as CreateLoreEntryBody | UpdateLoreEntryBody)
      : null;
  } catch {
    return null;
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get('intent');
  const campaignId = formData.get('campaignId');
  const loreId = formData.get('loreId');
  const payload = parseLorePayload(formData.get('payload'));
  const apiOptions = buildServerApiOptions(request);

  if (typeof campaignId !== 'string' || campaignId.length === 0) {
    return Response.json(
      {
        status: 'error',
        message: "We couldn't identify this campaign. Return to Setup and reopen the lore entry.",
      },
      { status: 400 },
    );
  }

  try {
    if (intent === 'save-lore') {
      if (!payload) {
        return Response.json(
          {
            status: 'error',
            message: "We couldn't read this lore draft. Review the highlighted fields and retry.",
          },
          { status: 400 },
        );
      }

      if (typeof loreId === 'string' && loreId.length > 0) {
        const response = await updateLoreEntry(
          { id: campaignId, loreId },
          payload as UpdateLoreEntryBody,
          apiOptions,
        );
        assertApiOk(response, loreSaveError);
      } else {
        const response = await createLoreEntry(
          { id: campaignId },
          payload as CreateLoreEntryBody,
          apiOptions,
        );
        assertApiOk(response, loreSaveError);
      }

      return Response.json({ status: 'success' });
    }

    if (intent === 'delete-lore') {
      if (typeof loreId !== 'string' || loreId.length === 0) {
        return Response.json(
          {
            status: 'error',
            message: "We couldn't identify this lore entry. Return to Lore and open it again.",
          },
          { status: 400 },
        );
      }

      const response = await deleteLoreEntry({ id: campaignId, loreId }, apiOptions);
      assertApiOk(response, loreDeleteError);
      return Response.json({ status: 'success' });
    }

    return Response.json({ status: 'error', message: 'Unsupported lore action.' }, { status: 400 });
  } catch (caught) {
    const fallbackMessage = intent === 'delete-lore' ? loreDeleteError : loreSaveError;

    return Response.json(
      { status: 'error', message: getApiErrorMessage(caught, fallbackMessage) },
      { status: 500 },
    );
  }
}

export default function SetupLoreRoute() {
  const warRoom = useOutletContext<WarRoomContext>();
  const { loreId } = useParams();
  const location = useLocation();
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
      } else {
        const response = await postRouteAction(location.pathname, {
          intent: 'save-lore',
          campaignId: warRoom.campaign.id,
          loreId: loreId ?? '',
          payload: JSON.stringify(payload),
        });

        if (response.status !== 'success') {
          throw new Error(response.message);
        }

        revalidator.revalidate();
        if (!isEditing) {
          reset(defaultLoreValues(null, loreEntries));
        }
      }

      const message = `${isEditing ? 'Lore updated' : 'Lore filed'}: ${payload.title}`;
      setNotice(message);
      warRoom.recordActivity?.(message);
    } catch (caught) {
      console.error('Save lore error:', caught);
      const message = getApiErrorMessage(caught, loreSaveError);
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
        const response = await postRouteAction(location.pathname, {
          intent: 'delete-lore',
          campaignId: warRoom.campaign.id,
          loreId,
        });

        if (response.status !== 'success') {
          throw new Error(response.message);
        }

        revalidator.revalidate();
        navigate(loreBoardPath);
      }

      const message = `Lore removed: ${loreEntry?.title ?? loreId}`;
      setNotice(message);
      warRoom.recordActivity?.(message);
    } catch (caught) {
      console.error('Delete lore error:', caught);
      setNotice(null);
      setError(getApiErrorMessage(caught, loreDeleteError));
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
            <div className="form-workbench-heading">
              <div>
                <p className="detail-label">Lore record</p>
                <h2>{isEditing ? 'Edit the canonical entry' : 'Record what is true'}</h2>
              </div>
              <p className="form-hint">
                Write the durable truth here. Player access is managed separately from the Lore
                board.
              </p>
            </div>

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
                <Label htmlFor="setup-lore-sort">Sort order</Label>
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

              <div className="grid gap-1.5 form-field-grow setup-field-wide">
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

            <div className="form-actions form-action-dock">
              <button className="form-submit" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving…' : isEditing ? 'Save lore entry' : 'Create lore entry'}
              </button>
              {isEditing ? (
                <button
                  className="ghost-action ghost-action-inline"
                  type="button"
                  onClick={() => void removeLoreEntry()}
                >
                  Delete lore entry
                </button>
              ) : null}
            </div>
          </form>
        </section>
      ) : null}
    </ManagementWorkspace>
  );
}
