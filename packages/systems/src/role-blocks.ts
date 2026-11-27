import type { BlockDefinition } from '@constancia/contracts';
import {
  PIPELINE_BLOCK_ROLES,
  PIPELINE_BLOCK_SPECS,
  withRoleImplementation,
  type PipelineBlockRole,
  type PipelineBlockSpec,
  type RoleBlockImplementationSpec,
} from '@constancia/block-catalogue';

/** A Game System's implementation of one role block: its editor-facing spec and its runtime block. */
export interface RoleBlockImplementation {
  spec: RoleBlockImplementationSpec;
  block: BlockDefinition<never>;
  /** One line telling a player their modifier for this config, e.g. "Your pool: **6 dice**." */
  hint?: (config: Record<string, unknown>, characterData: Record<string, unknown>) => string | null;
  /** For roll-modifier: the line the test card shows for this config, e.g. "🎲 Roll with advantage". */
  cardLine?: (config: Record<string, unknown>) => string | null;
}

export type RoleBlockImplementations = Partial<Record<PipelineBlockRole, RoleBlockImplementation>>;

interface RoleBlockSystem {
  roleBlocks: RoleBlockImplementations;
}

export function listImplementedRoles(system: RoleBlockSystem): PipelineBlockRole[] {
  return PIPELINE_BLOCK_ROLES.filter((role) => system.roleBlocks[role] !== undefined);
}

/** The block spec as the given Game System sees it, or undefined when the system lacks the block's role. */
export function getPipelineBlockSpecForSystem(
  blockType: string,
  system: RoleBlockSystem,
): PipelineBlockSpec | undefined {
  const spec = PIPELINE_BLOCK_SPECS.find((candidate) => candidate.blockType === blockType);
  if (!spec || spec.availability.kind === 'common') return spec;
  const implementation = system.roleBlocks[spec.availability.role];
  return implementation ? withRoleImplementation(spec, implementation.spec) : undefined;
}

export function listPipelineBlockSpecsForSystem(system: RoleBlockSystem): PipelineBlockSpec[] {
  return PIPELINE_BLOCK_SPECS.flatMap((spec) => {
    const resolved = getPipelineBlockSpecForSystem(spec.blockType, system);
    return resolved ? [resolved] : [];
  });
}

/** The system's role blocks, registered under their role names. */
export function listRoleBlocks(system: RoleBlockSystem): BlockDefinition<never>[] {
  return listImplementedRoles(system).flatMap((role) => {
    const implementation = system.roleBlocks[role];
    return implementation ? [{ ...implementation.block, type: role }] : [];
  });
}
