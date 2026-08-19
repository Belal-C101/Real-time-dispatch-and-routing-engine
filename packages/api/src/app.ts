import Fastify from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { socketPlugin } from './plugins/socket.js';
import { prismaPlugin } from './plugins/prisma.js';
import { healthRoutes } from './routes/health.js';
import { terminalRoutes } from './routes/terminals.js';
import { tractorRoutes } from './routes/tractors.js';
import { driverRoutes } from './routes/drivers.js';
import { shipmentRoutes } from './routes/shipments.js';
import { stopRoutes } from './routes/stops.js';
import { routeRoutes } from './routes/routes.js';
import { assignmentRoutes } from './routes/assignments.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      transport: process.env.NODE_ENV !== 'production' ? {
        target: 'pino-pretty',
        options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' },
      } : undefined,
    },
  }).withTypeProvider<TypeBoxTypeProvider>();

  // Security plugins
  await app.register(helmet);
  await app.register(cors, { origin: true });
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });

  // Core plugins
  await app.register(prismaPlugin);
  await app.register(socketPlugin);

  // Routes
  await app.register(healthRoutes, { prefix: '/health' });
  await app.register(terminalRoutes, { prefix: '/terminals' });
  await app.register(tractorRoutes, { prefix: '/tractors' });
  await app.register(driverRoutes, { prefix: '/drivers' });
  await app.register(shipmentRoutes, { prefix: '/shipments' });
  await app.register(stopRoutes, { prefix: '/stops' });
  await app.register(routeRoutes, { prefix: '/routes' });
  await app.register(assignmentRoutes, { prefix: '/assignments' });

  return app;
}
