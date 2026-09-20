import {
  ApplicationCommandOptionType,
  MessageFlags,
  type ChatInputCommandInteraction,
  type InteractionReplyOptions,
} from 'discord.js';
import type { BotChatCommand } from '../discord/command-types.js';

const PLAYER_OPTION = 'player';
const GM_OPTION = 'gm';

const PLAYER_HELP = [
  '**🎲 Player commands**',
  '`/sheet` – Get a private magic link to your character sheet. Use it to view or edit your character.',
  '`/journal` – Browse your quest journal, session summaries and the NPC facts you know. Use it between sessions to catch up.',
  '`/npc name:<name>` – Look up the dossier of an NPC your character knows. Use it when a name comes up and you need a reminder.',
  '`/date` – Show the current in-game date. Use it to keep track of time in the story.',
  '`/roll` – Check what the GM has active in this channel. Tests are answered with the buttons on the test card, not with this command.',
].join('\n');

const GM_HELP = [
  '**🎭 GM commands**',
  '`/setup [game-system]` – Link this server and channel to a Constancia campaign and pick its game system. Run it once before anything else.',
  '`/login` – Get a private magic link to the web dashboard (the War Room), where you build events, manage NPCs, the journal and the game date, and run the Play View.',
  '`/participants add|remove|list` – Add or remove players in the campaign, or list who is in it. Players need to be participants to get a sheet and journal.',
].join('\n');

/** Builds the help text for the requested audience; neither or both flags set shows everything. */
export function buildHelpText(player: boolean, gm: boolean): string {
  const showAll = player === gm;
  const sections = [
    ...(showAll || player ? [PLAYER_HELP] : []),
    ...(showAll || gm ? [GM_HELP] : []),
  ];
  return `**Constancia help** – use \`/help player:true\` or \`/help gm:true\` to filter.\n\n${sections.join('\n\n')}`;
}

export async function handleHelp(interaction: ChatInputCommandInteraction): Promise<void> {
  const player = interaction.options.getBoolean(PLAYER_OPTION) ?? false;
  const gm = interaction.options.getBoolean(GM_OPTION) ?? false;

  await interaction.reply({
    content: buildHelpText(player, gm),
    flags: MessageFlags.Ephemeral,
  } as InteractionReplyOptions);
}

export const helpCommand: BotChatCommand = {
  data: {
    name: 'help',
    description: 'Show what each Constancia command does and when to use it (private to you)',
    options: [
      {
        name: PLAYER_OPTION,
        type: ApplicationCommandOptionType.Boolean,
        description: 'Set to true to show only player commands',
        required: false,
      },
      {
        name: GM_OPTION,
        type: ApplicationCommandOptionType.Boolean,
        description: 'Set to true to show only GM commands',
        required: false,
      },
    ],
  },
  execute: handleHelp,
};
