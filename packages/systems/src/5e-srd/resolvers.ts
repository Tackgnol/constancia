import type { BlockContext, BlockDefinition, BlockMessage } from '@constancia/contracts';
import {
  requirePipelineBlockSpec,
  type RoleBlockImplementationSpec,
} from '@constancia/block-catalogue';
import { rollDice } from '../dice.js';
import { FIVE_E_ABILITIES, FIVE_E_SKILLS, type FiveEAbility, type FiveESkill } from './data.js';
import { deriveFiveEStats, readProficiencyTier } from './derived.js';

export interface FiveETestConfig {
  mode: 'check' | 'save';
  ability: FiveEAbility;
  skill?: FiveESkill;
}

export interface FiveEInsightConfig {
  ability: FiveEAbility;
  skill?: FiveESkill;
}

const abilityOptions = FIVE_E_ABILITIES.map((ability) => ({
  value: ability.value,
  label: ability.label,
}));
const skillOptions = FIVE_E_SKILLS.map((skill) => ({ value: skill.value, label: skill.label }));
const abilityValues = FIVE_E_ABILITIES.map((ability) => ability.value);
const skillValues = FIVE_E_SKILLS.map((skill) => skill.value);

export const fiveETestResolverSpec: RoleBlockImplementationSpec = {
  configSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      mode: { type: 'string', enum: ['check', 'save'] },
      ability: { type: 'string', enum: abilityValues },
      skill: { type: 'string', enum: skillValues },
    },
    required: ['mode', 'ability'],
    if: { properties: { mode: { const: 'save' } } },
    then: { not: { required: ['skill'] } },
  },
  defaultConfig: { mode: 'check', ability: 'dex' },
  editor: {
    columns: 3,
    fields: [
      {
        kind: 'select',
        path: 'mode',
        label: 'Mode',
        options: [
          { value: 'check', label: 'Ability check' },
          { value: 'save', label: 'Saving throw' },
        ],
      },
      { kind: 'select', path: 'ability', label: 'Ability', options: abilityOptions },
      {
        kind: 'select',
        path: 'skill',
        label: 'Skill',
        optional: true,
        options: skillOptions,
        visibleWhen: { path: 'mode', equals: ['check'] },
        hint: 'Any skill can pair with any ability.',
      },
    ],
  },
};

export const fiveEInsightResolverSpec: RoleBlockImplementationSpec = {
  configSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      ability: { type: 'string', enum: abilityValues },
      skill: { type: 'string', enum: skillValues },
    },
    required: ['ability'],
  },
  defaultConfig: { ability: 'wis', skill: 'perception' },
  editor: {
    columns: 2,
    fields: [
      { kind: 'select', path: 'ability', label: 'Ability', options: abilityOptions },
      { kind: 'select', path: 'skill', label: 'Skill', optional: true, options: skillOptions },
    ],
  },
};

interface ModifierParts {
  abilityModifier: number;
  proficiency: number;
}

function modifierParts(
  config: { mode?: 'check' | 'save'; ability: FiveEAbility; skill?: FiveESkill },
  characterData: Record<string, unknown>,
): ModifierParts {
  const derived = deriveFiveEStats(characterData);
  const abilityModifier = derived.abilityModifiers[config.ability];
  if (config.mode === 'save') {
    return { abilityModifier, proficiency: derived.saves[config.ability] - abilityModifier };
  }
  const tier = config.skill ? readProficiencyTier(characterData, config.skill) : 0;
  return { abilityModifier, proficiency: derived.proficiencyBonus * tier };
}

function signed(value: number): string {
  return value < 0 ? `${value}` : `+${value}`;
}

function abilityShort(ability: FiveEAbility): string {
  return FIVE_E_ABILITIES.find((option) => option.value === ability)?.short ?? ability;
}

function abilityLabel(ability: FiveEAbility): string {
  return FIVE_E_ABILITIES.find((option) => option.value === ability)?.label ?? ability;
}

function skillLabel(skill: FiveESkill): string {
  return FIVE_E_SKILLS.find((option) => option.value === skill)?.label ?? skill;
}

function contextPlayerTargetId(ctx: BlockContext): string | undefined {
  const targetId = ctx.playerId.trim();
  return targetId.length > 0 && targetId !== 'system' ? targetId : undefined;
}

/** Formats the private dice reply, e.g. "🎲 d20 [12, 7] advantage +3 DEX +2 prof = 15". */
export function formatFiveERoll(
  dice: number[],
  mode: 'advantage' | 'disadvantage' | undefined,
  ability: FiveEAbility,
  parts: ModifierParts,
  total: number,
): string {
  const terms = [
    `🎲 d20 [${dice.join(', ')}]`,
    ...(mode ? [mode] : []),
    `${signed(parts.abilityModifier)} ${abilityShort(ability)}`,
    ...(parts.proficiency !== 0 ? [`${signed(parts.proficiency)} prof`] : []),
  ];
  return `${terms.join(' ')} = ${total}`;
}

