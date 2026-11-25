// PROTOTYPE (wayfinder "D&D test submission modal", issue #28). Throwaway: lives only on the
// prototype/dnd-test-modal branch. Three structurally different submission flows, switchable with
// `/prototype-test-modal variant:`. Nothing here calls the backend; every submit echoes its state.
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  CheckboxBuilder,
  ComponentType,
  EmbedBuilder,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  RadioGroupBuilder,
  RadioGroupOptionBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ModalSubmitInteraction,
} from 'discord.js';
import type {
  BotChatCommand,
  BotComponentHandler,
  BotModalHandler,
} from '../discord/command-types.js';

type Variant = 'A' | 'B' | 'C';
type System = '5e' | 'vtm';
type Hint = 'yes' | 'slow';
type Mod = 'none' | 'adv' | 'dis';

interface ProtoState {
  variant: Variant;
  system: System;
  hint: Hint;
  mod: Mod;
}

const PREFIX = 'proto-modal:';
const SCORE_ID = 'score';
const ROLL_ID = 'roll-for-me';
const HOW_ID = 'how';
const TITLE = 'Sneak past the guards';

const VARIANT_NAMES: Record<Variant, string> = {
  A: 'Inline toggle',
  B: 'Choose first',
  C: 'Two doors',
};

function encode(state: ProtoState, kind: string): string {
  return `${PREFIX}${kind}:${state.variant}:${state.system}:${state.hint}:${state.mod}`;
}

function decode(customId: string): { kind: string; state: ProtoState } {
  const [kind, variant, system, hint, mod] = customId.slice(PREFIX.length).split(':');
  return {
    kind: kind ?? '',
    state: {
      variant: (variant ?? 'A') as Variant,
      system: (system ?? '5e') as System,
      hint: (hint ?? 'yes') as Hint,
      mod: (mod ?? 'none') as Mod,
    },
  };
}

/** The Game System's modifier hint, or the fallback when the bot's cache missed. */
function hintText(state: ProtoState): string {
  if (state.hint === 'slow') {
    return 'Consult your character sheet; enter your final result.';
  }
  return state.system === '5e'
    ? 'Your **Dexterity (Stealth): +5**. Consult your character sheet; enter your final result.'
    : 'Your pool: **6 dice** (Dexterity 3 + Stealth 3). Enter your successes.';
}

/** Plain-text hint for places that do not render markdown (Label descriptions). */
function plainHint(state: ProtoState): string {
  return hintText(state).replaceAll('**', '');
}

function modLine(state: ProtoState): string | null {
  if (state.mod === 'adv') return 'Roll with advantage';
  if (state.mod === 'dis') return 'Roll with disadvantage';
  return null;
}

function scoreInput(required: boolean): TextInputBuilder {
  return new TextInputBuilder()
    .setCustomId(SCORE_ID)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. 17')
    .setMaxLength(4)
    .setRequired(required);
}

function buildModalA(state: ProtoState): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(encode(state, 'submit'))
    .setTitle(TITLE)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(hintText(state)));
  const line = modLine(state);
  if (line) {
    modal.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${line}`));
  }
  return modal.addLabelComponents(
    new LabelBuilder().setLabel('Final result').setTextInputComponent(scoreInput(false)),
    new LabelBuilder()
      .setLabel('Roll for me')
      .setDescription('Ignored if you typed a result above.')
      .setCheckboxComponent(new CheckboxBuilder().setCustomId(ROLL_ID)),
  );
}

function buildModalB(state: ProtoState): ModalBuilder {
  const line = modLine(state);
  return new ModalBuilder()
    .setCustomId(encode(state, 'submit'))
    .setTitle(TITLE)
    .addLabelComponents(
      new LabelBuilder().setLabel('How are you resolving this?').setRadioGroupComponent(
        new RadioGroupBuilder()
          .setCustomId(HOW_ID)
          .setRequired(true)
          .addOptions(
            new RadioGroupOptionBuilder()
              .setLabel('I rolled at the table')
              .setValue('typed')
              .setDefault(true),
            new RadioGroupOptionBuilder()
              .setLabel(line ? `Roll for me (${line.toLowerCase()})` : 'Roll for me')
              .setValue('roll'),
          ),
      ),
      new LabelBuilder()
        .setLabel('Final result')
        .setDescription(plainHint(state).slice(0, 100))
        .setTextInputComponent(scoreInput(false)),
    );
}

function buildModalC(state: ProtoState): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(encode(state, 'submit'))
    .setTitle(TITLE)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(hintText(state)))
    .addLabelComponents(
      new LabelBuilder().setLabel('Final result').setTextInputComponent(scoreInput(true)),
    );
}

function buildCardC(state: ProtoState) {
  const embed = new EmbedBuilder()
    .setTitle(TITLE)
    .setColor(0x58a6ff)
    .setDescription('The courtyard is lit by a single brazier. Two guards play dice by the gate.')
    .setFooter({ text: '0 submitted' });
  const line = modLine(state);
  if (line) embed.addFields({ name: '​', value: `🎲 ${line}` });
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(encode(state, 'enter'))
      .setLabel('Enter result')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(encode(state, 'roll'))
      .setLabel('Roll for me')
      .setEmoji('🎲')
      .setStyle(ButtonStyle.Secondary),
  );
  return { embeds: [embed], components: [row] };
}

// shortcut: Math.random stands in for @tackgnol/rpg-tools-roller; the prototype only shows the reply shape.
function d(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

/** The private reply a rolled submission would get. */
function rolledReply(state: ProtoState): string {
  if (state.system === 'vtm') {
    const dice = Array.from({ length: 6 }, () => d(10));
    const successes = dice.filter((die) => die >= 6).length;
    return `🎲 6d10 [${dice.join(', ')}] = **${successes}** successes`;
  }
  const a = d(20);
  const b = d(20);
  const kept = state.mod === 'adv' ? Math.max(a, b) : state.mod === 'dis' ? Math.min(a, b) : a;
  const dice =
    state.mod === 'none'
      ? `[${a}]`
      : `[${a}, ${b}] ${state.mod === 'adv' ? 'advantage' : 'disadvantage'}`;
  return `🎲 d20 ${dice} +3 DEX +2 prof = **${kept + 5}**`;
}

function readScore(interaction: ModalSubmitInteraction): string {
  return interaction.fields.getTextInputValue(SCORE_ID).trim();
}

function stateDump(state: ProtoState, fields: Record<string, unknown>, path: string): string {
  return [
    '```',
    `variant   ${state.variant} (${VARIANT_NAMES[state.variant]})`,
    `system    ${state.system}   hint ${state.hint}   roll-modifier ${state.mod}`,
    `fields    ${JSON.stringify(fields)}`,
    `resolved  ${path}`,
    '```',
  ].join('\n');
}

