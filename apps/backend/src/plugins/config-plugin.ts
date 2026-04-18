import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import type { BackendConfig } from '../config.js';

interface ConfigPluginOptions {
  config: BackendConfig;
}

const configPlugin: FastifyPluginAsync<ConfigPluginOptions> = async (app, options) => {
  app.decorate('config', options.config);
};

export default fp(configPlugin, {
  name: 'config-plugin',
});
