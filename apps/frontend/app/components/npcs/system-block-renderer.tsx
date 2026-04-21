import type { CampaignNpcSystemBlock } from './block-registry';
import { formatSystemBlockValue } from './block-registry';
import { getNpcBlockDefinition } from './block-registry';

function renderStructuredValue(value: CampaignNpcSystemBlock['value']) {
  if (value === null) {
    return <span className="form-hint">Unset</span>;
  }

  if (Array.isArray(value)) {
    return <pre className="npc-block-json">{JSON.stringify(value, null, 2)}</pre>;
  }

  if (typeof value === 'object') {
    return <pre className="npc-block-json">{JSON.stringify(value, null, 2)}</pre>;
  }

  return <span>{String(value)}</span>;
}

export function SystemBlockRenderer({
  systemId,
  block,
}: {
  systemId: string;
  block: CampaignNpcSystemBlock;
}) {
  const definition = getNpcBlockDefinition(systemId, block.blockType);
  const variant = definition?.renderVariant ?? 'chip';

  if (variant === 'panel') {
    return (
      <div className="npc-block-panel">
        <p className="detail-label">{block.label}</p>
        <div className="npc-block-panel-copy">{renderStructuredValue(block.value)}</div>
      </div>
    );
  }

  if (variant === 'stats') {
    return (
      <div className="npc-block-panel npc-block-panel-stats">
        <p className="detail-label">{block.label}</p>
        <div className="npc-block-panel-copy">{renderStructuredValue(block.value)}</div>
      </div>
    );
  }

  return (
    <span className="npc-chip">
      {block.label}: {formatSystemBlockValue(block.value)}
    </span>
  );
}

