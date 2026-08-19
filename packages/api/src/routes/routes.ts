import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';

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
  status: Type.Optional(Type.Union([
    Type.Literal('DRAFT'),
    Type.Literal('ACTIVE'),
    Type.Literal('COMPLETED'),
    Type.Literal('CANCELLED'),
  ])),
});

const UpdateRouteBody = Type.Partial(CreateRouteBody);

export const routeRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', {
    schema: {
      querystring: Type.Object({
        terminalId: Type.Optional(Type.String({ format: 'uuid' })),
        tractorId: Type.Optional(Type.String({ format: 'uuid' })),
        driverId: Type.Optional(Type.String({ format: 'uuid' })),
        status: Type.Optional(Type.Union([
          Type.Literal('DRAFT'),
          Type.Literal('ACTIVE'),
          Type.Literal('COMPLETED'),
          Type.Literal('CANCELLED'),
        ])),
      }),
      response: { 200: RoutesResponse },
    },
  }, async (request) => {
    const where: Record<string, unknown> = {};
    if (request.query.terminalId) where.terminalId = request.query.terminalId;
    if (request.query.tractorId) where.tractorId = request.query.tractorId;
    if (request.query.driverId) where.driverId = request.query.driverId;
    if (request.query.status) where.status = request.query.status;
    
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
  });

  app.get('/:id', {
    schema: {
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      response: { 200: RouteResponse, 404: Type.Object({ message: Type.String() }) },
    },
  }, async (request, reply) => {
    const route = await app.prisma.route.findUnique({
      where: { id: request.params.id },
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
  });

  app.post('/', {
    schema: {
      body: CreateRouteBody,
      response: { 201: RouteResponse, 400: Type.Object({ message: Type.String() }) },
    },
  }, async (request, reply) => {
    const route = await app.prisma.route.create({
      data: request.body,
      include: { 
        tractor: true, 
        driver: true, 
        terminal: true,
        stops: true,
        assignments: true,
      },
    });
    app.io.emit('route:created', route);
    return reply.code(201).send(route);
  });

  app.put('/:id', {
    schema: {
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      body: UpdateRouteBody,
      response: { 200: RouteResponse, 404: Type.Object({ message: Type.String() }) },
    },
  }, async (request, reply) => {
    const route = await app.prisma.route.update({
      where: { id: request.params.id },
      data: request.body,
      include: { 
        tractor: true, 
        driver: true, 
        terminal: true,
        stops: true,
        assignments: true,
      },
    }).catch(() => null);
    
    if (!route) {
      return reply.code(404).send({ message: 'Route not found' });
    }
    
    app.io.emit('route:updated', route);
    return route;
  });

  app.delete('/:id', {
    schema: {
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      response: { 204: Type.Null(), 404: Type.Object({ message: Type.String() }) },
    },
  }, async (request, reply) => {
    await app.prisma.route.delete({
      where: { id: request.params.id },
    }).catch(() => null);
    
    app.io.emit('route:deleted', { id: request.params.id });
    return reply.code(204).send();
  });
};
