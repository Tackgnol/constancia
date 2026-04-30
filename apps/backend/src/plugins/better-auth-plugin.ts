import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import {
  applyBetterAuthResponse,
  forwardToBetterAuth,
  summarizeSetCookieHeaders,
} from '../auth/http.js';

const betterAuthPlugin: FastifyPluginAsync = async (app) => {
  app.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    async handler(request, reply) {
      const path = request.raw.url ?? request.url;
      const response = await forwardToBetterAuth(request, path, {
        method: request.method as 'GET' | 'POST',
        body: request.body,
      });

      if (response.status >= 300 && response.status < 400) {
        request.log.info(
          {
            location: response.headers.get('location'),
            setCookies: summarizeSetCookieHeaders(response.headers),
          },
          'better auth redirect response',
        );
      }

      await applyBetterAuthResponse(response, reply);
    },
  });
};

export default fp(betterAuthPlugin, {
  name: 'better-auth-plugin',
});
