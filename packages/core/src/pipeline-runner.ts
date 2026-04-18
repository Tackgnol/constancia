import type { BlockContext, BlockInstance, BlockMessage } from '@constancia/contracts';
import type { BlockRegistry } from './block-registry.js';

export interface PipelineResult {
  messages: BlockMessage[];
  outputs: unknown[];
  halted: boolean;
}

export class PipelineRunner {
  constructor(private registry: BlockRegistry) {}

  async run(blocks: BlockInstance[], ctx: BlockContext): Promise<PipelineResult> {
    const messages: BlockMessage[] = [];
    const outputs: unknown[] = [];

    for (const instance of blocks) {
      const block = this.registry.get(instance.blockType);
      if (!block) {
        throw new Error(`Unknown block type: "${instance.blockType}"`);
      }

      const result = await block.execute(instance.config, ctx);
      outputs.push(result.output);

      if (result.messages) {
        messages.push(...result.messages);
      }

      if (result.halt) {
        return { messages, outputs, halted: true };
      }
    }

    return { messages, outputs, halted: false };
  }
}
