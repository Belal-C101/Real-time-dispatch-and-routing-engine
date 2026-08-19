import { z } from 'zod';

// Zod schemas for input validation

export const TerminalSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  timezone: z.string(),
});

export const TractorSchema = z.object({
  id: z.string().uuid(),
  terminalId: z.string().uuid(),
  driverId: z.string().uuid(),
  vin: z.string().length(17),
  make: z.string(),
  model: z.string(),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 1),
});

export const DriverSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  employeeId: z.string(),
  hosStatus: z.enum(['OFF_DUTY', 'SLEEPER_BERTH', 'DRIVING', 'ON_DUTY']),
  currentCycleHours: z.number().min(0),
  maxCycleHours: z.number().min(0),
});

export const ShipmentSchema = z.object({
  id: z.string().uuid(),
  terminalId: z.string().uuid(),
  origin: z.object({
    address: z.string(),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  destination: z.object({
    address: z.string(),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  pickupWindow: z.object({
    start: z.date(),
    end: z.date(),
  }),
  deliveryWindow: z.object({
    start: z.date(),
    end: z.date(),
  }),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  serviceTimeMinutes: z.number().int().min(0),
  weightLbs: z.number().min(0),
  volumeCubicFt: z.number().min(0),
  rated: z.boolean(),
  billingFields: z.record(z.unknown()),
});

export const StopSchema = z.object({
  id: z.string().uuid(),
  shipmentId: z.string().uuid(),
  sequence: z.number().int().min(0),
  type: z.enum(['PICKUP', 'DELIVERY']),
  location: z.object({
    address: z.string(),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  timeWindow: z.object({
    start: z.date(),
    end: z.date(),
  }),
  serviceTimeMinutes: z.number().int().min(0),
  status: z.enum(['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
});

export const RouteSchema = z.object({
  id: z.string().uuid(),
  tractorId: z.string().uuid(),
  driverId: z.string().uuid(),
  terminalId: z.string().uuid(),
  stops: z.array(StopSchema),
  totalDistanceMiles: z.number().min(0),
  totalDurationMinutes: z.number().min(0),
  estimatedStartTime: z.date(),
  estimatedEndTime: z.date(),
  status: z.enum(['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED']),
});

export const AssignmentSchema = z.object({
  id: z.string().uuid(),
  routeId: z.string().uuid(),
  stopId: z.string().uuid(),
  tractorId: z.string().uuid(),
  driverId: z.string().uuid(),
  sequence: z.number().int().min(0),
  assignedAt: z.date(),
  assignedBy: z.string(),
  reasonCode: z.string(),
});

export const AuditLogSchema = z.object({
  id: z.string().uuid(),
  entityType: z.string(),
  entityId: z.string().uuid(),
  action: z.string(),
  actor: z.string(),
  timestamp: z.date(),
  priorState: z.record(z.unknown()),
  newState: z.record(z.unknown()),
  reasonCode: z.string(),
});
