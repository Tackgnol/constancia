import { useMemo, useState } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { useOutletContext } from 'react-router';
import { VTM_ATTRIBUTES, VTM_SKILLS, type VtmStatOption } from '@constancia/systems';
import { Input } from './ui/input.js';
import { RecipientMultiValueField } from './recipient-multi-value-field.js';
import { Label } from './ui/label.js';
import { Textarea } from './ui/textarea.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select.js';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './ui/command.js';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover.js';
import type { BlockType, EventFormValues } from '@/lib/event-schema';
import { buildRecipientOptions, type WarRoomContext } from '@/lib/war-room-data';

interface Props {
  index: number;
  blockType: BlockType;
}

const OPERATOR_OPTIONS = [
  { value: 'gte', label: '≥  at least' },
  { value: 'gt', label: '>  more than' },
  { value: 'lte', label: '≤  at most' },
  { value: 'lt', label: '<  less than' },
  { value: 'eq', label: '=  exactly' },
];

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <span className="text-xs text-destructive-foreground font-mono">{message}</span>;
}

function ConfigField({
  label,
  optional,
  hint,
  children,
  error,
}: {
  label: string;
  optional?: boolean;
  hint?: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-muted-foreground text-[0.65rem] tracking-[0.18em] uppercase font-mono font-semibold">
        {label}
        {optional && (
          <span className="ml-1 font-normal normal-case tracking-normal opacity-60">optional</span>
        )}
      </Label>
      {children}
      {hint && (
        <span className="text-[0.65rem] text-muted-foreground font-mono opacity-70 leading-snug">
          {hint}
        </span>
      )}
      <FieldError message={error} />
    </div>
  );
}

