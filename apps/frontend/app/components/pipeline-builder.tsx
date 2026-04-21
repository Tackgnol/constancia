import { useFieldArray, useFormContext } from 'react-hook-form';
import {
  BLOCK_LABELS,
  BLOCK_TYPES,
  type BlockType,
  defaultBlockConfigs,
  type EventFormValues,
} from '@/lib/event-schema';
import { BlockConfigFields } from './block-config-fields.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select.js';

export function PipelineBuilder() {
  const {
    control,
    register,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<EventFormValues>();

  const { fields, append, remove } = useFieldArray({ control, name: 'pipeline' });

  const pipelineValues = watch('pipeline');

  const handleBlockTypeChange = (index: number, newType: BlockType) => {
    setValue(`pipeline.${index}.blockType`, newType);
    setValue(`pipeline.${index}.config`, defaultBlockConfigs[newType]);
  };

  return (
    <div className="pipeline-builder">
      <div className="form-section-header">
        <span className="form-label">Pipeline</span>
        {errors.pipeline?.root && (
          <span className="form-error">{errors.pipeline.root.message}</span>
        )}
        {typeof errors.pipeline?.message === 'string' && (
          <span className="form-error">{errors.pipeline.message}</span>
        )}
      </div>

      {fields.length === 0 && (
        <div className="pipeline-empty">
          No blocks yet — add one to define what happens when this event fires.
        </div>
      )}

      <div className="pipeline-list">
        {fields.map((field, index) => {
          const currentType = pipelineValues?.[index]?.blockType as BlockType | undefined;

          return (
            <div key={field.id} className="pipeline-block">
              <div className="pipeline-block-header">
                <span className="pipeline-block-index">{String(index + 1).padStart(2, '0')}</span>

                {/* Shadcn Select replaces native <select> */}
                <Select
                  value={currentType ?? ''}
                  onValueChange={(v) => handleBlockTypeChange(index, v as BlockType)}
                >
                  <SelectTrigger className="pipeline-block-type flex-1 h-[2rem] text-[0.78rem] rounded-none border-0 bg-transparent shadow-none focus:ring-0 px-3 py-1.5">
                    <SelectValue placeholder="Select block type…" />
                  </SelectTrigger>
                  <SelectContent>
                    {BLOCK_TYPES.map((type) => (
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
                  aria-label={`Remove block ${index + 1}`}
                >
                  ×
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

      <button
        className="ghost-action pipeline-add"
        onClick={() =>
          append({ blockType: 'message-channel', config: defaultBlockConfigs['message-channel'] })
        }
        type="button"
      >
        + Add Block
      </button>
    </div>
  );
}
