import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';

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
  hosStatus: Type.Optional(Type.Union([
    Type.Literal('OFF_DUTY'),
    Type.Literal('SLEEPER_BERTH'),
    Type.Literal('DRIVING'),
    Type.Literal('ON_DUTY'),
  ])),
  currentCycleHours: Type.Optional(Type.Number({ minimum: 0 })),
  maxCycleHours: Type.Optional(Type.Number({ minimum: 0 })),
});

const UpdateDriverBody = Type.Partial(CreateDriverBody);

export const driverRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', {
    schema: {
      querystring: Type.Object({
        terminalId: Type.Optional(Type.String({ format: 'uuid' })),
      }),
      response: { 200: DriversResponse },
    },
  }, async (request) => {
    const where = request.query.terminalId ? { terminalId: request.query.terminalId } : {};
    return app.prisma.driver.findMany({
      where,
      include: { terminal: true },
      orderBy: { name: 'asc' },
    });
  });

  app.get('/:id', {
    schema: {
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      response: { 200: DriverResponse, 404: Type.Object({ message: Type.String() }) },
    },
  }, async (request, reply) => {
    const driver = await app.prisma.driver.findUnique({
      where: { id: request.params.id },
      include: { terminal: true },
    });
    if (!driver) {
      return reply.code(404).send({ message: 'Driver not found' });
    }
    return driver;
  });

  app.post('/', {
    schema: {
      body: CreateDriverBody,
      response: { 201: DriverResponse, 400: Type.Object({ message: Type.String() }) },
    },
  }, async (request, reply) => {
    const driver = await app.prisma.driver.create({
      data: request.body,
      include: { terminal: true },
    });
    app.io.emit('driver:created', driver);
    return reply.code(201).send(driver);
  });

  app.put('/:id', {
    schema: {
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      body: UpdateDriverBody,
      response: { 200: DriverResponse, 404: Type.Object({ message: Type.String() }) },
    },
  }, async (request, reply) => {
    const driver = await app.prisma.driver.update({
      where: { id: request.params.id },
      data: request.body,
      include: { terminal: true },
    }).catch(() => null);
    
    if (!driver) {
      return reply.code(404).send({ message: 'Driver not found' });
    }
    
    app.io.emit('driver:updated', driver);
    return driver;
  });

  app.delete('/:id', {
    schema: {
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      response: { 204: Type.Null(), 404: Type.Object({ message: Type.String() }) },
    },
  }, async (request, reply) => {
    await app.prisma.driver.delete({
      where: { id: request.params.id },
    }).catch(() => null);
    
    app.io.emit('driver:deleted', { id: request.params.id });
    return reply.code(204).send();
  });
};
