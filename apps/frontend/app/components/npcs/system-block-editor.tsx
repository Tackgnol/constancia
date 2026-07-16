import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  createEditorBlock,
  getNpcBlockDefinition,
  getNpcBlockDefinitions,
  type NpcEditorBlock,
} from './block-registry';

function availableBlockTypes(systemId: string, blocks: NpcEditorBlock[]) {
  const used = new Set(blocks.map((block) => block.blockType));

  return getNpcBlockDefinitions(systemId).filter(
    (definition) => definition.repeatable || !used.has(definition.blockType),
  );
}

export function SystemBlockEditor({
  systemId,
  blocks,
  onChange,
}: {
  systemId: string;
  blocks: NpcEditorBlock[];
  onChange: (blocks: NpcEditorBlock[]) => void;
}) {
  const addableDefinitions = useMemo(
    () => availableBlockTypes(systemId, blocks),
    [blocks, systemId],
  );

  const updateBlock = (key: string, valueText: string) => {
    onChange(blocks.map((block) => (block.key === key ? { ...block, valueText } : block)));
  };

  const removeBlock = (key: string) => {
    onChange(blocks.filter((block) => block.key !== key));
  };

  const addBlock = (blockType: string) => {
    const next = createEditorBlock(systemId, blockType);
    if (!next) {
      return;
    }

    onChange([...blocks, next]);
  };

  return (
    <div className="npc-block-editor">
      <div className="setup-subsection-header">
        <div>
          <p className="detail-label">System blocks</p>
          <p className="form-hint">
            Compose the dossier from system-native blocks. Each block will render through its own
            frontend component on the board.
          </p>
        </div>
        <Select onValueChange={addBlock} value="">
          <SelectTrigger className="npc-block-add-trigger">
            <SelectValue placeholder="Add block…" />
          </SelectTrigger>
          <SelectContent>
            {addableDefinitions.map((definition) => (
              <SelectItem key={definition.blockType} value={definition.blockType}>
                {definition.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {blocks.length === 0 ? (
        <div className="npc-block-empty">
          <p className="detail-label">No blocks staged</p>
          <p className="form-hint">
            Start with a clan or title block, then add any richer system data.
          </p>
        </div>
      ) : (
        <div className="npc-block-stack">
          {blocks.map((block) => {
            const definition = getNpcBlockDefinition(systemId, block.blockType);

            if (!definition) {
              return null;
            }

            const field = (() => {
              if (definition.editor === 'select') {
                return (
                  <Select
                    value={block.valueText}
                    onValueChange={(value) => updateBlock(block.key, value)}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={definition.placeholder ?? `Select ${definition.label}`}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {definition.options?.map((option: { value: string; label: string }) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                );
              }

              if (definition.editor === 'textarea' || definition.editor === 'json') {
                return (
                  <Textarea
                    value={block.valueText}
                    rows={definition.editor === 'json' ? 7 : 4}
                    placeholder={definition.placeholder}
                    onChange={(event) => updateBlock(block.key, event.currentTarget.value)}
                  />
                );
              }

              return (
                <Input
                  type={definition.editor === 'number' ? 'number' : 'text'}
                  value={block.valueText}
                  placeholder={definition.placeholder}
                  onChange={(event) => updateBlock(block.key, event.currentTarget.value)}
                />
              );
            })();

            return (
              <article key={block.key} className="npc-block-row detail-card">
                <div className="npc-block-row-header">
                  <div>
                    <Label className="text-muted-foreground text-[0.7rem] tracking-[0.16em] uppercase font-mono font-semibold">
                      {definition.label}
                    </Label>
                    <p className="form-hint">{definition.description}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="ghost-action-inline"
                    onClick={() => removeBlock(block.key)}
                  >
                    Remove
                  </Button>
                </div>
                {field}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
