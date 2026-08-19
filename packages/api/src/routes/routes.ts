import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';
import { createAuditLog } from '../utils/audit.js';
import type { PrismaClient } from '@prisma/client';

const RouteResponse = Type.Object({
  id: Type.String({ format: 'uuid' }),
  tractorId: Type.String({ format: 'uuid' }),
  driverId: Type.String({ format: 'uuid' }),
  terminalId: Type.String({ format: 'uuid' }),
  totalDistanceMiles: Type.Number(),
  totalDurationMinutes: Type.Number(),
  estimatedStartTime: Type.String({ format: 'date-time' }),
  estimatedEndTime: Type.String({ format: 'date-time' }),
  status: Type.Union([
    Type.Literal('DRAFT'),
    Type.Literal('ACTIVE'),
    Type.Literal('COMPLETED'),
    Type.Literal('CANCELLED'),
  ]),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});

const RoutesResponse = Type.Array(RouteResponse);

const CreateRouteBody = Type.Object({
  tractorId: Type.String({ format: 'uuid' }),
  driverId: Type.String({ format: 'uuid' }),
  terminalId: Type.String({ format: 'uuid' }),
  totalDistanceMiles: Type.Number({ minimum: 0 }),
  totalDurationMinutes: Type.Number({ minimum: 0 }),
  estimatedStartTime: Type.String({ format: 'date-time' }),
  estimatedEndTime: Type.String({ format: 'date-time' }),
  status: Type.Optional(
    Type.Union([
      Type.Literal('DRAFT'),
      Type.Literal('ACTIVE'),
      Type.Literal('COMPLETED'),
      Type.Literal('CANCELLED'),
    ]),
  ),
});

const UpdateRouteBody = Type.Partial(CreateRouteBody);

const GetRoutesQuery = Type.Object({
  terminalId: Type.Optional(Type.String({ format: 'uuid' })),
  tractorId: Type.Optional(Type.String({ format: 'uuid' })),
  driverId: Type.Optional(Type.String({ format: 'uuid' })),
  status: Type.Optional(
    Type.Union([
      Type.Literal('DRAFT'),
      Type.Literal('ACTIVE'),
      Type.Literal('COMPLETED'),
      Type.Literal('CANCELLED'),
    ]),
  ),
});

const RouteParams = Type.Object({ id: Type.String({ format: 'uuid' }) });

type GetRoutesQueryType = Static<typeof GetRoutesQuery>;
type RouteParamsType = Static<typeof RouteParams>;
type CreateRouteBodyType = Static<typeof CreateRouteBody>;
type UpdateRouteBodyType = Static<typeof UpdateRouteBody>;

function getActor(request: FastifyRequest): string {
  return (request.headers['x-actor'] as string) || 'system';
}

function toPlainObject(obj: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(obj));
}

export const routeRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/',
    {
      schema: {
        querystring: GetRoutesQuery,
        response: { 200: RoutesResponse },
      },
    },
    async (request) => {
      const query = request.query as GetRoutesQueryType;
      const where: Record<string, unknown> = {};
      if (query.terminalId) where.terminalId = query.terminalId;
      if (query.tractorId) where.tractorId = query.tractorId;
      if (query.driverId) where.driverId = query.driverId;
      if (query.status) where.status = query.status;

      return app.prisma.route.findMany({
        where,
        include: {
          tractor: true,
          driver: true,
          terminal: true,
          stops: true,
          assignments: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    },
  );

  app.get(
    '/:id',
    {
      schema: {
        params: RouteParams,
        response: {
          200: RouteResponse,
          404: Type.Object({ message: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      const params = request.params as RouteParamsType;
      const route = await app.prisma.route.findUnique({
        where: { id: params.id },
        include: {
          tractor: true,
          driver: true,
          terminal: true,
          stops: true,
          assignments: true,
        },
      });
      if (!route) {
        return reply.code(404).send({ message: 'Route not found' });
      }
      return route;
    },
  );

  app.post(
    '/',
    {
      schema: {
        body: CreateRouteBody,
        response: {
          201: RouteResponse,
          400: Type.Object({ message: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      const body = request.body as CreateRouteBodyType;
      const route = await app.prisma.route.create({
        data: body,
        include: {
          tractor: true,
          driver: true,
          terminal: true,
          stops: true,
          assignments: true,
        },
      });

      // Audit log
      await createAuditLog(app.prisma as PrismaClient, {
        entityType: 'Route',
        entityId: route.id,
        action: 'CREATE',
        actor: getActor(request),
        priorState: {},
        newState: toPlainObject(route),
        reasonCode: 'ROUTE_CREATED',
      });

      app.io.emit('route:created', route);
      return reply.code(201).send(route);
    },
  );

  app.put(
    '/:id',
    {
      schema: {
        params: RouteParams,
        body: UpdateRouteBody,
        response: {
          200: RouteResponse,
          404: Type.Object({ message: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      const params = request.params as RouteParamsType;
      const body = request.body as UpdateRouteBodyType;

      // Get prior state
      const priorRoute = await app.prisma.route.findUnique({
        where: { id: params.id },
        include: {
          tractor: true,
          driver: true,
          terminal: true,
          stops: true,
          assignments: true,
        },
      });

      if (!priorRoute) {
        return reply.code(404).send({ message: 'Route not found' });
      }

      const route = await app.prisma.route
        .update({
          where: { id: params.id },
          data: body,
          include: {
            tractor: true,
            driver: true,
            terminal: true,
            stops: true,
            assignments: true,
          },
        })
        .catch(() => null);

      if (!route) {
        return reply.code(404).send({ message: 'Route not found' });
      }

      // Audit log
      await createAuditLog(app.prisma as PrismaClient, {
        entityType: 'Route',
        entityId: route.id,
        action: 'UPDATE',
        actor: getActor(request),
        priorState: toPlainObject(priorRoute),
        newState: toPlainObject(route),
        reasonCode: 'ROUTE_UPDATED',
      });

      app.io.emit('route:updated', route);
      return route;
    },
  );

  app.delete(
    '/:id',
    {
      schema: {
        params: RouteParams,
        response: {
          204: Type.Null(),
          404: Type.Object({ message: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      const params = request.params as RouteParamsType;

      // Get prior state for audit
      const priorRoute = await app.prisma.route.findUnique({
        where: { id: params.id },
        include: {
          tractor: true,
          driver: true,
          terminal: true,
          stops: true,
          assignments: true,
        },
      });

      if (!priorRoute) {
        return reply.code(404).send({ message: 'Route not found' });
      }

      await app.prisma.route
        .delete({
          where: { id: params.id },
        })
        .catch(() => null);

      // Audit log
      await createAuditLog(app.prisma as PrismaClient, {
        entityType: 'Route',
        entityId: params.id,
        action: 'DELETE',
        actor: getActor(request),
        priorState: toPlainObject(priorRoute),
        newState: {},
        reasonCode: 'ROUTE_DELETED',
      });

      app.io.emit('route:deleted', { id: params.id });
      return reply.code(204).send();
    },
  );
};
