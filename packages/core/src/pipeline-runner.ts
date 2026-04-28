import { Ajv, type ErrorObject, type ValidateFunction } from 'ajv';
import type {
  BlockContext,
  BlockDefinition,
  BlockInstance,
  BlockMessage,
} from '@constancia/contracts';
import type { BlockRegistry } from './block-registry.js';

export interface PipelineResult {
  messages: BlockMessage[];
  outputs: unknown[];
  halted: boolean;
}

function formatValidationErrors(errors: ErrorObject[] | null | undefined): string {
  if (!errors || errors.length === 0) {
    return 'unknown validation error';
  }

  return errors
    .map((error) => {
      const instancePath =
        'instancePath' in error && typeof error.instancePath === 'string' ? error.instancePath : '';
      const dataPath =
        'dataPath' in error && typeof error.dataPath === 'string' ? error.dataPath : '';
      const location = instancePath || dataPath || '/';
      const message = typeof error.message === 'string' ? error.message : 'invalid value';
      return `${location} ${message}`;
    })
    .join('; ');
}

function contextPlayerTargetId(ctx: BlockContext): string | undefined {
  const targetId = ctx.playerId.trim();
  return targetId.length > 0 && targetId !== 'system' ? targetId : undefined;
}

function normalizeMessages(messages: BlockMessage[], ctx: BlockContext): BlockMessage[] {
  const targetId = contextPlayerTargetId(ctx);

  if (!targetId) {
    return messages;
  }

  return messages.map((message) => {
    if (message.target === 'player' && !message.targetId?.trim()) {
      return { ...message, targetId };
    }

    return message;
  });
}

export class BlockConfigValidationError extends Error {
  constructor(
    readonly blockType: string,
    readonly blockIndex: number,
    readonly details: string,
  ) {
    super(`Invalid config for block "${blockType}" at pipeline index ${blockIndex}: ${details}`);
    this.name = 'BlockConfigValidationError';
  }
}

export class PipelineRunner {
  private ajv = new Ajv({ allErrors: true });
  private validatorCache = new Map<string, ValidateFunction>();

  constructor(private registry: BlockRegistry) {}

  private getValidator(block: BlockDefinition<unknown>): ValidateFunction {
    const cachedValidator = this.validatorCache.get(block.type);
    if (cachedValidator) {
      return cachedValidator;
    }

    const validator = this.ajv.compile(block.configSchema);
    this.validatorCache.set(block.type, validator);
    return validator;
  }

  private validateBlockConfig(
    block: BlockDefinition<unknown>,
    config: unknown,
    blockIndex: number,
  ): void {
    const validator = this.getValidator(block);
    const valid = validator(config);

    if (!valid) {
      throw new BlockConfigValidationError(
        block.type,
        blockIndex,
        formatValidationErrors(validator.errors),
      );
    }
  }

  async run(blocks: BlockInstance[], ctx: BlockContext): Promise<PipelineResult> {
    const messages: BlockMessage[] = [];
    const outputs: unknown[] = [];

    for (const [index, instance] of blocks.entries()) {
      const block = this.registry.get(instance.blockType);
      if (!block) {
        throw new Error(`Unknown block type: "${instance.blockType}"`);
      }

      this.validateBlockConfig(block, instance.config, index);

      const result = await block.execute(instance.config, ctx);
      outputs.push(result.output);

      if (result.messages) {
        messages.push(...normalizeMessages(result.messages, ctx));
      }

      if (result.halt) {
        return { messages, outputs, halted: true };
      }
    }

    return { messages, outputs, halted: false };
  }
}
