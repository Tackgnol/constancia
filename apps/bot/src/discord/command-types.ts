import type {
  ApplicationCommandOptionChoiceData,
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  MessageComponentInteraction,
  ModalSubmitInteraction,
} from 'discord.js';

export interface BotChatCommandDataOption {
  name: string;
  type: number;
  description: string;
  required?: boolean;
  autocomplete?: boolean;
  choices?: ApplicationCommandOptionChoiceData<string | number>[];
  options?: BotChatCommandDataOption[];
}

export interface BotChatCommandData {
  name: string;
  description: string;
  options?: BotChatCommandDataOption[];
}

export interface BotChatCommand {
  data: BotChatCommandData;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}

export interface BotComponentHandler {
  customId?: string;
  customIdPrefix?: string;
  execute: (interaction: MessageComponentInteraction) => Promise<void>;
}

export interface BotModalHandler {
  customId?: string;
  customIdPrefix?: string;
  execute: (interaction: ModalSubmitInteraction) => Promise<void>;
}
