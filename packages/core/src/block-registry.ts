import type { BlockDefinition } from '@constancia/contracts';

export class BlockRegistry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private blocks = new Map<string, BlockDefinition<any>>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register<TConfig = any>(block: BlockDefinition<TConfig>): void {
    if (this.blocks.has(block.type)) {
      throw new Error(`Block type "${block.type}" is already registered`);
    }
    this.blocks.set(block.type, block);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(type: string): BlockDefinition<any> | undefined {
    return this.blocks.get(type);
  }

  listTypes(): string[] {
    return [...this.blocks.keys()];
  }
}
