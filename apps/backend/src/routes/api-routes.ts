import type { FastifyPluginAsync } from 'fastify';
import authRoutes from './auth-routes.js';
import campaignRoutes from './campaign-routes.js';
import channelRoutes from './channel-routes.js';
import characterRoutes from './character-routes.js';
import npcRoutes from './npc-routes.js';
import eventRoutes from './event-routes.js';
import journalRoutes from './journal-routes.js';
import botRoutes from './bot-routes.js';
import systemRoutes from './system-routes.js';
import sessionGuardPlugin from '../plugins/session-guard-plugin.js';
import botAuthPlugin from '../plugins/bot-auth-plugin.js';

const apiRoutes: FastifyPluginAsync = async (app) => {
  await app.register(authRoutes, { prefix: '/auth' });

  // Session-guarded routes (user-facing)
  await app.register(async (protected_) => {
    await protected_.register(sessionGuardPlugin);
    await protected_.register(campaignRoutes, { prefix: '/campaigns' });
    await protected_.register(channelRoutes, { prefix: '/campaigns/:id/channels' });
    await protected_.register(characterRoutes, { prefix: '/campaigns/:id/characters' });
    await protected_.register(npcRoutes, { prefix: '/campaigns/:id/npcs' });
    await protected_.register(eventRoutes, { prefix: '/campaigns/:id/events' });
    await protected_.register(journalRoutes, { prefix: '/campaigns/:id' });
    await protected_.register(systemRoutes, { prefix: '/systems' });
  });

  // Bot-to-backend routes (API key protected)
  await app.register(async (botScope) => {
    await botScope.register(botAuthPlugin);
    await botScope.register(botRoutes, { prefix: '/bot' });
  });
};

export default apiRoutes;
