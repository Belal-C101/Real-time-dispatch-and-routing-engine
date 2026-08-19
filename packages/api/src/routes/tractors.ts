import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';

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

export const tractorRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', {
    schema: {
      querystring: Type.Object({
        terminalId: Type.Optional(Type.String({ format: 'uuid' })),
      }),
      response: { 200: TractorsResponse },
    },
  }, async (request) => {
    const where = request.query.terminalId ? { terminalId: request.query.terminalId } : {};
    return app.prisma.tractor.findMany({
      where,
      include: { terminal: true, driver: true },
      orderBy: { createdAt: 'desc' },
    });
  });

  app.get('/:id', {
    schema: {
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      response: { 200: TractorResponse, 404: Type.Object({ message: Type.String() }) },
    },
  }, async (request, reply) => {
    const tractor = await app.prisma.tractor.findUnique({
      where: { id: request.params.id },
      include: { terminal: true, driver: true },
    });
    if (!tractor) {
      return reply.code(404).send({ message: 'Tractor not found' });
    }
    return tractor;
  });

  app.post('/', {
    schema: {
      body: CreateTractorBody,
      response: { 201: TractorResponse, 400: Type.Object({ message: Type.String() }) },
    },
  }, async (request, reply) => {
    const tractor = await app.prisma.tractor.create({
      data: request.body,
      include: { terminal: true, driver: true },
    });
    app.io.emit('tractor:created', tractor);
    return reply.code(201).send(tractor);
  });

  app.put('/:id', {
    schema: {
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      body: UpdateTractorBody,
      response: { 200: TractorResponse, 404: Type.Object({ message: Type.String() }) },
    },
  }, async (request, reply) => {
    const tractor = await app.prisma.tractor.update({
      where: { id: request.params.id },
      data: request.body,
      include: { terminal: true, driver: true },
    }).catch(() => null);
    
    if (!tractor) {
      return reply.code(404).send({ message: 'Tractor not found' });
    }
    
    app.io.emit('tractor:updated', tractor);
    return tractor;
  });

  app.delete('/:id', {
    schema: {
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      response: { 204: Type.Null(), 404: Type.Object({ message: Type.String() }) },
    },
  }, async (request, reply) => {
    await app.prisma.tractor.delete({
      where: { id: request.params.id },
    }).catch(() => null);
    
    app.io.emit('tractor:deleted', { id: request.params.id });
    return reply.code(204).send();
  });
};
