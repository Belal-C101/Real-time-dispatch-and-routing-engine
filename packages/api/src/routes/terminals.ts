import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';
import { createAuditLog } from '../utils/audit.js';
import type { PrismaClient } from '@prisma/client';

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

const GetTerminalParams = Type.Object({ id: Type.String({ format: 'uuid' }) });
const DeleteTerminalParams = Type.Object({
  id: Type.String({ format: 'uuid' }),
});

type GetTerminalParamsType = Static<typeof GetTerminalParams>;
type DeleteTerminalParamsType = Static<typeof DeleteTerminalParams>;
type CreateTerminalBodyType = Static<typeof CreateTerminalBody>;
type UpdateTerminalBodyType = Static<typeof UpdateTerminalBody>;

function getActor(request: FastifyRequest): string {
  return (request.headers['x-actor'] as string) || 'system';
}

function toPlainObject(obj: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(obj));
}

export const terminalRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/',
    {
      schema: {
        response: { 200: TerminalsResponse },
      },
    },
    async () => {
      const terminals = await app.prisma.terminal.findMany({
        orderBy: { name: 'asc' },
      });
      return terminals;
    },
  );

  app.get(
    '/:id',
    {
      schema: {
        params: GetTerminalParams,
        response: {
          200: TerminalResponse,
          404: Type.Object({ message: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      const params = request.params as GetTerminalParamsType;
      const terminal = await app.prisma.terminal.findUnique({
        where: { id: params.id },
      });
      if (!terminal) {
        return reply.code(404).send({ message: 'Terminal not found' });
      }
      return terminal;
    },
  );

  app.post(
    '/',
    {
      schema: {
        body: CreateTerminalBody,
        response: {
          201: TerminalResponse,
          400: Type.Object({ message: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      const body = request.body as CreateTerminalBodyType;
      const terminal = await app.prisma.terminal.create({
        data: body,
      });

      // Audit log
      await createAuditLog(app.prisma as PrismaClient, {
        entityType: 'Terminal',
        entityId: terminal.id,
        action: 'CREATE',
        actor: getActor(request),
        priorState: {},
        newState: toPlainObject(terminal),
        reasonCode: 'TERMINAL_CREATED',
      });

      // Emit realtime event
      app.io.emit('terminal:created', terminal);

      return reply.code(201).send(terminal);
    },
  );

  app.put(
    '/:id',
    {
      schema: {
        params: GetTerminalParams,
        body: UpdateTerminalBody,
        response: {
          200: TerminalResponse,
          404: Type.Object({ message: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      const params = request.params as GetTerminalParamsType;
      const body = request.body as UpdateTerminalBodyType;

      // Get prior state
      const priorTerminal = await app.prisma.terminal.findUnique({
        where: { id: params.id },
      });

      if (!priorTerminal) {
        return reply.code(404).send({ message: 'Terminal not found' });
      }

      const terminal = await app.prisma.terminal
        .update({
          where: { id: params.id },
          data: body,
        })
        .catch(() => null);

      if (!terminal) {
        return reply.code(404).send({ message: 'Terminal not found' });
      }

      // Audit log
      await createAuditLog(app.prisma as PrismaClient, {
        entityType: 'Terminal',
        entityId: terminal.id,
        action: 'UPDATE',
        actor: getActor(request),
        priorState: toPlainObject(priorTerminal),
        newState: toPlainObject(terminal),
        reasonCode: 'TERMINAL_UPDATED',
      });

      app.io.emit('terminal:updated', terminal);
      return terminal;
    },
  );

  app.delete(
    '/:id',
    {
      schema: {
        params: DeleteTerminalParams,
        response: {
          204: Type.Null(),
          404: Type.Object({ message: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      const params = request.params as DeleteTerminalParamsType;

      // Get prior state for audit
      const priorTerminal = await app.prisma.terminal.findUnique({
        where: { id: params.id },
      });

      if (!priorTerminal) {
        return reply.code(404).send({ message: 'Terminal not found' });
      }

      const terminal = await app.prisma.terminal
        .delete({
          where: { id: params.id },
        })
        .catch(() => null);

      if (!terminal) {
        return reply.code(404).send({ message: 'Terminal not found' });
      }

      // Audit log
      await createAuditLog(app.prisma as PrismaClient, {
        entityType: 'Terminal',
        entityId: params.id,
        action: 'DELETE',
        actor: getActor(request),
        priorState: toPlainObject(priorTerminal),
        newState: {},
        reasonCode: 'TERMINAL_DELETED',
      });

      app.io.emit('terminal:deleted', { id: params.id });
      return reply.code(204).send();
    },
  );
};
