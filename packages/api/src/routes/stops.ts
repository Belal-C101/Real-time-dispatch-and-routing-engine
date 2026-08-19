import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';
import { createAuditLog } from '../utils/audit.js';
import type { PrismaClient } from '@prisma/client';

const StopResponse = Type.Object({
  id: Type.String({ format: 'uuid' }),
  shipmentId: Type.String({ format: 'uuid' }),
  sequence: Type.Number(),
  type: Type.Union([Type.Literal('PICKUP'), Type.Literal('DELIVERY')]),
  address: Type.String(),
  latitude: Type.Number(),
  longitude: Type.Number(),
  windowStart: Type.String({ format: 'date-time' }),
  windowEnd: Type.String({ format: 'date-time' }),
  serviceTimeMinutes: Type.Number(),
  status: Type.Union([
    Type.Literal('PENDING'),
    Type.Literal('ASSIGNED'),
    Type.Literal('IN_PROGRESS'),
    Type.Literal('COMPLETED'),
    Type.Literal('CANCELLED'),
  ]),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});

const StopsResponse = Type.Array(StopResponse);

const CreateStopBody = Type.Object({
  shipmentId: Type.String({ format: 'uuid' }),
  sequence: Type.Number({ minimum: 0 }),
  type: Type.Union([Type.Literal('PICKUP'), Type.Literal('DELIVERY')]),
  address: Type.String(),
  latitude: Type.Number({ minimum: -90, maximum: 90 }),
  longitude: Type.Number({ minimum: -180, maximum: 180 }),
  windowStart: Type.String({ format: 'date-time' }),
  windowEnd: Type.String({ format: 'date-time' }),
  serviceTimeMinutes: Type.Number({ minimum: 0 }),
});

const UpdateStopBody = Type.Partial(CreateStopBody);

const GetStopsQuery = Type.Object({
  shipmentId: Type.Optional(Type.String({ format: 'uuid' })),
  status: Type.Optional(
    Type.Union([
      Type.Literal('PENDING'),
      Type.Literal('ASSIGNED'),
      Type.Literal('IN_PROGRESS'),
      Type.Literal('COMPLETED'),
      Type.Literal('CANCELLED'),
    ]),
  ),
});

const StopParams = Type.Object({ id: Type.String({ format: 'uuid' }) });

type GetStopsQueryType = Static<typeof GetStopsQuery>;
type StopParamsType = Static<typeof StopParams>;
type CreateStopBodyType = Static<typeof CreateStopBody>;
type UpdateStopBodyType = Static<typeof UpdateStopBody>;

function getActor(request: FastifyRequest): string {
  return (request.headers['x-actor'] as string) || 'system';
}

function toPlainObject(obj: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(obj));
}

export const stopRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/',
    {
      schema: {
        querystring: GetStopsQuery,
        response: { 200: StopsResponse },
      },
    },
    async (request) => {
      const query = request.query as GetStopsQueryType;
      const where: Record<string, unknown> = {};
      if (query.shipmentId) where.shipmentId = query.shipmentId;
      if (query.status) where.status = query.status;

      return app.prisma.stop.findMany({
        where,
        include: { shipment: true },
        orderBy: { sequence: 'asc' },
      });
    },
  );

  app.get(
    '/:id',
    {
      schema: {
        params: StopParams,
        response: {
          200: StopResponse,
          404: Type.Object({ message: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      const params = request.params as StopParamsType;
      const stop = await app.prisma.stop.findUnique({
        where: { id: params.id },
        include: { shipment: true, assignments: true },
      });
      if (!stop) {
        return reply.code(404).send({ message: 'Stop not found' });
      }
      return stop;
    },
  );

  app.post(
    '/',
    {
      schema: {
        body: CreateStopBody,
        response: {
          201: StopResponse,
          400: Type.Object({ message: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      const body = request.body as CreateStopBodyType;
      const stop = await app.prisma.stop.create({
        data: body,
        include: { shipment: true },
      });

      // Audit log
      await createAuditLog(app.prisma as PrismaClient, {
        entityType: 'Stop',
        entityId: stop.id,
        action: 'CREATE',
        actor: getActor(request),
        priorState: {},
        newState: toPlainObject(stop),
        reasonCode: 'STOP_CREATED',
      });

      app.io.emit('stop:created', stop);
      return reply.code(201).send(stop);
    },
  );

  app.put(
    '/:id',
    {
      schema: {
        params: StopParams,
        body: UpdateStopBody,
        response: {
          200: StopResponse,
          404: Type.Object({ message: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      const params = request.params as StopParamsType;
      const body = request.body as UpdateStopBodyType;

      // Get prior state
      const priorStop = await app.prisma.stop.findUnique({
        where: { id: params.id },
        include: { shipment: true },
      });

      if (!priorStop) {
        return reply.code(404).send({ message: 'Stop not found' });
      }

      const stop = await app.prisma.stop
        .update({
          where: { id: params.id },
          data: body,
          include: { shipment: true },
        })
        .catch(() => null);

      if (!stop) {
        return reply.code(404).send({ message: 'Stop not found' });
      }

      // Audit log
      await createAuditLog(app.prisma as PrismaClient, {
        entityType: 'Stop',
        entityId: stop.id,
        action: 'UPDATE',
        actor: getActor(request),
        priorState: toPlainObject(priorStop),
        newState: toPlainObject(stop),
        reasonCode: 'STOP_UPDATED',
      });

      app.io.emit('stop:updated', stop);
      return stop;
    },
  );

  app.delete(
    '/:id',
    {
      schema: {
        params: StopParams,
        response: {
          204: Type.Null(),
          404: Type.Object({ message: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      const params = request.params as StopParamsType;

      // Get prior state for audit
      const priorStop = await app.prisma.stop.findUnique({
        where: { id: params.id },
        include: { shipment: true },
      });

      if (!priorStop) {
        return reply.code(404).send({ message: 'Stop not found' });
      }

      await app.prisma.stop
        .delete({
          where: { id: params.id },
        })
        .catch(() => null);

      // Audit log
      await createAuditLog(app.prisma as PrismaClient, {
        entityType: 'Stop',
        entityId: params.id,
        action: 'DELETE',
        actor: getActor(request),
        priorState: toPlainObject(priorStop),
        newState: {},
        reasonCode: 'STOP_DELETED',
      });

      app.io.emit('stop:deleted', { id: params.id });
      return reply.code(204).send();
    },
  );
};
