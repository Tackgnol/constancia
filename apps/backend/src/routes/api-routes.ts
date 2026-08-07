import type { FastifyPluginAsync } from 'fastify';
import { authBotRoutes, authPublicRoutes } from './auth-routes.js';
import campaignRoutes from './campaign-routes.js';
import campaignNpcRoutes from './campaign-npc-routes.js';
import playerNpcRoutes from './player-npc-routes.js';
import playerCharacterRoutes from './player-character-routes.js';
import channelRoutes from './channel-routes.js';
import characterRoutes from './character-routes.js';
import eventRoutes from './event-routes.js';
import messageRoutes from './message-routes.js';
import journalRoutes from './journal-routes.js';
import loreRoutes from './lore-routes.js';
import sceneRoutes from './scene-routes.js';
import botRoutes from './bot-routes.js';
import systemRoutes from './system-routes.js';
import userSettingsRoutes from './user-settings-routes.js';
import { uploadProtectedRoutes, uploadPublicRoutes } from './upload-routes.js';
import adminRoutes from './admin-routes.js';
import adminBanRoutes from './admin-ban-routes.js';
import sessionGuardPlugin from '../plugins/session-guard-plugin.js';
import botAuthPlugin from '../plugins/bot-auth-plugin.js';
import campaignAdminScopePlugin from '../plugins/campaign-admin-scope-plugin.js';
import superUserScopePlugin from '../plugins/super-user-scope-plugin.js';

const apiRoutes: FastifyPluginAsync = async (app) => {
  await app.register(authPublicRoutes, { prefix: '/auth' });
  await app.register(uploadPublicRoutes, { prefix: '/uploads' });
  await app.register(systemRoutes, { prefix: '/systems' });

  // Session-guarded routes (user-facing)
  await app.register(async (protected_) => {
    await protected_.register(sessionGuardPlugin);
    await protected_.register(userSettingsRoutes, { prefix: '/users' });
    await protected_.register(uploadProtectedRoutes, { prefix: '/uploads' });
    await protected_.register(campaignRoutes, { prefix: '/campaigns' });
    await protected_.register(playerCharacterRoutes, { prefix: '/campaigns/:id/player-character' });
    await protected_.register(playerNpcRoutes, { prefix: '/campaigns/:id/player-npcs' });

    await protected_.register(async (superUserScope) => {
      await superUserScope.register(superUserScopePlugin);
      await superUserScope.register(adminRoutes, { prefix: '/admin' });
      await superUserScope.register(adminBanRoutes, { prefix: '/admin' });
    });

    await protected_.register(async (campaignAdminScope) => {
      await campaignAdminScope.register(campaignAdminScopePlugin);
      await campaignAdminScope.register(channelRoutes, { prefix: '/campaigns/:id/channels' });
      await campaignAdminScope.register(characterRoutes, {
        prefix: '/campaigns/:id/characters',
      });
      await campaignAdminScope.register(campaignNpcRoutes, { prefix: '/campaigns/:id/npcs' });
      await campaignAdminScope.register(eventRoutes, { prefix: '/campaigns/:id/events' });
      await campaignAdminScope.register(messageRoutes, { prefix: '/campaigns/:id/messages' });
      await campaignAdminScope.register(journalRoutes, { prefix: '/campaigns/:id' });
      await campaignAdminScope.register(loreRoutes, { prefix: '/campaigns/:id/lore' });
      await campaignAdminScope.register(sceneRoutes, { prefix: '/campaigns/:id/scenes' });
    });
  });

  // Bot-to-backend routes (API key protected). /auth/magic-link lives here so
  // only the Discord bot can mint login tokens for Discord users.
  await app.register(async (botScope) => {
    await botScope.register(botAuthPlugin);
    await botScope.register(authBotRoutes, { prefix: '/auth' });
    await botScope.register(botRoutes, { prefix: '/bot' });
  });
};

export default apiRoutes;
