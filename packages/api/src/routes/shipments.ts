import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';
import { createAuditLog } from '../utils/audit.js';
import type { PrismaClient } from '@prisma/client';

const ShipmentResponse = Type.Object({
  id: Type.String({ format: 'uuid' }),
  terminalId: Type.String({ format: 'uuid' }),
  originAddress: Type.String(),
  originLatitude: Type.Number(),
  originLongitude: Type.Number(),
  destAddress: Type.String(),
  destLatitude: Type.Number(),
  destLongitude: Type.Number(),
  pickupStart: Type.String({ format: 'date-time' }),
  pickupEnd: Type.String({ format: 'date-time' }),
  deliveryStart: Type.String({ format: 'date-time' }),
  deliveryEnd: Type.String({ format: 'date-time' }),
  priority: Type.Union([
    Type.Literal('HIGH'),
    Type.Literal('MEDIUM'),
    Type.Literal('LOW'),
  ]),
  serviceTimeMinutes: Type.Number(),
  weightLbs: Type.Number(),
  volumeCubicFt: Type.Number(),
  rated: Type.Boolean(),
  billingFields: Type.Record(Type.String(), Type.Unknown()),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});

const ShipmentsResponse = Type.Array(ShipmentResponse);

const CreateShipmentBody = Type.Object({
  terminalId: Type.String({ format: 'uuid' }),
  originAddress: Type.String(),
  originLatitude: Type.Number({ minimum: -90, maximum: 90 }),
  originLongitude: Type.Number({ minimum: -180, maximum: 180 }),
  destAddress: Type.String(),
  destLatitude: Type.Number({ minimum: -90, maximum: 90 }),
  destLongitude: Type.Number({ minimum: -180, maximum: 180 }),
  pickupStart: Type.String({ format: 'date-time' }),
  pickupEnd: Type.String({ format: 'date-time' }),
  deliveryStart: Type.String({ format: 'date-time' }),
  deliveryEnd: Type.String({ format: 'date-time' }),
  priority: Type.Optional(
    Type.Union([
      Type.Literal('HIGH'),
      Type.Literal('MEDIUM'),
      Type.Literal('LOW'),
    ]),
  ),
  serviceTimeMinutes: Type.Number({ minimum: 0 }),
  weightLbs: Type.Number({ minimum: 0 }),
  volumeCubicFt: Type.Number({ minimum: 0 }),
  rated: Type.Optional(Type.Boolean()),
  billingFields: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

const UpdateShipmentBody = Type.Partial(CreateShipmentBody);

const GetShipmentsQuery = Type.Object({
  terminalId: Type.Optional(Type.String({ format: 'uuid' })),
  priority: Type.Optional(
    Type.Union([
      Type.Literal('HIGH'),
      Type.Literal('MEDIUM'),
      Type.Literal('LOW'),
    ]),
  ),
});

const ShipmentParams = Type.Object({ id: Type.String({ format: 'uuid' }) });

type GetShipmentsQueryType = Static<typeof GetShipmentsQuery>;
type ShipmentParamsType = Static<typeof ShipmentParams>;
type CreateShipmentBodyType = Static<typeof CreateShipmentBody>;
type UpdateShipmentBodyType = Static<typeof UpdateShipmentBody>;

function getActor(request: FastifyRequest): string {
  return (request.headers['x-actor'] as string) || 'system';
}

function toPlainObject(obj: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(obj));
}

export const shipmentRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/',
    {
      schema: {
        querystring: GetShipmentsQuery,
        response: { 200: ShipmentsResponse },
      },
    },
    async (request) => {
      const query = request.query as GetShipmentsQueryType;
      const where: Record<string, unknown> = {};
      if (query.terminalId) where.terminalId = query.terminalId;
      if (query.priority) where.priority = query.priority;

      return app.prisma.shipment.findMany({
        where,
        include: { terminal: true, stops: true },
        orderBy: { createdAt: 'desc' },
      });
    },
  );

  app.get(
    '/:id',
    {
      schema: {
        params: ShipmentParams,
        response: {
          200: ShipmentResponse,
          404: Type.Object({ message: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      const params = request.params as ShipmentParamsType;
      const shipment = await app.prisma.shipment.findUnique({
        where: { id: params.id },
        include: { terminal: true, stops: true },
      });
      if (!shipment) {
        return reply.code(404).send({ message: 'Shipment not found' });
      }
      return shipment;
    },
  );

  app.post(
    '/',
    {
      schema: {
        body: CreateShipmentBody,
        response: {
          201: ShipmentResponse,
          400: Type.Object({ message: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      const body = request.body as CreateShipmentBodyType;
      const shipment = await app.prisma.shipment.create({
        data: body,
        include: { terminal: true, stops: true },
      });

      // Audit log
      await createAuditLog(app.prisma as PrismaClient, {
        entityType: 'Shipment',
        entityId: shipment.id,
        action: 'CREATE',
        actor: getActor(request),
        priorState: {},
        newState: toPlainObject(shipment),
        reasonCode: 'SHIPMENT_CREATED',
      });

      app.io.emit('shipment:created', shipment);
      return reply.code(201).send(shipment);
    },
  );

  app.put(
    '/:id',
    {
      schema: {
        params: ShipmentParams,
        body: UpdateShipmentBody,
        response: {
          200: ShipmentResponse,
          404: Type.Object({ message: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      const params = request.params as ShipmentParamsType;
      const body = request.body as UpdateShipmentBodyType;

      // Get prior state
      const priorShipment = await app.prisma.shipment.findUnique({
        where: { id: params.id },
        include: { terminal: true, stops: true },
      });

      if (!priorShipment) {
        return reply.code(404).send({ message: 'Shipment not found' });
      }

      const shipment = await app.prisma.shipment
        .update({
          where: { id: params.id },
          data: body,
          include: { terminal: true, stops: true },
        })
        .catch(() => null);

      if (!shipment) {
        return reply.code(404).send({ message: 'Shipment not found' });
      }

      // Audit log
      await createAuditLog(app.prisma as PrismaClient, {
        entityType: 'Shipment',
        entityId: shipment.id,
        action: 'UPDATE',
        actor: getActor(request),
        priorState: toPlainObject(priorShipment),
        newState: toPlainObject(shipment),
        reasonCode: 'SHIPMENT_UPDATED',
      });

      app.io.emit('shipment:updated', shipment);
      return shipment;
    },
  );

  app.delete(
    '/:id',
    {
      schema: {
        params: ShipmentParams,
        response: {
          204: Type.Null(),
          404: Type.Object({ message: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      const params = request.params as ShipmentParamsType;

      // Get prior state for audit
      const priorShipment = await app.prisma.shipment.findUnique({
        where: { id: params.id },
        include: { terminal: true, stops: true },
      });

      if (!priorShipment) {
        return reply.code(404).send({ message: 'Shipment not found' });
      }

      await app.prisma.shipment
        .delete({
          where: { id: params.id },
        })
        .catch(() => null);

      // Audit log
      await createAuditLog(app.prisma as PrismaClient, {
        entityType: 'Shipment',
        entityId: params.id,
        action: 'DELETE',
        actor: getActor(request),
        priorState: toPlainObject(priorShipment),
        newState: {},
        reasonCode: 'SHIPMENT_DELETED',
      });

      app.io.emit('shipment:deleted', { id: params.id });
      return reply.code(204).send();
    },
  );
};
