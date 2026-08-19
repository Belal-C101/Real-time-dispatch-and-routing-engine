import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TerminalSchema } from '@dispatch/shared/schemas';

const TerminalResponse = Type.Object({
  id: Type.String({ format: 'uuid' }),
  name: Type.String(),
  location: Type.Object({
    latitude: Type.Number(),
    longitude: Type.Number(),
  }),
  timezone: Type.String(),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});

const TerminalsResponse = Type.Array(TerminalResponse);

const CreateTerminalBody = Type.Object({
  name: Type.String({ minLength: 1 }),
  location: Type.Object({
    latitude: Type.Number({ minimum: -90, maximum: 90 }),
    longitude: Type.Number({ minimum: -180, maximum: 180 }),
  }),
  timezone: Type.String(),
});

const UpdateTerminalBody = Type.Partial(CreateTerminalBody);

export const terminalRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', {
    schema: {
      response: { 200: TerminalsResponse },
    },
  }, async () => {
    const terminals = await app.prisma.terminal.findMany({
      orderBy: { name: 'asc' },
    });
    return terminals;
  });

  app.get('/:id', {
    schema: {
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      response: { 200: TerminalResponse, 404: Type.Object({ message: Type.String() }) },
    },
  }, async (request, reply) => {
    const terminal = await app.prisma.terminal.findUnique({
      where: { id: request.params.id },
    });
    if (!terminal) {
      return reply.code(404).send({ message: 'Terminal not found' });
    }
    return terminal;
  });

  app.post('/', {
    schema: {
      body: CreateTerminalBody,
      response: { 201: TerminalResponse, 400: Type.Object({ message: Type.String() }) },
    },
  }, async (request, reply) => {
    const terminal = await app.prisma.terminal.create({
      data: request.body,
    });
    
    // Emit realtime event
    app.io.emit('terminal:created', terminal);
    
    return reply.code(201).send(terminal);
  });

  app.put('/:id', {
    schema: {
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      body: UpdateTerminalBody,
      response: { 200: TerminalResponse, 404: Type.Object({ message: Type.String() }) },
    },
  }, async (request, reply) => {
    const terminal = await app.prisma.terminal.update({
      where: { id: request.params.id },
      data: request.body,
    }).catch(() => null);
    
    if (!terminal) {
      return reply.code(404).send({ message: 'Terminal not found' });
    }
    
    app.io.emit('terminal:updated', terminal);
    return terminal;
  });

  app.delete('/:id', {
    schema: {
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      response: { 204: Type.Null(), 404: Type.Object({ message: Type.String() }) },
    },
  }, async (request, reply) => {
    const terminal = await app.prisma.terminal.delete({
      where: { id: request.params.id },
    }).catch(() => null);
    
    if (!terminal) {
      return reply.code(404).send({ message: 'Terminal not found' });
    }
    
    app.io.emit('terminal:deleted', { id: request.params.id });
    return reply.code(204).send();
  });
};
