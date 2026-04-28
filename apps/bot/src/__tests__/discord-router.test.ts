import { afterEach, describe, expect, it, vi } from 'vitest';
import { getChatCommand, getChatCommandData } from '../discord/command-registry.js';
import { routeInteraction } from '../discord/interaction-router.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('command registry', () => {
  it('exposes the expected command names for registration', () => {
    expect(getChatCommandData().map((command) => command.name)).toEqual([
      'roll',
      'journal',
      'npc',
      'login',
      'sheet',
      'setup',
      'participants',
    ]);
  });

  it('registers the npc command with a required name option', () => {
    const npc = getChatCommand('npc');

    expect(npc?.data.options).toEqual([
      {
        name: 'name',
        type: 3,
        description: 'The NPC name you want to inspect',
        required: true,
      },
    ]);
  });

  it('keeps the participants subcommand metadata intact', () => {
    const participants = getChatCommand('participants');

    expect(participants?.data.options).toEqual([
      {
        name: 'add',
        type: 1,
        description: 'Add a player as a participant',
        options: [
          {
            name: 'user',
            type: 6,
            description: 'The Discord user to add',
            required: true,
          },
        ],
      },
      {
        name: 'remove',
        type: 1,
        description: 'Remove a participant from the campaign',
        options: [
          {
            name: 'user',
            type: 6,
            description: 'The Discord user to remove',
            required: true,
          },
        ],
      },
      {
        name: 'list',
        type: 1,
        description: 'List current campaign participants',
      },
    ]);
  });

  it('marks the setup game-system option as autocomplete-enabled', () => {
    const setup = getChatCommand('setup');

    expect(setup?.data.options).toEqual([
      {
        name: 'game-system',
        type: 3,
        description: 'Choose the game system for the linked campaign',
        required: false,
        autocomplete: true,
      },
    ]);
  });
});

describe('interaction router', () => {
  it('ignores non-command interactions', async () => {
    const interaction = {
      isChatInputCommand: () => false,
      isAutocomplete: () => false,
      isMessageComponent: () => false,
      isModalSubmit: () => false,
    };

    await expect(routeInteraction(interaction as never)).resolves.toBeUndefined();
  });

  it('routes known chat input commands to their execute handler', async () => {
    const command = getChatCommand('roll');
    if (!command) {
      throw new Error('roll command was not registered');
    }

    const executeSpy = vi.spyOn(command, 'execute').mockResolvedValue(undefined);
    const interaction = {
      isChatInputCommand: () => true,
      isAutocomplete: () => false,
      commandName: 'roll',
    };

    await routeInteraction(interaction as never);

    expect(executeSpy).toHaveBeenCalledTimes(1);
    expect(executeSpy).toHaveBeenCalledWith(interaction);
  });

  it('routes autocomplete interactions to the command autocomplete handler', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        text: async () =>
          JSON.stringify({
            status: 'ok',
            data: [
              { id: 'vtm-v5', name: 'Vampire: The Masquerade', version: '5e' },
              { id: 'mork-borg', name: 'Mork Borg', version: '1.0' },
            ],
          }),
      }),
    );

    const respond = vi.fn().mockResolvedValue(undefined);
    const interaction = {
      isChatInputCommand: () => false,
      isAutocomplete: () => true,
      isMessageComponent: () => false,
      isModalSubmit: () => false,
      responded: false,
      commandName: 'setup',
      options: {
        getFocused: () => ({ name: 'game-system', value: 'vampire' }),
      },
      respond,
    };

    await routeInteraction(interaction as never);

    expect(respond).toHaveBeenCalledWith([
      { name: 'Vampire: The Masquerade (5e)', value: 'vtm-v5' },
    ]);
  });

  it('ignores message component interactions when no handler is registered', async () => {
    const interaction = {
      isChatInputCommand: () => false,
      isAutocomplete: () => false,
      isMessageComponent: () => true,
      isModalSubmit: () => false,
      customId: 'unknown:button',
    };

    await expect(routeInteraction(interaction as never)).resolves.toBeUndefined();
  });

  it('ignores modal submit interactions when no handler is registered', async () => {
    const interaction = {
      isChatInputCommand: () => false,
      isAutocomplete: () => false,
      isMessageComponent: () => false,
      isModalSubmit: () => true,
      customId: 'unknown:modal',
    };

    await expect(routeInteraction(interaction as never)).resolves.toBeUndefined();
  });
});
