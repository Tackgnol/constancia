import type { FastifyPluginAsync } from 'fastify';
import authRoutes from './auth-routes.js';
import campaignRoutes from './campaign-routes.js';
import characterRoutes from './character-routes.js';
import npcRoutes from './npc-routes.js';
import eventRoutes from './event-routes.js';
import journalRoutes from './journal-routes.js';
import botRoutes from './bot-routes.js';
import systemRoutes from './system-routes.js';

const apiRoutes: FastifyPluginAsync = async (app) => {
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(campaignRoutes, { prefix: '/campaigns' });
  await app.register(characterRoutes, { prefix: '/campaigns/:id/characters' });
  await app.register(npcRoutes, { prefix: '/campaigns/:id/npcs' });
  await app.register(eventRoutes, { prefix: '/campaigns/:id/events' });
  await app.register(journalRoutes, { prefix: '/campaigns/:id' });
  await app.register(botRoutes, { prefix: '/bot' });
  await app.register(systemRoutes, { prefix: '/systems' });
};

export default apiRoutes;