export function BlockConfigFields({ index, blockType }: Props) {
  const warRoom = useOutletContext<WarRoomContext>();
  const {
    register,
    formState: { errors },
  } = useFormContext<EventFormValues>();
  const blockErrors = (errors.pipeline?.[index]?.config ?? {}) as Record<
    string,
    { message?: string }
  >;
  const recipientOptions = buildRecipientOptions(warRoom.rawCharacters, warRoom.players);

  if (blockType === 'message-player') {
    return (
      <div className="grid gap-3">
        <ConfigField label="Content" error={blockErrors.content?.message}>
          <Textarea
            rows={3}
            placeholder="Message text sent to the player…"
            {...register(`pipeline.${index}.config.content` as const)}
          />
        </ConfigField>
        <div className="grid grid-cols-2 gap-3">
          <ConfigField
            label="Player IDs"
            optional
            hint="Leave blank to target the triggering player. Choose one or many recipients below."
          >
            <RecipientMultiValueField
              name={`pipeline.${index}.config.playerIds` as const}
              options={recipientOptions}
              emptyLabel="No specific recipients selected — the triggering player will receive the message."
            />
          </ConfigField>
          <ConfigField label="Image URL" optional>
            <Input
              type="text"
              placeholder="https://…"
              {...register(`pipeline.${index}.config.imageUrl` as const)}
            />
          </ConfigField>
        </div>
      </div>
    );
  }

  if (blockType === 'message-channel') {
    return (
      <div className="grid gap-3">
        <ConfigField label="Content" error={blockErrors.content?.message}>
          <Textarea
            rows={3}
            placeholder="Message text sent to the channel…"
            {...register(`pipeline.${index}.config.content` as const)}
          />
        </ConfigField>
        <ConfigField label="Image URL" optional>
          <Input
            type="text"
            placeholder="https://…"
            {...register(`pipeline.${index}.config.imageUrl` as const)}
          />
        </ConfigField>
      </div>
    );
  }

  if (blockType === 'message-group') {
    return (
      <div className="grid gap-3">
        <ConfigField label="Content" error={blockErrors.content?.message}>
          <Textarea
            rows={3}
            placeholder="Message text sent to the group…"
            {...register(`pipeline.${index}.config.content` as const)}
          />
        </ConfigField>
        <div className="grid grid-cols-2 gap-3">
          <ConfigField
            label="Player IDs"
            optional
            hint="Pick the group recipients explicitly. Empty groups will not emit a message."
          >
            <RecipientMultiValueField
              name={`pipeline.${index}.config.groupPlayerIds` as const}
              options={recipientOptions}
              emptyLabel="No group recipients selected yet."
            />
          </ConfigField>
          <ConfigField label="Image URL" optional>
            <Input
              type="text"
              placeholder="https://…"
              {...register(`pipeline.${index}.config.imageUrl` as const)}
            />
          </ConfigField>
        </div>
      </div>
    );
  }

  if (blockType === 'display-image') {
    return (
      <div className="grid grid-cols-2 gap-3">
        <ConfigField label="Image URL" error={blockErrors.imageUrl?.message}>
          <Input
            type="text"
            placeholder="https://…"
            {...register(`pipeline.${index}.config.imageUrl` as const)}
          />
        </ConfigField>
        <ConfigField label="Caption" optional>
          <Input
            type="text"
            placeholder="What appears below the image…"
            {...register(`pipeline.${index}.config.caption` as const)}
          />
        </ConfigField>
      </div>
    );
  }

  if (blockType === 'conditional-gate') {
    return (
      <div className="grid grid-cols-3 gap-3">
        <ConfigField label="Stat Path" error={blockErrors.statPath?.message}>
          <Input
            type="text"
            placeholder="attributes.strength"
            {...register(`pipeline.${index}.config.statPath` as const)}
          />
        </ConfigField>
        <ConfigField label="Operator">
          <OperatorSelect index={index} />
        </ConfigField>
        <ConfigField label="Threshold" error={blockErrors.threshold?.message}>
          <Input
            type="number"
            placeholder="1"
            {...register(`pipeline.${index}.config.threshold` as const)}
          />
        </ConfigField>
      </div>
    );
  }

  if (blockType === 'outcome-map') {
    return <OutcomeMapConfig index={index} />;
  }

  if (blockType === 'retrieve-data') {
    return (
      <div className="grid gap-3">
        <ConfigField label="Data Type" error={blockErrors.dataType?.message}>
          <Input
            type="text"
            placeholder="character, npc, location…"
            {...register(`pipeline.${index}.config.dataType` as const)}
          />
        </ConfigField>
      </div>
    );
  }

  if (blockType === 'vtm-pool-resolver') {
    return (
      <div className="grid grid-cols-3 gap-3">
        <ConfigField
          label="Attribute"
          hint="VTM attribute list only for this resolver block."
          error={blockErrors.attribute?.message}
        >
          <VtmStatAutocomplete
            name={`pipeline.${index}.config.attribute` as const}
            options={VTM_ATTRIBUTES}
            placeholder="Pick attribute…"
            searchPlaceholder="Search attributes…"
            emptyLabel="No matching VTM attribute."
          />
        </ConfigField>
        <ConfigField
          label="Skill"
          hint="VTM skill list only for this resolver block."
          error={blockErrors.skill?.message}
        >
          <VtmStatAutocomplete
            name={`pipeline.${index}.config.skill` as const}
            options={VTM_SKILLS}
            placeholder="Pick skill…"
            searchPlaceholder="Search skills…"
            emptyLabel="No matching VTM skill."
          />
        </ConfigField>
        <ConfigField label="Difficulty (1–10)" error={blockErrors.difficulty?.message}>
          <Input
            type="number"
            min={1}
            max={10}
            {...register(`pipeline.${index}.config.difficulty` as const)}
          />
        </ConfigField>
      </div>
    );
  }

  if (blockType === 'vtm-insight-resolver') {
    return (
      <div className="grid grid-cols-2 gap-3">
        <ConfigField
          label="Attribute"
          hint="VTM attribute used in the passive insight total."
          error={blockErrors.attribute?.message}
        >
          <VtmStatAutocomplete
            name={`pipeline.${index}.config.attribute` as const}
            options={VTM_ATTRIBUTES}
            placeholder="Pick attribute…"
            searchPlaceholder="Search attributes…"
            emptyLabel="No matching VTM attribute."
          />
        </ConfigField>
        <ConfigField
          label="Skill"
          hint="VTM skill added to the insight total for each player."
          error={blockErrors.skill?.message}
        >
          <VtmStatAutocomplete
            name={`pipeline.${index}.config.skill` as const}
            options={VTM_SKILLS}
            placeholder="Pick skill…"
            searchPlaceholder="Search skills…"
            emptyLabel="No matching VTM skill."
          />
        </ConfigField>
      </div>
    );
  }

  return null;
}

