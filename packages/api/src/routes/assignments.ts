import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';

const AssignmentResponse = Type.Object({
  id: Type.String({ format: 'uuid' }),
  routeId: Type.String({ format: 'uuid' }),
  stopId: Type.String({ format: 'uuid' }),
  tractorId: Type.String({ format: 'uuid' }),
  driverId: Type.String({ format: 'uuid' }),
  sequence: Type.Number(),
  assignedAt: Type.String({ format: 'date-time' }),
  assignedBy: Type.String(),
  reasonCode: Type.String(),
  createdAt: Type.String({ format: 'date-time' }),
});

const AssignmentsResponse = Type.Array(AssignmentResponse);

const CreateAssignmentBody = Type.Object({
  routeId: Type.String({ format: 'uuid' }),
  stopId: Type.String({ format: 'uuid' }),
  tractorId: Type.String({ format: 'uuid' }),
  driverId: Type.String({ format: 'uuid' }),
  sequence: Type.Number({ minimum: 0 }),
  assignedBy: Type.String(),
  reasonCode: Type.String(),
});

export const assignmentRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', {
    schema: {
      querystring: Type.Object({
        routeId: Type.Optional(Type.String({ format: 'uuid' })),
        stopId: Type.Optional(Type.String({ format: 'uuid' })),
        tractorId: Type.Optional(Type.String({ format: 'uuid' })),
        driverId: Type.Optional(Type.String({ format: 'uuid' })),
      }),
      response: { 200: AssignmentsResponse },
    },
  }, async (request) => {
    const where: Record<string, unknown> = {};
    if (request.query.routeId) where.routeId = request.query.routeId;
    if (request.query.stopId) where.stopId = request.query.stopId;
    if (request.query.tractorId) where.tractorId = request.query.tractorId;
    if (request.query.driverId) where.driverId = request.query.driverId;
    
    return app.prisma.assignment.findMany({
      where,
      include: { route: true, stop: true },
      orderBy: { assignedAt: 'desc' },
    });
  });

  app.get('/:id', {
    schema: {
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      response: { 200: AssignmentResponse, 404: Type.Object({ message: Type.String() }) },
    },
  }, async (request, reply) => {
    const assignment = await app.prisma.assignment.findUnique({
      where: { id: request.params.id },
      include: { route: true, stop: true },
    });
    if (!assignment) {
      return reply.code(404).send({ message: 'Assignment not found' });
    }
    return assignment;
  });

  app.post('/', {
    schema: {
      body: CreateAssignmentBody,
      response: { 201: AssignmentResponse, 400: Type.Object({ message: Type.String() }) },
    },
  }, async (request, reply) => {
    const assignment = await app.prisma.assignment.create({
      data: {
        ...request.body,
        assignedAt: new Date(),
      },
      include: { route: true, stop: true },
    });
    
    // Update stop status to ASSIGNED
    await app.prisma.stop.update({
      where: { id: request.body.stopId },
      data: { status: 'ASSIGNED' },
    });
    
    app.io.emit('assignment:created', assignment);
    return reply.code(201).send(assignment);
  });

  app.delete('/:id', {
    schema: {
      params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
      response: { 204: Type.Null(), 404: Type.Object({ message: Type.String() }) },
    },
  }, async (request, reply) => {
    const assignment = await app.prisma.assignment.findUnique({
      where: { id: request.params.id },
    });
    
    if (!assignment) {
      return reply.code(404).send({ message: 'Assignment not found' });
    }
    
    await app.prisma.assignment.delete({
      where: { id: request.params.id },
    });
    
    // Check if stop has other assignments
    const otherAssignments = await app.prisma.assignment.count({
      where: { stopId: assignment.stopId },
    });
    
    if (otherAssignments === 0) {
      await app.prisma.stop.update({
        where: { id: assignment.stopId },
        data: { status: 'PENDING' },
      });
    }
    
    app.io.emit('assignment:deleted', { id: request.params.id });
    return reply.code(204).send();
  });
};
