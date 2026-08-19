import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';
import { createAuditLog } from '../utils/audit.js';
import type { PrismaClient } from '@prisma/client';

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

const GetAssignmentsQuery = Type.Object({
  routeId: Type.Optional(Type.String({ format: 'uuid' })),
  stopId: Type.Optional(Type.String({ format: 'uuid' })),
  tractorId: Type.Optional(Type.String({ format: 'uuid' })),
  driverId: Type.Optional(Type.String({ format: 'uuid' })),
});

const AssignmentParams = Type.Object({ id: Type.String({ format: 'uuid' }) });

type GetAssignmentsQueryType = Static<typeof GetAssignmentsQuery>;
type AssignmentParamsType = Static<typeof AssignmentParams>;
type CreateAssignmentBodyType = Static<typeof CreateAssignmentBody>;

function getActor(request: FastifyRequest): string {
  return (request.headers['x-actor'] as string) || 'system';
}

function toPlainObject(obj: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(obj));
}

export const assignmentRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/',
    {
      schema: {
        querystring: GetAssignmentsQuery,
        response: { 200: AssignmentsResponse },
      },
    },
    async (request) => {
      const query = request.query as GetAssignmentsQueryType;
      const where: Record<string, unknown> = {};
      if (query.routeId) where.routeId = query.routeId;
      if (query.stopId) where.stopId = query.stopId;
      if (query.tractorId) where.tractorId = query.tractorId;
      if (query.driverId) where.driverId = query.driverId;

      return app.prisma.assignment.findMany({
        where,
        include: { route: true, stop: true },
        orderBy: { assignedAt: 'desc' },
      });
    },
  );

  app.get(
    '/:id',
    {
      schema: {
        params: AssignmentParams,
        response: {
          200: AssignmentResponse,
          404: Type.Object({ message: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      const params = request.params as AssignmentParamsType;
      const assignment = await app.prisma.assignment.findUnique({
        where: { id: params.id },
        include: { route: true, stop: true },
      });
      if (!assignment) {
        return reply.code(404).send({ message: 'Assignment not found' });
      }
      return assignment;
    },
  );

  app.post(
    '/',
    {
      schema: {
        body: CreateAssignmentBody,
        response: {
          201: AssignmentResponse,
          400: Type.Object({ message: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      const body = request.body as CreateAssignmentBodyType;
      const assignment = await app.prisma.assignment.create({
        data: {
          ...body,
          assignedAt: new Date(),
        },
        include: { route: true, stop: true },
      });

      // Update stop status to ASSIGNED
      await app.prisma.stop.update({
        where: { id: body.stopId },
        data: { status: 'ASSIGNED' },
      });

      // Audit log for assignment creation
      await createAuditLog(app.prisma as PrismaClient, {
        entityType: 'Assignment',
        entityId: assignment.id,
        action: 'CREATE',
        actor: getActor(request),
        priorState: {},
        newState: toPlainObject(assignment),
        reasonCode: body.reasonCode || 'ASSIGNMENT_CREATED',
      });

      // Audit log for stop status change
      await createAuditLog(app.prisma as PrismaClient, {
        entityType: 'Stop',
        entityId: body.stopId,
        action: 'UPDATE',
        actor: getActor(request),
        priorState: { status: 'PENDING' },
        newState: { status: 'ASSIGNED' },
        reasonCode: body.reasonCode || 'STOP_ASSIGNED',
      });

      app.io.emit('assignment:created', assignment);
      return reply.code(201).send(assignment);
    },
  );

  app.delete(
    '/:id',
    {
      schema: {
        params: AssignmentParams,
        response: {
          204: Type.Null(),
          404: Type.Object({ message: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      const params = request.params as AssignmentParamsType;
      const assignment = await app.prisma.assignment.findUnique({
        where: { id: params.id },
      });

      if (!assignment) {
        return reply.code(404).send({ message: 'Assignment not found' });
      }

      const stopId = assignment.stopId;

      await app.prisma.assignment.delete({
        where: { id: params.id },
      });

      // Check if stop has other assignments
      const otherAssignments = await app.prisma.assignment.count({
        where: { stopId },
      });

      if (otherAssignments === 0) {
        await app.prisma.stop.update({
          where: { id: stopId },
          data: { status: 'PENDING' },
        });

        // Audit log for stop status change back to PENDING
        await createAuditLog(app.prisma as PrismaClient, {
          entityType: 'Stop',
          entityId: stopId,
          action: 'UPDATE',
          actor: getActor(request),
          priorState: { status: 'ASSIGNED' },
          newState: { status: 'PENDING' },
          reasonCode: 'STOP_UNASSIGNED',
        });
      }

      // Audit log for assignment deletion
      await createAuditLog(app.prisma as PrismaClient, {
        entityType: 'Assignment',
        entityId: params.id,
        action: 'DELETE',
        actor: getActor(request),
        priorState: toPlainObject(assignment),
        newState: {},
        reasonCode: 'ASSIGNMENT_DELETED',
      });

      app.io.emit('assignment:deleted', { id: params.id });
      return reply.code(204).send();
    },
  );
};
