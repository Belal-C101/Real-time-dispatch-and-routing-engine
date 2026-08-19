import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';

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
  priority: Type.Union([Type.Literal('HIGH'), Type.Literal('MEDIUM'), Type.Literal('LOW')]),
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
  priority: Type.Optional(Type.Union([Type.Literal('HIGH'), Type.Literal('MEDIUM'), Type.Literal('LOW')])),
  serviceTimeMinutes: Type.Number({ minimum: 0 }),
  weightLbs: Type.Number({ minimum: 0 }),
  volumeCubicFt: Type.Number({ minimum: 0 }),
  rated: Type.Optional(Type.Boolean()),
  billingFields: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

const UpdateShipmentBody = Type.Partial(CreateShipmentBody);

export const shipmentRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', {
    schema: {
      querystring: Type.Object({
        terminalId: Type.Optional(Type.String({ format: 'uuid' })),
        priority: Type.Optional(Type.Union([Type.Literal('HIGH'), Type.Literal('MEDIUM'), Type.Literal('LOW')])),
      }),
      response: { 200: ShipmentsResponse },
    },
  }, async (request) => {
    const where: Record<string, unknown> = {};
    if (request.query.terminalId) where.terminalId = request.query.terminalId;
    if (request.query.priority) where.priority = request.query.priority;
    
    return app.prisma.shipment.findMany({
      where,
      include: { terminal: true, stops: true },
      orderBy: { createdAt: 'desc' },
    });
  });

  app.get('/:id', {
    schema: {
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      response: { 200: ShipmentResponse, 404: Type.Object({ message: Type.String() }) },
    },
  }, async (request, reply) => {
    const shipment = await app.prisma.shipment.findUnique({
      where: { id: request.params.id },
      include: { terminal: true, stops: true },
    });
    if (!shipment) {
      return reply.code(404).send({ message: 'Shipment not found' });
    }
    return shipment;
  });

  app.post('/', {
    schema: {
      body: CreateShipmentBody,
      response: { 201: ShipmentResponse, 400: Type.Object({ message: Type.String() }) },
    },
  }, async (request, reply) => {
    const shipment = await app.prisma.shipment.create({
      data: request.body,
      include: { terminal: true, stops: true },
    });
    app.io.emit('shipment:created', shipment);
    return reply.code(201).send(shipment);
  });

  app.put('/:id', {
    schema: {
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      body: UpdateShipmentBody,
      response: { 200: ShipmentResponse, 404: Type.Object({ message: Type.String() }) },
    },
  }, async (request, reply) => {
    const shipment = await app.prisma.shipment.update({
      where: { id: request.params.id },
      data: request.body,
      include: { terminal: true, stops: true },
    }).catch(() => null);
    
    if (!shipment) {
      return reply.code(404).send({ message: 'Shipment not found' });
    }
    
    app.io.emit('shipment:updated', shipment);
    return shipment;
  });

  app.delete('/:id', {
    schema: {
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      response: { 204: Type.Null(), 404: Type.Object({ message: Type.String() }) },
    },
  }, async (request, reply) => {
    await app.prisma.shipment.delete({
      where: { id: request.params.id },
    }).catch(() => null);
    
    app.io.emit('shipment:deleted', { id: request.params.id });
    return reply.code(204).send();
  });
};
