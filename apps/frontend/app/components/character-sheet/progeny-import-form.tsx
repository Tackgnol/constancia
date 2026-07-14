import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ProgenyImportError,
  parseProgenyVtmCharacter,
  type ProgenyVtmCharacterExport,
} from '@constancia/systems';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CharacterSheetData } from '@/lib/character-sheet';

const MAX_PROGENY_FILE_BYTES = 1_000_000;

function isBrowserFile(value: unknown): value is File {
  return typeof File !== 'undefined' && value instanceof File;
}

const progenyImportSchema = z.object({
  file: z
    .custom<File>(isBrowserFile, { message: 'Choose a Progeny JSON export.' })
    .refine((file) => file.size <= MAX_PROGENY_FILE_BYTES, {
      message: 'The Progeny file must be smaller than 1 MB.',
    })
    .refine(
      (file) => file.name.toLowerCase().endsWith('.json') || file.type === 'application/json',
      { message: 'Choose a JSON file exported by Progeny.' },
    ),
});

type ProgenyImportFormValues = z.infer<typeof progenyImportSchema>;

interface ProgenyImportFormProps {
  onImport: (source: ProgenyVtmCharacterExport) => Promise<CharacterSheetData>;
}

export function ProgenyImportForm({ onImport }: ProgenyImportFormProps) {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProgenyImportFormValues>({
    resolver: zodResolver(progenyImportSchema),
  });

  const submitImport = async (values: ProgenyImportFormValues) => {
    setSuccessMessage(null);

    try {
      const fileText = await values.file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(fileText);
      } catch {
        throw new ProgenyImportError('The selected file is not valid JSON.');
      }

      const imported = parseProgenyVtmCharacter(parsed);
      await onImport(imported.source);
      reset();
      setSuccessMessage(`${imported.gameName} was loaded from Progeny.`);
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : 'The Progeny character could not be imported.';
      setError('file', { type: 'manual', message });
    }
  };

  const errorMessage = errors.file?.message;

  return (
    <form className="progeny-import-form" onSubmit={handleSubmit(submitImport)} noValidate>
      <div className="progeny-import-heading">
        <div>
          <p className="detail-label">Progeny Import</p>
          <h2>Load a VTM V5 character</h2>
        </div>
        <p className="form-hint">
          Select a Progeny JSON export to replace this sheet&apos;s name, backstory, notes, stats,
          clan, disciplines, touchstones, merits, flaws, and other VTM data.
        </p>
      </div>

      <div className="progeny-import-controls">
        <div className="grid gap-1.5">
          <Label htmlFor="progeny-character-file" className="form-label">
            Character JSON
          </Label>
          <Controller
            control={control}
            name="file"
            render={({ field }) => (
              <Input
                id="progeny-character-file"
                name={field.name}
                ref={field.ref}
                type="file"
                accept=".json,application/json"
                className="progeny-file-input"
                aria-invalid={errorMessage ? true : undefined}
                aria-describedby={errorMessage ? 'progeny-character-file-error' : undefined}
                onBlur={field.onBlur}
                onChange={(event) => field.onChange(event.target.files?.[0])}
              />
            )}
          />
        </div>
        <Button className="progeny-import-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Importing…' : 'Import Character'}
        </Button>
      </div>

      {errorMessage ? (
        <p id="progeny-character-file-error" className="form-status form-status-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {successMessage ? (
        <p className="form-status form-status-success" role="status">
          {successMessage}
        </p>
      ) : null}
    </form>
  );
}