/** Typed result wins; roll-for-me only when the score is empty; otherwise the validation reply. */
function resolve(
  score: string,
  wantsRoll: boolean,
  state: ProtoState,
): { path: string; reply: string } {
  if (score.length > 0) {
    if (!/^-?\d+$/.test(score)) {
      return { path: 'invalid typed score', reply: 'Enter a whole number for your final result.' };
    }
    return {
      path: wantsRoll ? 'typed (roll-for-me ignored)' : 'typed',
      reply: `Result submitted: **${score}**.${wantsRoll ? '\n-# You typed a result, so the bot did not roll.' : ''}`,
    };
  }
  if (wantsRoll) {
    return { path: 'rolled', reply: `Result submitted.\n${rolledReply(state)}` };
  }
  return {
    path: 'validation error',
    reply:
      'Enter your final result, or tick **Roll for me**. Press **Submit Result** to try again.',
  };
}

export const prototypeTestModalCommand: BotChatCommand = {
  data: {
    name: 'prototype-test-modal',
    description: '[GM] PROTOTYPE: try test submission modal variants',
    options: [
      {
        name: 'variant',
        description: 'Which variant',
        type: ApplicationCommandOptionType.String,
        required: true,
        choices: (Object.keys(VARIANT_NAMES) as Variant[]).map((key) => ({
          name: `${key} (${VARIANT_NAMES[key]})`,
          value: key,
        })),
      },
      {
        name: 'system',
        description: 'Game System',
        type: ApplicationCommandOptionType.String,
        choices: [
          { name: '5E (SRD 5.2.1)', value: '5e' },
          { name: 'VTM V5', value: 'vtm' },
        ],
      },
      {
        name: 'hint',
        description: 'Simulate the hint cache',
        type: ApplicationCommandOptionType.String,
        choices: [
          { name: 'cached', value: 'yes' },
          { name: 'backend slow (fallback)', value: 'slow' },
        ],
      },
      {
        name: 'roll-modifier',
        description: 'roll-modifier block on the Event',
        type: ApplicationCommandOptionType.String,
        choices: [
          { name: 'none', value: 'none' },
          { name: 'advantage', value: 'adv' },
          { name: 'disadvantage', value: 'dis' },
        ],
      },
    ],
  },
  execute: async (interaction) => {
    const state: ProtoState = {
      variant: interaction.options.getString('variant', true) as Variant,
      system: (interaction.options.getString('system') ?? '5e') as System,
      hint: (interaction.options.getString('hint') ?? 'yes') as Hint,
      mod: (interaction.options.getString('roll-modifier') ?? 'none') as Mod,
    };
    if (state.variant === 'C') {
      await interaction.reply(buildCardC(state));
      return;
    }
    await interaction.showModal(state.variant === 'A' ? buildModalA(state) : buildModalB(state));
  },
};

export const prototypeTestModalComponentHandler: BotComponentHandler = {
  customIdPrefix: PREFIX,
  execute: async (interaction) => {
    const { kind, state } = decode(interaction.customId);
    if (kind === 'enter') {
      await interaction.showModal(buildModalC(state));
      return;
    }
    await interaction.reply({
      content: `Result submitted.\n${rolledReply(state)}\n${stateDump(state, {}, 'rolled (no modal)')}`,
      flags: MessageFlags.Ephemeral,
    });
  },
};

export const prototypeTestModalModalHandler: BotModalHandler = {
  customIdPrefix: PREFIX,
  execute: async (interaction) => {
    const { state } = decode(interaction.customId);
    const score = readScore(interaction);
    let wantsRoll = false;
    const fields: Record<string, unknown> = { score };
    if (state.variant === 'A') {
      wantsRoll = interaction.fields.getField(ROLL_ID, ComponentType.Checkbox).value;
      fields[ROLL_ID] = wantsRoll;
    } else if (state.variant === 'B') {
      const how = interaction.fields.getField(HOW_ID, ComponentType.RadioGroup).value;
      wantsRoll = how === 'roll';
      fields[HOW_ID] = how;
    }
    const { path, reply } = resolve(score, wantsRoll, state);
    await interaction.reply({
      content: `${reply}\n${stateDump(state, fields, path)}`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
