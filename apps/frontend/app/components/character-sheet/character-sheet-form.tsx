import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ProgenyImportForm } from '@/components/character-sheet/progeny-import-form';
import { resolveStatRow } from '@/components/character-sheet/renderers';
import type { StatValue } from '@/components/character-sheet/renderers';
import type { CharacterSheetData, CharacterSheetPatchBody } from '@/lib/character-sheet';
import type { ProgenyVtmCharacterExport } from '@constancia/systems';

const GAME_NAME_MAX = 80;
const LONGFORM_MAX = 4000;

const sheetFormSchema = z.object({
  gameName: z.string().trim().max(GAME_NAME_MAX, 'Keep the in-game name concise.'),
  backstory: z
    .string()
    .trim()
    .max(LONGFORM_MAX, `Keep the backstory under ${LONGFORM_MAX} characters.`),
  notes: z.string().trim().max(LONGFORM_MAX, `Keep the notes under ${LONGFORM_MAX} characters.`),
  stats: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])),
});

type CharacterSheetFormValues = z.infer<typeof sheetFormSchema>;

function buildDefaultValues(sheet: CharacterSheetData): CharacterSheetFormValues {
  return {
    gameName: sheet.character.gameName,
    backstory: sheet.character.backstory,
    notes: sheet.character.notes,
    stats: sheet.stats,
  };
}

function isZeroStat(value: unknown): boolean {
  return value == null || value === 0 || value === '' || value === false;
}

function getArchetypeLabel(sheet: CharacterSheetData): string | null {
  const systemData = sheet.character.systemData;
  if (typeof systemData.clan === 'string' && systemData.clan.length > 0) {
    return systemData.clan;
  }

  if (typeof systemData['creature-type'] === 'string' && systemData['creature-type'].length > 0) {
    return systemData['creature-type'];
  }

  return null;
}

