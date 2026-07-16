import type { ReactNode } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { Trash2 } from 'lucide-react';
import {
  BLOCK_TYPES,
  BLOCK_LABELS,
  type BlockType,
  createPipelineBlock,
  type EventFormValues,
  getSuggestedBlockTypesForEventType,
  type EventType,
} from '@/lib/event-schema';
import { BlockConfigFields } from './block-config-fields.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select.js';

export function PipelineBuilder({
  eventType,
  footer,
}: {
  eventType?: EventType;
  footer?: ReactNode;
}) {
  const {
    control,
    register,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<EventFormValues>();

  const { fields, append, remove } = useFieldArray({ control, name: 'pipeline' });

  const pipelineValues = watch('pipeline');
  const addableBlockTypes = eventType ? getSuggestedBlockTypesForEventType(eventType) : BLOCK_TYPES;

  const handleBlockTypeChange = (index: number, newType: BlockType) => {
    setValue(`pipeline.${index}.blockType`, newType);
    setValue(`pipeline.${index}.config`, createPipelineBlock(newType).config);
  };

  const addBlock = (blockType: string) => {
    if (!BLOCK_TYPES.includes(blockType as BlockType)) {
      return;
    }

    append(createPipelineBlock(blockType as BlockType));
  };

  return (
    <div className="pipeline-builder">
      <div className="form-section-header">
        <span className="form-label">Event Actions</span>
        {errors.pipeline?.root && (
          <span className="form-error">{errors.pipeline.root.message}</span>
        )}
        {typeof errors.pipeline?.message === 'string' && (
          <span className="form-error">{errors.pipeline.message}</span>
        )}
      </div>

      {fields.length === 0 && (
        <div className="pipeline-empty">
          No actions yet. Add one to define what happens when this event fires.
        </div>
      )}

      <div className="pipeline-list">
        {fields.map((field, index) => {
          const currentType = pipelineValues?.[index]?.blockType as BlockType | undefined;

          return (
            <div key={field.id} className="pipeline-block">
              <div className="pipeline-block-header">
                {/* Shadcn Select replaces native <select> */}
                <Select
                  value={currentType ?? ''}
                  onValueChange={(v) => handleBlockTypeChange(index, v as BlockType)}
                >
                  <SelectTrigger className="pipeline-block-type flex-1 h-[2rem] text-[0.78rem] rounded-none border-0 bg-transparent shadow-none focus:ring-0 px-3 py-1.5">
                    <SelectValue placeholder="Select action..." />
                  </SelectTrigger>
                  <SelectContent>
                    {addableBlockTypes.map((type) => (
                      <SelectItem key={type} value={type} className="text-xs font-mono">
                        {BLOCK_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* hidden register so RHF tracks the value */}
                <input type="hidden" {...register(`pipeline.${index}.blockType`)} />

                <button
                  className="pipeline-block-remove"
                  onClick={() => remove(index)}
                  type="button"
                  aria-label={`Remove action ${index + 1}`}
                >
                  <Trash2 size={14} aria-hidden="true" />
                  <span>Remove action</span>
                </button>
              </div>

              {currentType && (
                <div className="pipeline-block-body">
                  <BlockConfigFields index={index} blockType={currentType} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="pipeline-action-dock">
        <Select onValueChange={addBlock} value="">
          <SelectTrigger className="pipeline-add-trigger">
            <SelectValue placeholder="Add action" />
          </SelectTrigger>
          <SelectContent>
            {addableBlockTypes.map((type) => (
              <SelectItem key={type} value={type} className="text-xs font-mono">
                {BLOCK_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {footer}
      </div>
    </div>
  );
}
