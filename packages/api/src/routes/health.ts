import type { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/',
    {
      schema: {
        response: {
          200: Type.Object({
            status: Type.String(),
            timestamp: Type.String(),
            uptime: Type.Number(),
          }),
        },
      },
    },
    async () => ({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    }),
  );

  app.get(
    '/ready',
    {
      schema: {
        response: {
          200: Type.Object({
            status: Type.String(),
            database: Type.String(),
            redis: Type.String(),
          }),
          503: Type.Object({
            status: Type.String(),
            database: Type.String(),
            redis: Type.String(),
          }),
        },
      },
    },
    async (request, reply) => {
      try {
        await app.prisma.$queryRaw`SELECT 1`;
        const dbStatus = 'connected';

        let redisStatus = 'not configured';
        // Check if Redis adapter is configured (Socket.IO Redis adapter adds a specific property)
        if (
          app.io.adapter &&
          typeof app.io.adapter === 'object' &&
          'constructor' in app.io.adapter
        ) {
          const adapterConstructor = app.io.adapter.constructor.name;
          if (
            adapterConstructor.includes('Redis') ||
            adapterConstructor.includes('Adapter')
          ) {
            redisStatus = 'connected';
          }
        }

        return { status: 'ready', database: dbStatus, redis: redisStatus };
      } catch {
        reply.code(503);
        return {
          status: 'not ready',
          database: 'disconnected',
          redis: 'unknown',
        };
      }
    },
  );
};