function VtmStatAutocomplete({
  name,
  options,
  placeholder,
  searchPlaceholder,
  emptyLabel,
}: {
  name: `pipeline.${number}.config.attribute` | `pipeline.${number}.config.skill`;
  options: readonly VtmStatOption[];
  placeholder: string;
  searchPlaceholder: string;
  emptyLabel: string;
}) {
  const { register, setValue, watch } = useFormContext<EventFormValues>();
  const [open, setOpen] = useState(false);
  const value = (watch(name) as string | undefined) ?? '';
  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  return (
    <>
      <input type="hidden" {...register(name)} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className="stat-autocomplete-trigger" type="button">
            <span>{selectedOption?.label ?? placeholder}</span>
            <span className="stat-autocomplete-value">
              {selectedOption ? selectedOption.value : 'Search'}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="stat-autocomplete-popover p-0">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyLabel}</CommandEmpty>
              <CommandGroup heading="VTM V5">
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={`${option.label} ${option.value}`}
                    onSelect={() => {
                      setValue(name, option.value, {
                        shouldDirty: true,
                        shouldTouch: true,
                        shouldValidate: true,
                      });
                      setOpen(false);
                    }}
                  >
                    <span className="stat-option-copy">
                      <strong>{option.label}</strong>
                      <span>{option.value}</span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}

// Operator select — uses Radix Select via Shadcn
function OperatorSelect({ index }: { index: number }) {
  const { setValue, watch } = useFormContext<EventFormValues>();
  const value = (watch(`pipeline.${index}.config.operator` as never) as unknown as string) ?? 'gte';

  return (
    <Select
      value={value}
      onValueChange={(v) => setValue(`pipeline.${index}.config.operator` as never, v as never)}
    >
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OPERATOR_OPTIONS.map((op) => (
          <SelectItem key={op.value} value={op.value}>
            {op.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Outcome Map — nested field array
function OutcomeMapConfig({ index }: { index: number }) {
  const { register, control } = useFormContext<EventFormValues>();
  const { fields, append, remove } = useFieldArray({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    control: control as any,
    name: `pipeline.${index}.config.outcomes` as never,
  });

  return (
    <div className="grid gap-3">
      <Label className="text-muted-foreground text-[0.65rem] tracking-[0.18em] uppercase font-mono font-semibold">
        Outcomes
      </Label>
      <div className="grid gap-2">
        {fields.map((field, outcomeIndex) => (
          <div key={field.id} className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="Min"
              className="w-20 shrink-0"
              {...register(`pipeline.${index}.config.outcomes.${outcomeIndex}.minScore` as never)}
            />
            <span className="text-muted-foreground font-mono text-xs shrink-0">—</span>
            <Input
              type="number"
              placeholder="Max"
              className="w-20 shrink-0"
              {...register(`pipeline.${index}.config.outcomes.${outcomeIndex}.maxScore` as never)}
            />
            <Input
              type="text"
              placeholder="Outcome text…"
              className="flex-1"
              {...register(`pipeline.${index}.config.outcomes.${outcomeIndex}.text` as never)}
            />
            <button
              className="shrink-0 text-muted-foreground hover:text-destructive-foreground font-mono text-base w-6 h-6 flex items-center justify-center transition-colors"
              onClick={() => remove(outcomeIndex)}
              type="button"
              aria-label="Remove outcome"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        className="text-left text-muted-foreground hover:text-foreground font-mono text-[0.68rem] tracking-[0.14em] uppercase transition-colors"
        onClick={() => append({ minScore: 0, maxScore: 10, text: '' })}
        type="button"
      >
        + Add Outcome
      </button>
    </div>
  );
}
