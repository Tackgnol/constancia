import {
  MessageFlags,
  type Interaction,
  type InteractionEditReplyOptions,
  type InteractionReplyOptions,
} from 'discord.js';
import { getChatCommand, getComponentHandler, getModalHandler } from './command-registry.js';
import { errorReplyContent } from '../backend/access-revoked.js';
import { botBackend, type BotBackend } from '../backend/bot-backend.js';

export async function routeInteraction(
  interaction: Interaction,
  backend: BotBackend = botBackend,
): Promise<void> {
  if (interaction.isChatInputCommand()) {
    const command = getChatCommand(interaction.commandName);
    if (!command) {
      return;
    }

    try {
      await backend.requireAccess(interaction.user.id, interaction.guildId ?? undefined);
      await command.execute(interaction);
    } catch (err) {
      console.error('Command error:', err);
      const msg = {
        content: errorReplyContent(err),
        flags: MessageFlags.Ephemeral,
      } as InteractionReplyOptions & InteractionEditReplyOptions;
      if (interaction.deferred) {
        await interaction.editReply(msg);
      } else {
        await interaction.reply(msg);
      }
    }

    return;
  }

  if (interaction.isAutocomplete()) {
    const command = getChatCommand(interaction.commandName);
    if (!command?.autocomplete) {
      return;
    }

    try {
      await backend.requireAccess(interaction.user.id, interaction.guildId ?? undefined);
      await command.autocomplete(interaction);
    } catch (err) {
      console.error('Autocomplete error:', err);
      if (!interaction.responded) {
        await interaction.respond([]);
      }
    }

    return;
  }

  if (interaction.isMessageComponent()) {
    const handler = getComponentHandler(interaction.customId);
    if (!handler) {
      return;
    }

    try {
      await backend.requireAccess(interaction.user.id, interaction.guildId ?? undefined);
      await handler.execute(interaction);
    } catch (err) {
      console.error('Component interaction error:', err);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: errorReplyContent(err) });
      } else {
        await interaction.reply({ content: errorReplyContent(err), flags: MessageFlags.Ephemeral });
      }
    }

    return;
  }

  if (interaction.isModalSubmit()) {
    const handler = getModalHandler(interaction.customId);
    if (!handler) {
      return;
    }

    try {
      await backend.requireAccess(interaction.user.id, interaction.guildId ?? undefined);
      await handler.execute(interaction);
    } catch (err) {
      console.error('Modal interaction error:', err);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: errorReplyContent(err) });
      } else {
        await interaction.reply({ content: errorReplyContent(err), flags: MessageFlags.Ephemeral });
      }
    }
  }
}
