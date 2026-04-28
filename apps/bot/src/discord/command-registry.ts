import { journalCommand } from '../commands/journal.js';
import { loginCommand } from '../commands/login.js';
import { npcCommand } from '../commands/npcs.js';
import { participantsCommand } from '../commands/participants.js';
import { rollCommand } from '../commands/roll.js';
import { sheetCommand } from '../commands/sheet.js';
import { setupCommand } from '../commands/setup.js';
import { testInstanceComponentHandler, testInstanceModalHandler } from './test-instances.js';
import type {
  BotChatCommand,
  BotChatCommandData,
  BotComponentHandler,
  BotModalHandler,
} from './command-types.js';

export const chatCommands = [
  rollCommand,
  journalCommand,
  npcCommand,
  loginCommand,
  sheetCommand,
  setupCommand,
  participantsCommand,
] as const satisfies readonly BotChatCommand[];

const commandMap = new Map<string, BotChatCommand>(
  chatCommands.map((command) => [command.data.name, command]),
);

export const componentHandlers: readonly BotComponentHandler[] = [testInstanceComponentHandler];
export const modalHandlers: readonly BotModalHandler[] = [testInstanceModalHandler];

const componentMap = new Map<string, BotComponentHandler>(
  componentHandlers
    .filter((handler) => typeof handler.customId === 'string')
    .map((handler) => [handler.customId as string, handler]),
);

const modalMap = new Map<string, BotModalHandler>(
  modalHandlers
    .filter((handler) => typeof handler.customId === 'string')
    .map((handler) => [handler.customId as string, handler]),
);

export function getChatCommand(name: string): BotChatCommand | undefined {
  return commandMap.get(name);
}

export function getChatCommandData(): BotChatCommandData[] {
  return chatCommands.map((command) => command.data);
}

export function getComponentHandler(customId: string): BotComponentHandler | undefined {
  return (
    componentMap.get(customId) ??
    componentHandlers.find(
      (handler) =>
        typeof handler.customIdPrefix === 'string' && customId.startsWith(handler.customIdPrefix),
    )
  );
}

export function getModalHandler(customId: string): BotModalHandler | undefined {
  return (
    modalMap.get(customId) ??
    modalHandlers.find(
      (handler) =>
        typeof handler.customIdPrefix === 'string' && customId.startsWith(handler.customIdPrefix),
    )
  );
}
