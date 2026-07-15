import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { createCampaignAccess } from '../services/campaign-access.js';

const campaignAdminScopePlugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest('campaignScope');
  app.addHook('preHandler', async (request) => {
    const params = request.params;
    const campaignId =
      typeof params === 'object' &&
      params !== null &&
      'id' in params &&
      typeof params.id === 'string'
        ? params.id
        : '';

    request.campaignScope = await createCampaignAccess().requireAdmin(request.access, campaignId);
  });
};

export default fp(campaignAdminScopePlugin, {
  name: 'campaign-admin-scope-plugin',
});