export const fiveETestResolverBlock: BlockDefinition<FiveETestConfig> = {
  type: 'test-resolver',
  label: requirePipelineBlockSpec('test-resolver').label,
  configSchema: fiveETestResolverSpec.configSchema,
  execute: async (config: FiveETestConfig, ctx: BlockContext) => {
    const mode = ctx.rollModifiers?.mode;
    const dice = await rollDice(mode ? 2 : 1, 20);
    const kept =
      mode === 'advantage'
        ? Math.max(...dice)
        : mode === 'disadvantage'
          ? Math.min(...dice)
          : (dice[0] ?? 0);
    const parts = modifierParts(config, ctx.characterData);
    const total = kept + parts.abilityModifier + parts.proficiency;
    const targetId = contextPlayerTargetId(ctx);
    const messages: BlockMessage[] = [
      {
        target: 'player',
        ...(targetId ? { targetId } : {}),
        content: formatFiveERoll(dice, mode, config.ability, parts, total),
      },
    ];

    return { output: { dice, kept, total, ...parts }, playerScore: total, messages };
  },
};

/** Passive score: 10 plus the ability modifier, plus proficiency (doubled with expertise) when a skill applies. */
export function fiveEPassiveScore(
  config: FiveEInsightConfig,
  characterData: Record<string, unknown>,
): number {
  const parts = modifierParts(config, characterData);
  return 10 + parts.abilityModifier + parts.proficiency;
}

export const fiveEInsightResolverBlock: BlockDefinition<FiveEInsightConfig> = {
  type: 'insight-resolver',
  label: requirePipelineBlockSpec('insight-resolver').label,
  configSchema: fiveEInsightResolverSpec.configSchema,
  execute: async (config: FiveEInsightConfig, ctx: BlockContext) => {
    const score = fiveEPassiveScore(config, ctx.characterData);
    return { output: { score }, playerScore: score };
  },
};

export interface FiveERollModifierConfig {
  mode: 'advantage' | 'disadvantage';
}

export const fiveERollModifierSpec: RoleBlockImplementationSpec = {
  configSchema: {
    type: 'object',
    additionalProperties: false,
    properties: { mode: { type: 'string', enum: ['advantage', 'disadvantage'] } },
    required: ['mode'],
  },
  defaultConfig: { mode: 'advantage' },
  editor: {
    fields: [
      {
        kind: 'select',
        path: 'mode',
        label: 'Roll with',
        options: [
          { value: 'advantage', label: 'Advantage' },
          { value: 'disadvantage', label: 'Disadvantage' },
        ],
        hint: 'Applies when the backend rolls for the player; the card tells players rolling physical dice.',
      },
    ],
  },
};

export const fiveERollModifierBlock: BlockDefinition<FiveERollModifierConfig> = {
  type: 'roll-modifier',
  label: requirePipelineBlockSpec('roll-modifier').label,
  configSchema: fiveERollModifierSpec.configSchema,
  execute: async (config: FiveERollModifierConfig) => ({
    output: config,
    contextPatch: { rollModifiers: { mode: config.mode } },
  }),
};

export function fiveERollModifierCardLine(config: Record<string, unknown>): string | null {
  return config.mode === 'advantage' || config.mode === 'disadvantage'
    ? `🎲 Roll with ${config.mode}`
    : null;
}

function isAbility(value: unknown): value is FiveEAbility {
  return typeof value === 'string' && abilityValues.some((ability) => ability === value);
}

function isSkill(value: unknown): value is FiveESkill {
  return typeof value === 'string' && skillValues.some((skill) => skill === value);
}

/** The 5E modifier hint, e.g. "Your **Dexterity (Stealth): +5**." */
export function fiveEModifierHint(
  config: Record<string, unknown>,
  characterData: Record<string, unknown>,
): string | null {
  if (!isAbility(config.ability)) return null;
  const mode = config.mode === 'save' ? 'save' : 'check';
  const skill = mode === 'check' && isSkill(config.skill) ? config.skill : undefined;
  const parts = modifierParts({ mode, ability: config.ability, skill }, characterData);
  const total = signed(parts.abilityModifier + parts.proficiency);
  const name =
    mode === 'save'
      ? `${abilityLabel(config.ability)} save`
      : skill
        ? `${abilityLabel(config.ability)} (${skillLabel(skill)})`
        : abilityLabel(config.ability);
  return `Your **${name}: ${total}**.`;
}
