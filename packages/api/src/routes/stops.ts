import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';

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

export const stopRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', {
    schema: {
      querystring: Type.Object({
        shipmentId: Type.Optional(Type.String({ format: 'uuid' })),
        status: Type.Optional(Type.Union([
          Type.Literal('PENDING'),
          Type.Literal('ASSIGNED'),
          Type.Literal('IN_PROGRESS'),
          Type.Literal('COMPLETED'),
          Type.Literal('CANCELLED'),
        ])),
      }),
      response: { 200: StopsResponse },
    },
  }, async (request) => {
    const where: Record<string, unknown> = {};
    if (request.query.shipmentId) where.shipmentId = request.query.shipmentId;
    if (request.query.status) where.status = request.query.status;
    
    return app.prisma.stop.findMany({
      where,
      include: { shipment: true },
      orderBy: { sequence: 'asc' },
    });
  });

  app.get('/:id', {
    schema: {
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      response: { 200: StopResponse, 404: Type.Object({ message: Type.String() }) },
    },
  }, async (request, reply) => {
    const stop = await app.prisma.stop.findUnique({
      where: { id: request.params.id },
      include: { shipment: true, assignments: true },
    });
    if (!stop) {
      return reply.code(404).send({ message: 'Stop not found' });
    }
    return stop;
  });

  app.post('/', {
    schema: {
      body: CreateStopBody,
      response: { 201: StopResponse, 400: Type.Object({ message: Type.String() }) },
    },
  }, async (request, reply) => {
    const stop = await app.prisma.stop.create({
      data: request.body,
      include: { shipment: true },
    });
    app.io.emit('stop:created', stop);
    return reply.code(201).send(stop);
  });

  app.put('/:id', {
    schema: {
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      body: UpdateStopBody,
      response: { 200: StopResponse, 404: Type.Object({ message: Type.String() }) },
    },
  }, async (request, reply) => {
    const stop = await app.prisma.stop.update({
      where: { id: request.params.id },
      data: request.body,
      include: { shipment: true },
    }).catch(() => null);
    
    if (!stop) {
      return reply.code(404).send({ message: 'Stop not found' });
    }
    
    app.io.emit('stop:updated', stop);
    return stop;
  });

  app.delete('/:id', {
    schema: {
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      response: { 204: Type.Null(), 404: Type.Object({ message: Type.String() }) },
    },
  }, async (request, reply) => {
    await app.prisma.stop.delete({
      where: { id: request.params.id },
    }).catch(() => null);
    
    app.io.emit('stop:deleted', { id: request.params.id });
    return reply.code(204).send();
  });
};
