import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';
import { createAuditLog } from '../utils/audit.js';
import type { PrismaClient } from '@prisma/client';

const TractorResponse = Type.Object({
  id: Type.String({ format: 'uuid' }),
  terminalId: Type.String({ format: 'uuid' }),
  driverId: Type.String({ format: 'uuid' }),
  vin: Type.String({ minLength: 17, maxLength: 17 }),
  make: Type.String(),
  model: Type.String(),
  year: Type.Number(),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});

const TractorsResponse = Type.Array(TractorResponse);

const CreateTractorBody = Type.Object({
  terminalId: Type.String({ format: 'uuid' }),
  driverId: Type.String({ format: 'uuid' }),
  vin: Type.String({ minLength: 17, maxLength: 17 }),
  make: Type.String(),
  model: Type.String(),
  year: Type.Number({ minimum: 1900, maximum: new Date().getFullYear() + 1 }),
});

const UpdateTractorBody = Type.Partial(CreateTractorBody);

const GetTractorsQuery = Type.Object({
  terminalId: Type.Optional(Type.String({ format: 'uuid' })),
});

const TractorParams = Type.Object({ id: Type.String({ format: 'uuid' }) });

type GetTractorsQueryType = Static<typeof GetTractorsQuery>;
type TractorParamsType = Static<typeof TractorParams>;
type CreateTractorBodyType = Static<typeof CreateTractorBody>;
type UpdateTractorBodyType = Static<typeof UpdateTractorBody>;

function getActor(request: FastifyRequest): string {
  return (request.headers['x-actor'] as string) || 'system';
}

function toPlainObject(obj: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(obj));
}

export const tractorRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/',
    {
      schema: {
        querystring: GetTractorsQuery,
        response: { 200: TractorsResponse },
      },
    },
    async (request) => {
      const query = request.query as GetTractorsQueryType;
      const where = query.terminalId ? { terminalId: query.terminalId } : {};
      return app.prisma.tractor.findMany({
        where,
        include: { terminal: true, driver: true },
        orderBy: { createdAt: 'desc' },
      });
    },
  );

  app.get(
    '/:id',
    {
      schema: {
        params: TractorParams,
        response: {
          200: TractorResponse,
          404: Type.Object({ message: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      const params = request.params as TractorParamsType;
      const tractor = await app.prisma.tractor.findUnique({
        where: { id: params.id },
        include: { terminal: true, driver: true },
      });
      if (!tractor) {
        return reply.code(404).send({ message: 'Tractor not found' });
      }
      return tractor;
    },
  );

  app.post(
    '/',
    {
      schema: {
        body: CreateTractorBody,
        response: {
          201: TractorResponse,
          400: Type.Object({ message: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      const body = request.body as CreateTractorBodyType;
      const tractor = await app.prisma.tractor.create({
        data: body,
        include: { terminal: true, driver: true },
      });

      // Audit log
      await createAuditLog(app.prisma as PrismaClient, {
        entityType: 'Tractor',
        entityId: tractor.id,
        action: 'CREATE',
        actor: getActor(request),
        priorState: {},
        newState: toPlainObject(tractor),
        reasonCode: 'TRACTOR_CREATED',
      });

      app.io.emit('tractor:created', tractor);
      return reply.code(201).send(tractor);
    },
  );

  app.put(
    '/:id',
    {
      schema: {
        params: TractorParams,
        body: UpdateTractorBody,
        response: {
          200: TractorResponse,
          404: Type.Object({ message: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      const params = request.params as TractorParamsType;
      const body = request.body as UpdateTractorBodyType;

      // Get prior state
      const priorTractor = await app.prisma.tractor.findUnique({
        where: { id: params.id },
        include: { terminal: true, driver: true },
      });

      if (!priorTractor) {
        return reply.code(404).send({ message: 'Tractor not found' });
      }

      const tractor = await app.prisma.tractor
        .update({
          where: { id: params.id },
          data: body,
          include: { terminal: true, driver: true },
        })
        .catch(() => null);

      if (!tractor) {
        return reply.code(404).send({ message: 'Tractor not found' });
      }

      // Audit log
      await createAuditLog(app.prisma as PrismaClient, {
        entityType: 'Tractor',
        entityId: tractor.id,
        action: 'UPDATE',
        actor: getActor(request),
        priorState: toPlainObject(priorTractor),
        newState: toPlainObject(tractor),
        reasonCode: 'TRACTOR_UPDATED',
      });

      app.io.emit('tractor:updated', tractor);
      return tractor;
    },
  );

  app.delete(
    '/:id',
    {
      schema: {
        params: TractorParams,
        response: {
          204: Type.Null(),
          404: Type.Object({ message: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      const params = request.params as TractorParamsType;

      // Get prior state for audit
      const priorTractor = await app.prisma.tractor.findUnique({
        where: { id: params.id },
        include: { terminal: true, driver: true },
      });

      if (!priorTractor) {
        return reply.code(404).send({ message: 'Tractor not found' });
      }

      await app.prisma.tractor
        .delete({
          where: { id: params.id },
        })
        .catch(() => null);

      // Audit log
      await createAuditLog(app.prisma as PrismaClient, {
        entityType: 'Tractor',
        entityId: params.id,
        action: 'DELETE',
        actor: getActor(request),
        priorState: toPlainObject(priorTractor),
        newState: {},
        reasonCode: 'TRACTOR_DELETED',
      });

      app.io.emit('tractor:deleted', { id: params.id });
      return reply.code(204).send();
    },
  );
};
