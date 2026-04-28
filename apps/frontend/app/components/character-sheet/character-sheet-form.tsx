import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { resolveStatRow } from '@/components/character-sheet/renderers';
import type { StatValue } from '@/components/character-sheet/renderers';
import type { CharacterSheetData, CharacterSheetPatchBody } from '@/lib/character-sheet';

const sheetFormSchema = z.object({
  gameName: z.string().trim().max(80, 'Keep the in-game name concise.'),
  backstory: z.string().trim().max(4000, 'Keep the backstory under 4000 characters.'),
  notes: z.string().trim().max(4000, 'Keep the notes under 4000 characters.'),
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
}: {
  sheet: CharacterSheetData;
  audience: 'gm' | 'player';
  onSave: (payload: CharacterSheetPatchBody) => Promise<CharacterSheetData>;
}) {
  const [saveState, setSaveState] = useState<'idle' | 'success' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const archetypeLabel = getArchetypeLabel(sheet);

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, submitCount },
  } = useForm<CharacterSheetFormValues>({
    resolver: zodResolver(sheetFormSchema),
    defaultValues: buildDefaultValues(sheet),
  });

  const StatRow = resolveStatRow(sheet.system.id);

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
          <Input id="sheet-game-name" placeholder="Lucien Vale" {...register('gameName')} />
          {errors.gameName ? <span className="form-error">{errors.gameName.message}</span> : null}
        </div>

        <div className="sheet-copy-grid">
          <div className="grid gap-1.5">
            <Label htmlFor="sheet-backstory" className="form-label">
              Backstory
            </Label>
            <Textarea
              id="sheet-backstory"
              placeholder="Core history, unresolved trauma, or the lie they tell about themselves."
              {...register('backstory')}
            />
            {errors.backstory ? (
              <span className="form-error">{errors.backstory.message}</span>
            ) : null}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="sheet-notes" className="form-label">
              Notes
            </Label>
            <Textarea
              id="sheet-notes"
              placeholder="Recent changes, ambitions, feeding notes, debts, or table reminders."
              {...register('notes')}
            />
            {errors.notes ? <span className="form-error">{errors.notes.message}</span> : null}
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
        </div>

        {sheet.system.statSchema.groups.length === 0 ? (
          <div className="sheet-empty">
            This system does not have a structured sheet configured yet. You can still maintain the
            player name and notes above.
          </div>
        ) : (
          <div className="sheet-groups">
            {sheet.system.statSchema.groups.map((group) => (
              <section key={group.key} className="sheet-stat-group">
                <div className="sheet-stat-group-header">
                  <p className="detail-label">{group.label}</p>
                </div>

                <div className="sheet-stat-grid">
                  {group.fields.map((field) => {
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
              </section>
            ))}
          </div>
        )}
      </section>

      <div className="form-actions">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? 'Saving Sheet…'
            : audience === 'player'
              ? 'Update My Sheet'
              : 'Save Sheet'}
        </Button>
      </div>
    </form>
  );
}
