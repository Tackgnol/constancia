import { useState, type ComponentType, type ReactNode } from 'react';
import { Controller, useFormContext, type FieldPath } from 'react-hook-form';
import { useLocation, useOutletContext } from 'react-router';
import { requirePipelineBlockSpec, type PipelineEditorField } from '@constancia/block-catalogue';
import { getStatSchemaForSystem } from '@constancia/systems';
import { ImageUploadField } from '@/components/forms/image-upload-field';
import type { BlockType, EventFormValues } from '@/lib/event-schema';
import { buildRecipientOptions, type WarRoomContext } from '@/lib/war-room-data';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './ui/command.js';
import { Checkbox } from './ui/checkbox.js';
import { Input } from './ui/input.js';
import { Label } from './ui/label.js';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover.js';
import { RecipientMultiValueField } from './recipient-multi-value-field.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select.js';
import { Textarea } from './ui/textarea.js';

interface Props {
  index: number;
  blockType: BlockType;
}

type EditorFieldKind = PipelineEditorField['kind'];

interface FieldAdapterProps {
  field: PipelineEditorField;
  index: number;
  name: FieldPath<EventFormValues>;
  warRoom: WarRoomContext;
}

type FieldAdapter = ComponentType<FieldAdapterProps>;

function configPath(index: number, path: string): FieldPath<EventFormValues> {
  return `pipeline.${index}.config.${path}` as FieldPath<EventFormValues>;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <span className="text-xs text-destructive-foreground font-mono">{message}</span>;
}

function ConfigField({
  field,
  error,
  children,
}: {
  field: PipelineEditorField;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-muted-foreground text-[0.7rem] tracking-[0.16em] uppercase font-mono font-semibold">
        {field.label}
        {field.optional && (
          <span className="ml-1 font-normal normal-case tracking-normal opacity-60">optional</span>
        )}
      </Label>
      {children}
      {field.hint && (
        <span className="text-[0.7rem] text-muted-foreground font-mono leading-snug">
          {field.hint}
        </span>
      )}
      <FieldError message={error} />
    </div>
  );
}

function TextFieldAdapter({ field, name }: FieldAdapterProps) {
  const { register } = useFormContext<EventFormValues>();
  return <Input type="text" placeholder={field.placeholder} {...register(name)} />;
}

function TextareaFieldAdapter({ field, name }: FieldAdapterProps) {
  const { register } = useFormContext<EventFormValues>();
  return <Textarea rows={field.rows ?? 3} placeholder={field.placeholder} {...register(name)} />;
}

function NumberFieldAdapter({ field, name }: FieldAdapterProps) {
  const { register } = useFormContext<EventFormValues>();
  return <Input type="number" placeholder={field.placeholder} {...register(name)} />;
}

function BooleanFieldAdapter({ field, name, index }: FieldAdapterProps) {
  const { control } = useFormContext<EventFormValues>();
  const id = `pipeline-${index}-${field.path}`;
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: formField }) => (
        <label className="quest-toggle-row" htmlFor={id}>
          <Checkbox
            id={id}
            checked={formField.value === true}
            onCheckedChange={(checked) => formField.onChange(checked === true)}
          />
          <span>{field.label}</span>
        </label>
      )}
    />
  );
}

function JsonFieldAdapter({ field, name }: FieldAdapterProps) {
  const { control } = useFormContext<EventFormValues>();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: formField }) => {
        const value =
          typeof formField.value === 'string'
            ? formField.value
            : JSON.stringify(formField.value ?? {}, null, 2);
        return (
          <Textarea
            rows={field.rows ?? 4}
            placeholder={field.placeholder ?? '{ }'}
            value={value}
            onChange={(event) => formField.onChange(event.currentTarget.value)}
            onBlur={(event) => {
              try {
                formField.onChange(JSON.parse(event.currentTarget.value));
              } catch {
                formField.onBlur();
              }
            }}
          />
        );
      }}
    />
  );
}

function SelectFieldAdapter({ field, name }: FieldAdapterProps) {
  const { control } = useFormContext<EventFormValues>();
  if (field.kind !== 'select') return null;
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: formField }) => (
        <Select
          value={typeof formField.value === 'string' ? formField.value : undefined}
          onValueChange={formField.onChange}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );
}

