import { FastifyPluginAsync } from 'fastify';
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

declare module 'fastify' {
  interface FastifyInstance {
    io: SocketIOServer;
  }
}

export const socketPlugin: FastifyPluginAsync = async (app) => {
  const io = new SocketIOServer(app.server, {
    cors: { origin: '*' },
    adapter: process.env.REDIS_URL ? createAdapter(
      createClient({ url: process.env.REDIS_URL }).duplicate(),
      createClient({ url: process.env.REDIS_URL }).duplicate()
    ) : undefined,
  });

  io.on('connection', (socket) => {
    app.log.info({ socketId: socket.id }, 'Client connected');

    socket.on('join-terminal', (terminalId: string) => {
      socket.join(`terminal:${terminalId}`);
      app.log.info({ socketId: socket.id, terminalId }, 'Client joined terminal room');
    });

    socket.on('leave-terminal', (terminalId: string) => {
      socket.leave(`terminal:${terminalId}`);
      app.log.info({ socketId: socket.id, terminalId }, 'Client left terminal room');
    });

    socket.on('disconnect', (reason) => {
      app.log.info({ socketId: socket.id, reason }, 'Client disconnected');
    });
  });

  app.decorate('io', io);

  app.addHook('onClose', async (instance) => {
    await instance.io.close();
  });
};
