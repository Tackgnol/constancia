import { describe, expect, it } from 'vitest';
import { resolveSheetRenderer } from '@/components/character-sheet/renderers';
import { demo5eContext, demo5eNpcs, demo5ePlayerSheet, isDemo5eRequest } from '../demo-5e-data';
import { createEventFormSchema, type EventFormValues } from '../event-schema';

describe('5E demo campaign', () => {
  it('ships test Events that pass 5E Event Setup validation', () => {
    const schema = createEventFormSchema('5e-srd');
    for (const event of demo5eContext.events) {
      const result = schema.safeParse({
        name: event.name,
        type: event.type,
        channelId: event.channelId,
        shortCircuit: event.shortCircuit,
        pipeline: event.pipeline,
      } as EventFormValues);
      expect(
        result.success,
        `${event.name}: ${JSON.stringify(!result.success && result.error.issues)}`,
      ).toBe(true);
    }
  });

  it('uses check, save, insight and roll-modifier blocks', () => {
    const blockTypes = demo5eContext.events.flatMap((event) =>
      event.pipeline.map((block) => block.blockType),
    );
    expect(blockTypes).toEqual(
      expect.arrayContaining(['roll-modifier', 'test-resolver', 'insight-resolver']),
    );
  });

  it('renders the demo player sheet with the 5E sheet-level renderer', () => {
    expect(resolveSheetRenderer(demo5ePlayerSheet.system.id)).not.toBeNull();
  });

  it('is chosen with ?system=5e-srd and keeps the copy SRD-only', () => {
    expect(isDemo5eRequest(new Request('http://x/demo?system=5e-srd'))).toBe(true);
    expect(isDemo5eRequest(new Request('http://x/demo'))).toBe(false);
    expect(JSON.stringify([demo5eContext, demo5eNpcs, demo5ePlayerSheet])).not.toMatch(
      /D&D|Dungeons/,
    );
  });
});