function RecipientsFieldAdapter({ field, name, warRoom }: FieldAdapterProps) {
  if (field.kind !== 'recipients') return null;
  const options = buildRecipientOptions(warRoom.rawCharacters, warRoom.players);
  const defaultEmptyLabel =
    field.mode === 'player'
      ? 'No specific recipients selected — the triggering player will receive the message.'
      : 'No group recipients selected yet.';
  return (
    <RecipientMultiValueField
      name={name}
      options={options}
      emptyLabel={field.emptyLabel ?? defaultEmptyLabel}
    />
  );
}

function ImageFieldAdapter({ field, name, warRoom, index }: FieldAdapterProps) {
  const location = useLocation();
  const { control, watch } = useFormContext<EventFormValues>();
  if (field.kind !== 'image') return null;
  const captionName = field.captionPath ? configPath(index, field.captionPath) : undefined;
  const captionValue = captionName ? watch(captionName) : undefined;
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: formField }) => (
        <ImageUploadField
          id={name}
          actionPath={location.pathname}
          caption={typeof captionValue === 'string' ? captionValue : ''}
          disabled={warRoom.demoMode ?? warRoom.campaign.id.startsWith('demo-')}
          onChange={formField.onChange}
          value={typeof formField.value === 'string' ? formField.value : ''}
        />
      )}
    />
  );
}

function SystemStatFieldAdapter({ field, name, warRoom }: FieldAdapterProps) {
  const { control } = useFormContext<EventFormValues>();
  const [open, setOpen] = useState(false);
  if (field.kind !== 'system-stat-select') return null;
  const statGroup = getStatSchemaForSystem(warRoom.system.id).groups.find(
    (group) => group.key === field.statGroup,
  );
  const options = statGroup?.fields ?? [];
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: formField }) => {
        const value = typeof formField.value === 'string' ? formField.value : '';
        const selectedOption = options.find((option) => option.key === value) ?? null;
        return (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button className="stat-autocomplete-trigger" type="button">
                <span>{selectedOption?.label ?? `Pick ${field.label.toLowerCase()}…`}</span>
                <span className="stat-autocomplete-value">
                  {selectedOption ? selectedOption.key : 'Search'}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="stat-autocomplete-popover p-0">
              <Command>
                <CommandInput placeholder={`Search ${field.label.toLowerCase()}s…`} />
                <CommandList>
                  <CommandEmpty>No matching {field.label.toLowerCase()}.</CommandEmpty>
                  <CommandGroup heading={statGroup?.label ?? warRoom.system.name}>
                    {options.map((option) => (
                      <CommandItem
                        key={option.key}
                        value={`${option.label} ${option.key}`}
                        onSelect={() => {
                          formField.onChange(option.key);
                          setOpen(false);
                        }}
                      >
                        <span className="stat-option-copy">
                          <strong>{option.label}</strong>
                          <span>{option.key}</span>
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        );
      }}
    />
  );
}

interface OutcomeEntry {
  threshold: number | string;
  text: string;
  loreEntryIds: string[];
  npcFactIds: string[];
}

function normalizeStringIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
}

function normalizeOutcomes(value: unknown): OutcomeEntry[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    if (typeof entry !== 'object' || entry === null) {
      return { threshold: 0, text: '', loreEntryIds: [], npcFactIds: [] };
    }
    const record = entry as Record<string, unknown>;
    const threshold = record.threshold;
    return {
      threshold: typeof threshold === 'number' || typeof threshold === 'string' ? threshold : 0,
      text: typeof record.text === 'string' ? record.text : '',
      loreEntryIds: normalizeStringIds(record.loreEntryIds),
      npcFactIds: normalizeStringIds(record.npcFactIds),
    };
  });
}

interface KnowledgeGrantOption {
  id: string;
  label: string;
}

