import { useController, useFormContext } from 'react-hook-form';
import type { FieldPath } from 'react-hook-form';
import { Checkbox } from './ui/checkbox.js';
import type { EventFormValues } from '@/lib/event-schema';
import type { RecipientOption } from '@/lib/war-room-data';

interface RecipientMultiValueFieldProps {
  name: FieldPath<EventFormValues>;
  options: RecipientOption[];
  emptyLabel: string;
}

function normalizeRecipientIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
  }

  return [];
}

export function RecipientMultiValueField({
  name,
  options,
  emptyLabel,
}: RecipientMultiValueFieldProps) {
  const { control } = useFormContext<EventFormValues>();
  const { field } = useController({ control, name, defaultValue: [] as never[] });
  const selectedIds = normalizeRecipientIds(field.value);

  const toggleRecipient = (recipientId: string, checked: boolean | 'indeterminate') => {
    if (checked !== true) {
      field.onChange(selectedIds.filter((id) => id !== recipientId));
      return;
    }

    if (selectedIds.includes(recipientId)) {
      return;
    }

    field.onChange([...selectedIds, recipientId]);
  };

  return (
    <div className="grid gap-2 rounded-md border border-border/70 bg-background/40 p-3">
      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selectedIds.map((recipientId) => {
            const option = options.find((entry) => entry.id === recipientId);
            return (
              <span
                key={recipientId}
                className="inline-flex items-center rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[0.7rem] font-mono text-foreground"
              >
                {option?.displayName ?? recipientId}
              </span>
            );
          })}
        </div>
      ) : (
        <span className="text-[0.7rem] font-mono text-muted-foreground">{emptyLabel}</span>
      )}

      <div className="grid max-h-44 gap-2 overflow-y-auto pr-1">
        {options.map((option) => {
          const checked = selectedIds.includes(option.id);
          return (
            <label
              key={option.id}
              className="flex items-start gap-2 rounded-md border border-border/60 bg-background/70 px-2 py-2 text-sm"
            >
              <Checkbox checked={checked} onCheckedChange={(next) => toggleRecipient(option.id, next)} />
              <span className="grid gap-0.5 leading-tight">
                <span className="font-medium text-foreground">{option.displayName}</span>
                <span className="text-[0.7rem] font-mono text-muted-foreground">
                  {option.secondaryLabel}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}


