import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';
import { createAuditLog } from '../utils/audit.js';
import type { PrismaClient } from '@prisma/client';

const DriverResponse = Type.Object({
  id: Type.String({ format: 'uuid' }),
  name: Type.String(),
  employeeId: Type.String(),
  hosStatus: Type.Union([
    Type.Literal('OFF_DUTY'),
    Type.Literal('SLEEPER_BERTH'),
    Type.Literal('DRIVING'),
    Type.Literal('ON_DUTY'),
  ]),
  currentCycleHours: Type.Number(),
  maxCycleHours: Type.Number(),
  terminalId: Type.String({ format: 'uuid' }),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});

const DriversResponse = Type.Array(DriverResponse);

const CreateDriverBody = Type.Object({
  name: Type.String({ minLength: 1 }),
  employeeId: Type.String({ minLength: 1 }),
  terminalId: Type.String({ format: 'uuid' }),
  hosStatus: Type.Optional(
    Type.Union([
      Type.Literal('OFF_DUTY'),
      Type.Literal('SLEEPER_BERTH'),
      Type.Literal('DRIVING'),
      Type.Literal('ON_DUTY'),
    ]),
  ),
  currentCycleHours: Type.Optional(Type.Number({ minimum: 0 })),
  maxCycleHours: Type.Optional(Type.Number({ minimum: 0 })),
});

const UpdateDriverBody = Type.Partial(CreateDriverBody);

const GetDriversQuery = Type.Object({
  terminalId: Type.Optional(Type.String({ format: 'uuid' })),
});

const DriverParams = Type.Object({ id: Type.String({ format: 'uuid' }) });

type GetDriversQueryType = Static<typeof GetDriversQuery>;
type DriverParamsType = Static<typeof DriverParams>;
type CreateDriverBodyType = Static<typeof CreateDriverBody>;
type UpdateDriverBodyType = Static<typeof UpdateDriverBody>;

function getActor(request: FastifyRequest): string {
  return (request.headers['x-actor'] as string) || 'system';
}

function toPlainObject(obj: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(obj));
}

export const driverRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/',
    {
      schema: {
        querystring: GetDriversQuery,
        response: { 200: DriversResponse },
      },
    },
    async (request) => {
      const query = request.query as GetDriversQueryType;
      const where = query.terminalId ? { terminalId: query.terminalId } : {};
      return app.prisma.driver.findMany({
        where,
        include: { terminal: true },
        orderBy: { name: 'asc' },
      });
    },
  );

  app.get(
    '/:id',
    {
      schema: {
        params: DriverParams,
        response: {
          200: DriverResponse,
          404: Type.Object({ message: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      const params = request.params as DriverParamsType;
      const driver = await app.prisma.driver.findUnique({
        where: { id: params.id },
        include: { terminal: true },
      });
      if (!driver) {
        return reply.code(404).send({ message: 'Driver not found' });
      }
      return driver;
    },
  );

  app.post(
    '/',
    {
      schema: {
        body: CreateDriverBody,
        response: {
          201: DriverResponse,
          400: Type.Object({ message: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      const body = request.body as CreateDriverBodyType;
      const driver = await app.prisma.driver.create({
        data: body,
        include: { terminal: true },
      });

      // Audit log
      await createAuditLog(app.prisma as PrismaClient, {
        entityType: 'Driver',
        entityId: driver.id,
        action: 'CREATE',
        actor: getActor(request),
        priorState: {},
        newState: toPlainObject(driver),
        reasonCode: 'DRIVER_CREATED',
      });

      app.io.emit('driver:created', driver);
      return reply.code(201).send(driver);
    },
  );

  app.put(
    '/:id',
    {
      schema: {
        params: DriverParams,
        body: UpdateDriverBody,
        response: {
          200: DriverResponse,
          404: Type.Object({ message: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      const params = request.params as DriverParamsType;
      const body = request.body as UpdateDriverBodyType;

      // Get prior state
      const priorDriver = await app.prisma.driver.findUnique({
        where: { id: params.id },
        include: { terminal: true },
      });

      if (!priorDriver) {
        return reply.code(404).send({ message: 'Driver not found' });
      }

      const driver = await app.prisma.driver
        .update({
          where: { id: params.id },
          data: body,
          include: { terminal: true },
        })
        .catch(() => null);

      if (!driver) {
        return reply.code(404).send({ message: 'Driver not found' });
      }

      // Audit log
      await createAuditLog(app.prisma as PrismaClient, {
        entityType: 'Driver',
        entityId: driver.id,
        action: 'UPDATE',
        actor: getActor(request),
        priorState: toPlainObject(priorDriver),
        newState: toPlainObject(driver),
        reasonCode: 'DRIVER_UPDATED',
      });

      app.io.emit('driver:updated', driver);
      return driver;
    },
  );

  app.delete(
    '/:id',
    {
      schema: {
        params: DriverParams,
        response: {
          204: Type.Null(),
          404: Type.Object({ message: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      const params = request.params as DriverParamsType;

      // Get prior state for audit
      const priorDriver = await app.prisma.driver.findUnique({
        where: { id: params.id },
        include: { terminal: true },
      });

      if (!priorDriver) {
        return reply.code(404).send({ message: 'Driver not found' });
      }

      await app.prisma.driver
        .delete({
          where: { id: params.id },
        })
        .catch(() => null);

      // Audit log
      await createAuditLog(app.prisma as PrismaClient, {
        entityType: 'Driver',
        entityId: params.id,
        action: 'DELETE',
        actor: getActor(request),
        priorState: toPlainObject(priorDriver),
        newState: {},
        reasonCode: 'DRIVER_DELETED',
      });

      app.io.emit('driver:deleted', { id: params.id });
      return reply.code(204).send();
    },
  );
};
