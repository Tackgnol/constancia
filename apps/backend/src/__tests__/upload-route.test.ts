import multipart from '@fastify/multipart';
import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../config.js';
import configPlugin from '../plugins/config-plugin.js';
import requestErrorPlugin from '../plugins/request-error-plugin.js';

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
}));

vi.mock('../auth/prisma.js', () => ({
  getPrismaClient: () => prismaMock,
}));

import { uploadProtectedRoutes } from '../routes/upload-routes.js';

function createMultipartUpload() {
  const boundary = 'constancia-upload-boundary';
  const payload = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\nA shadowed clue\r\n`,
    ),
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="clue.png"\r\nContent-Type: image/png\r\n\r\n`,
    ),
    Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  return {
    contentType: `multipart/form-data; boundary=${boundary}`,
    payload,
  };
}

describe('upload route multipart boundary', () => {
  beforeEach(() => {
    prismaMock.user.findUnique.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('parses multipart fields before Fastify validates the request body schema', async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      BETTER_AUTH_SECRET: 'constancia-test-secret-12345678901234567890',
      UPLOAD_MAX_BYTES: '1024',
    });
    const app = Fastify({ logger: false });
    await app.register(configPlugin, { config });
    await app.register(requestErrorPlugin);
    await app.register(multipart, {
      limits: { fileSize: config.uploadMaxBytes, files: 1 },
    });
    app.addHook('onRequest', async (request) => {
      request.access = {
        kind: 'session',
        userId: 'user-1',
        email: 'keeper@example.test',
        discordUserId: 'discord-user-1',
        isSuperUser: false,
      };
    });
    await app.register(uploadProtectedRoutes, { prefix: '/uploads' });

    const upload = createMultipartUpload();
    const response = await app.inject({
      method: 'POST',
      url: '/uploads/image',
      headers: { 'content-type': upload.contentType },
      payload: upload.payload,
    });

    await app.close();

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      status: 'error',
      data: { message: 'User not found' },
    });
    expect(prismaMock.user.findUnique).toHaveBeenCalledOnce();
  });
});
