import type { BlockDefinition } from '@constancia/contracts';

export class BlockRegistry {
  private blocks = new Map<string, BlockDefinition<unknown>>();

  register<TConfig>(block: BlockDefinition<TConfig>): void {
    if (this.blocks.has(block.type)) {
      throw new Error(`Block type "${block.type}" is already registered`);
    }
    this.blocks.set(block.type, block as BlockDefinition<unknown>);
  }

  get(type: string): BlockDefinition<unknown> | undefined {
    return this.blocks.get(type);
  }

  listTypes(): string[] {
    return [...this.blocks.keys()];
  }
}