function KnowledgeGrantChecklist({
  label,
  options,
  selectedIds,
  onChange,
}: {
  label: string;
  options: KnowledgeGrantOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div className="grid gap-1 rounded-md border border-border/60 bg-background/40 p-2">
      <span className="text-[0.7rem] font-mono uppercase text-muted-foreground">
        Grant {label} on this outcome
      </span>
      <div className="grid max-h-32 gap-1 overflow-y-auto">
        {options.map((option) => {
          const checked = selectedIds.includes(option.id);
          return (
            <label key={option.id} className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={checked}
                onCheckedChange={(next) =>
                  onChange(
                    next === true
                      ? [...selectedIds, option.id]
                      : selectedIds.filter((id) => id !== option.id),
                  )
                }
              />
              <span className="leading-tight">{option.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function OutcomeListFieldAdapter({ name, warRoom }: FieldAdapterProps) {
  const { control } = useFormContext<EventFormValues>();
  const loreOptions: KnowledgeGrantOption[] = (warRoom.lore ?? []).map((entry) => ({
    id: entry.id,
    label: entry.title,
  }));
  const npcFactOptions: KnowledgeGrantOption[] = (warRoom.npcs ?? []).flatMap((npc) =>
    npc.facts.map((fact) => ({ id: fact.id, label: `${npc.name}: ${fact.content}` })),
  );
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: formField }) => {
        const outcomes = normalizeOutcomes(formField.value);
        const update = (outcomeIndex: number, patch: Partial<OutcomeEntry>) => {
          formField.onChange(
            outcomes.map((outcome, index) =>
              index === outcomeIndex ? { ...outcome, ...patch } : outcome,
            ),
          );
        };
        return (
          <div className="grid gap-3">
            <div className="outcome-list">
              {outcomes.map((outcome, outcomeIndex) => (
                <div key={outcomeIndex} className="grid gap-2">
                  <div className="outcome-row">
                    <Input
                      type="number"
                      placeholder="Threshold"
                      className="outcome-score"
                      value={outcome.threshold}
                      onChange={(event) =>
                        update(outcomeIndex, { threshold: event.currentTarget.value })
                      }
                    />
                    <Input
                      type="text"
                      placeholder="Outcome text…"
                      className="outcome-text"
                      value={outcome.text}
                      onChange={(event) =>
                        update(outcomeIndex, { text: event.currentTarget.value })
                      }
                    />
                    <button
                      className="outcome-remove"
                      onClick={() =>
                        formField.onChange(outcomes.filter((_, index) => index !== outcomeIndex))
                      }
                      type="button"
                      aria-label="Remove outcome"
                    >
                      ×
                    </button>
                  </div>
                  <KnowledgeGrantChecklist
                    label="Lore"
                    options={loreOptions}
                    selectedIds={outcome.loreEntryIds}
                    onChange={(loreEntryIds) => update(outcomeIndex, { loreEntryIds })}
                  />
                  <KnowledgeGrantChecklist
                    label="NPC facts"
                    options={npcFactOptions}
                    selectedIds={outcome.npcFactIds}
                    onChange={(npcFactIds) => update(outcomeIndex, { npcFactIds })}
                  />
                </div>
              ))}
            </div>
            <button
              className="outcome-add"
              onClick={() =>
                formField.onChange([
                  ...outcomes,
                  { threshold: 0, text: '', loreEntryIds: [], npcFactIds: [] },
                ])
              }
              type="button"
            >
              + Add Outcome
            </button>
          </div>
        );
      }}
    />
  );
}

export const pipelineEditorFieldAdapters = {
  text: TextFieldAdapter,
  textarea: TextareaFieldAdapter,
  number: NumberFieldAdapter,
  boolean: BooleanFieldAdapter,
  json: JsonFieldAdapter,
  select: SelectFieldAdapter,
  'system-stat-select': SystemStatFieldAdapter,
  recipients: RecipientsFieldAdapter,
  image: ImageFieldAdapter,
  'outcome-list': OutcomeListFieldAdapter,
} satisfies Record<EditorFieldKind, FieldAdapter>;

const gridClasses = {
  1: 'grid gap-3',
  2: 'grid grid-cols-1 gap-3 md:grid-cols-2',
  3: 'grid grid-cols-1 gap-3 md:grid-cols-3',
} as const;

const spanClasses = {
  1: '',
  2: 'md:col-span-2',
  3: 'md:col-span-3',
} as const;

export function BlockConfigFields({ index, blockType }: Props) {
  const warRoom = useOutletContext<WarRoomContext>();
  const {
    formState: { errors },
  } = useFormContext<EventFormValues>();
  const spec = requirePipelineBlockSpec(blockType);
  const blockErrors = (errors.pipeline?.[index]?.config ?? {}) as Record<
    string,
    { message?: string }
  >;
  const columns = spec.editor.columns ?? 1;
  return (
    <div className={gridClasses[columns]}>
      {spec.editor.fields.map((field) => {
        const Adapter = pipelineEditorFieldAdapters[field.kind];
        const name = configPath(index, field.path);
        return (
          <div key={field.path} className={spanClasses[field.columnSpan ?? 1]}>
            <ConfigField field={field} error={blockErrors[field.path]?.message}>
              <Adapter field={field} index={index} name={name} warRoom={warRoom} />
            </ConfigField>
          </div>
        );
      })}
    </div>
  );
}