export function CharacterSheetForm({
  sheet,
  audience,
  onSave,
  onImportProgeny,
}: {
  sheet: CharacterSheetData;
  audience: 'gm' | 'player';
  onSave: (payload: CharacterSheetPatchBody) => Promise<CharacterSheetData>;
  onImportProgeny?: (source: ProgenyVtmCharacterExport) => Promise<CharacterSheetData>;
}) {
  const [saveState, setSaveState] = useState<'idle' | 'success' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [hideZeros, setHideZeros] = useState(audience === 'player');
  const [openGroups, setOpenGroups] = useState(
    () =>
      new Set(
        audience === 'gm'
          ? sheet.system.statSchema.groups.map((group) => group.key)
          : ['attributes'],
      ),
  );
  const archetypeLabel = getArchetypeLabel(sheet);

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty, isSubmitting, submitCount },
  } = useForm<CharacterSheetFormValues>({
    resolver: zodResolver(sheetFormSchema),
    defaultValues: buildDefaultValues(sheet),
  });

  const StatRow = resolveStatRow(sheet.system.id);

  const backstoryLength = (useWatch({ control, name: 'backstory' }) ?? '').length;
  const notesLength = (useWatch({ control, name: 'notes' }) ?? '').length;

  const watchedStats = useWatch({ control, name: 'stats' }) ?? sheet.stats;
  const visibleGroups = sheet.system.statSchema.groups
    .map((group) => ({
      group,
      fields: hideZeros
        ? group.fields.filter((field) => !isZeroStat(watchedStats[field.key]))
        : group.fields,
    }))
    .filter((entry) => entry.fields.length > 0);

  useEffect(() => {
    reset(buildDefaultValues(sheet));
    setSaveState('idle');
    setSaveMessage(null);
  }, [reset, sheet]);

  const hasValidationErrors = submitCount > 0 && Object.keys(errors).some((key) => key !== 'root');

  const onSubmit = async (values: CharacterSheetFormValues) => {
    try {
      const updated = await onSave({
        gameName: values.gameName.trim(),
        backstory: values.backstory.trim(),
        notes: values.notes.trim(),
        stats: values.stats as CharacterSheetPatchBody['stats'],
      });

      reset(buildDefaultValues(updated));
      setSaveState('success');
      setSaveMessage(
        audience === 'player'
          ? 'Your sheet is synced. The GM-facing data stayed untouched.'
          : 'Character sheet updated successfully.',
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'The sheet could not be saved. Try again.';
      setError('root.serverError', { type: 'manual', message });
      setSaveState('error');
      setSaveMessage(message);
    }
  };

  return (
    <>
      {audience === 'player' && sheet.system.id === 'vtm-v5' && onImportProgeny ? (
        <ProgenyImportForm onImport={onImportProgeny} />
      ) : null}

      <form className="event-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        {hasValidationErrors ? (
          <div className="form-status form-status-error" role="alert">
            The sheet still has invalid fields. Check the highlighted stats before saving.
          </div>
        ) : null}
        {saveMessage ? (
          <div
            className={`form-status ${saveState === 'error' ? 'form-status-error' : 'form-status-success'}`}
            role="status"
          >
            {saveMessage}
          </div>
        ) : null}
        {errors.root?.serverError?.message ? (
          <div className="form-status form-status-error" role="alert">
            {errors.root.serverError.message}
          </div>
        ) : null}

        <section className="form-section">
          <div className="sheet-meta-grid">
            <article className="sheet-meta-card">
              <p className="detail-label">Discord identity</p>
              <strong>{sheet.character.discordName || sheet.character.name}</strong>
              <span>{sheet.character.discordUserId}</span>
            </article>
            <article className="sheet-meta-card">
              <p className="detail-label">System</p>
              <strong>{sheet.system.name}</strong>
              <span>
                {sheet.access.mode === 'gm' ? 'GM editing scope' : 'Player self-edit scope'}
              </span>
            </article>
            <article className="sheet-meta-card">
              <p className="detail-label">
                {audience === 'player' ? 'Character role' : 'Current archetype'}
              </p>
              <strong>{archetypeLabel ?? 'Unassigned'}</strong>
              <span>{sheet.character.gameName || 'Discord name fallback active'}</span>
            </article>
          </div>
        </section>

        <section className="form-section">
          <div className="sheet-section-header">
            <div>
              <p className="detail-label">Identity</p>
              <p className="form-hint">The public-facing name and longform notes live here.</p>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="sheet-game-name" className="form-label">
              In-Game Name
            </Label>
            <Input
              id="sheet-game-name"
              placeholder="Lucien Vale"
              maxLength={GAME_NAME_MAX}
              {...register('gameName')}
            />
            {errors.gameName ? <span className="form-error">{errors.gameName.message}</span> : null}
          </div>

          <div className="sheet-copy-grid">
            <div className="grid gap-1.5">
              <Label htmlFor="sheet-backstory" className="form-label">
                Backstory
              </Label>
              <Textarea
                id="sheet-backstory"
                className="sheet-longform"
                placeholder="Core history, unresolved trauma, or the lie they tell about themselves."
                maxLength={LONGFORM_MAX}
                {...register('backstory')}
              />
              <div className="sheet-field-footer">
                {errors.backstory ? (
                  <span className="form-error">{errors.backstory.message}</span>
                ) : (
                  <span />
                )}
                <span
                  className={`sheet-char-count${backstoryLength >= LONGFORM_MAX ? ' is-maxed' : ''}`}
                >
                  {backstoryLength}/{LONGFORM_MAX}
                </span>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="sheet-notes" className="form-label">
                Notes
              </Label>
              <Textarea
                id="sheet-notes"
                className="sheet-longform"
                placeholder="Recent changes, ambitions, feeding notes, debts, or table reminders."
                maxLength={LONGFORM_MAX}
                {...register('notes')}
              />
              <div className="sheet-field-footer">
                {errors.notes ? (
                  <span className="form-error">{errors.notes.message}</span>
                ) : (
                  <span />
                )}
                <span
                  className={`sheet-char-count${notesLength >= LONGFORM_MAX ? ' is-maxed' : ''}`}
                >
                  {notesLength}/{LONGFORM_MAX}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="form-section">
          <div className="sheet-section-header">
            <div>
              <p className="detail-label">System Stats</p>
              <p className="form-hint">
                Structured stats come from the active game system so both the GM and the player are
                editing the same canonical shape.
              </p>
            </div>
            {sheet.system.statSchema.groups.length > 0 ? (
              <label className="sheet-zero-toggle">
                <input
                  type="checkbox"
                  className="form-checkbox"
                  checked={hideZeros}
                  onChange={(event) => setHideZeros(event.target.checked)}
                />
                Hide zeroed stats
              </label>
            ) : null}
          </div>

          {sheet.system.statSchema.groups.length === 0 ? (
            <div className="sheet-empty">
              This system does not have a structured sheet configured yet. You can still maintain
              the player name and notes above.
            </div>
          ) : visibleGroups.length === 0 ? (
            <div className="sheet-empty">
              Every stat on this sheet is still at zero. Uncheck “Hide zeroed stats” to fill them
              in.
            </div>
          ) : (
            <div className="sheet-groups">
              {visibleGroups.map(({ group, fields }) => (
                <details
                  key={group.key}
                  className="sheet-stat-group"
                  open={openGroups.has(group.key)}
                  onToggle={(event) => {
                    const isOpen = event.currentTarget.open;
                    setOpenGroups((current) => {
                      const next = new Set(current);
                      if (isOpen) {
                        next.add(group.key);
                      } else {
                        next.delete(group.key);
                      }
                      return next;
                    });
                  }}
                >
                  <summary className="sheet-stat-group-header">
                    <span className="detail-label">{group.label}</span>
                    <span className="sheet-stat-group-count">{fields.length} shown</span>
                  </summary>

                  <div className="sheet-stat-grid">
                    {fields.map((field) => {
                      const inputId = `stat-${field.key}`;
                      const errorMessage = errors.stats?.[field.key]
                        ? String(errors.stats[field.key]?.message)
                        : undefined;

                      return (
                        <div key={field.key} className="sheet-stat-cell">
                          <Label htmlFor={inputId} className="form-label">
                            {field.label}
                          </Label>
                          <Controller
                            control={control}
                            name={`stats.${field.key}` as const}
                            rules={{
                              min:
                                typeof field.min === 'number'
                                  ? {
                                      value: field.min,
                                      message: `${field.label} cannot go below ${field.min}.`,
                                    }
                                  : undefined,
                              max:
                                typeof field.max === 'number'
                                  ? {
                                      value: field.max,
                                      message: `${field.label} cannot go above ${field.max}.`,
                                    }
                                  : undefined,
                            }}
                            render={({ field: rhf }) => (
                              <StatRow
                                error={errorMessage}
                                field={field}
                                inputId={inputId}
                                onBlur={rhf.onBlur}
                                onChange={(next: StatValue) => rhf.onChange(next)}
                                value={rhf.value as StatValue}
                              />
                            )}
                          />
                          {errorMessage ? <span className="form-error">{errorMessage}</span> : null}
                        </div>
                      );
                    })}
                  </div>
                </details>
              ))}
            </div>
          )}
        </section>

        <div className="form-actions form-action-dock sheet-save-bar">
          <span className="sheet-save-state" aria-live="polite">
            {isDirty
              ? 'Unsaved changes'
              : saveState === 'success'
                ? 'All changes saved'
                : 'No unsaved changes'}
          </span>
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            {isSubmitting
              ? 'Saving Sheet…'
              : audience === 'player'
                ? 'Update My Sheet'
                : 'Save Sheet'}
          </Button>
        </div>
      </form>
    </>
  );
}
