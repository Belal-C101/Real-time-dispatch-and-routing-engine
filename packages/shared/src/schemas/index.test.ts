import { describe, it, expect } from 'vitest';
import {
  TerminalSchema,
  TractorSchema,
  DriverSchema,
  ShipmentSchema,
  StopSchema,
  RouteSchema,
  AssignmentSchema,
  AuditLogSchema,
} from './index';

describe('Zod Schemas', () => {
  it('should validate a valid Terminal', () => {
    const validTerminal = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Terminal A',
      location: {
        latitude: 40.7128,
        longitude: -74.0060,
      },
      timezone: 'America/New_York',
    };
    const result = TerminalSchema.safeParse(validTerminal);
    expect(result.success).toBe(true);
  });

  it('should reject an invalid Terminal with bad coordinates', () => {
    const invalidTerminal = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Terminal A',
      location: {
        latitude: 91, // Invalid - out of range
        longitude: -74.0060,
      },
      timezone: 'America/New_York',
    };
    const result = TerminalSchema.safeParse(invalidTerminal);
    expect(result.success).toBe(false);
  });

  it('should validate a valid Tractor', () => {
    const validTractor = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      terminalId: '123e4567-e89b-12d3-a456-426614174000',
      driverId: '123e4567-e89b-12d3-a456-426614174000',
      vin: '1HGBH41JXMN109186',
      make: 'Volvo',
      model: 'VNL64T',
      year: 2023,
    };
    const result = TractorSchema.safeParse(validTractor);
    expect(result.success).toBe(true);
  });

  it('should reject a Tractor with invalid VIN length', () => {
    const invalidTractor = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      terminalId: '123e4567-e89b-12d3-a456-426614174000',
      driverId: '123e4567-e89b-12d3-a456-426614174000',
      vin: 'SHORT', // Invalid - not 17 chars
      make: 'Volvo',
      model: 'VNL64T',
      year: 2023,
    };
    const result = TractorSchema.safeParse(invalidTractor);
    expect(result.success).toBe(false);
  });

  it('should validate a valid Driver', () => {
    const validDriver = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'John Doe',
      employeeId: 'DRV001',
      hosStatus: 'OFF_DUTY',
      currentCycleHours: 0,
      maxCycleHours: 70,
    };
    const result = DriverSchema.safeParse(validDriver);
    expect(result.success).toBe(true);
  });

  it('should reject a Driver with invalid HOS status', () => {
    const invalidDriver = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'John Doe',
      employeeId: 'DRV001',
      hosStatus: 'INVALID_STATUS', // Invalid
      currentCycleHours: 0,
      maxCycleHours: 70,
    };
    const result = DriverSchema.safeParse(invalidDriver);
    expect(result.success).toBe(false);
  });

  it('should validate a valid Shipment', () => {
    const validShipment = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      terminalId: '123e4567-e89b-12d3-a456-426614174000',
      origin: {
        address: '123 Main St',
        latitude: 40.7128,
        longitude: -74.0060,
      },
      destination: {
        address: '456 Oak Ave',
        latitude: 40.7589,
        longitude: -73.9851,
      },
      pickupWindow: {
        start: new Date('2023-01-01T08:00:00Z'),
        end: new Date('2023-01-01T10:00:00Z'),
      },
      deliveryWindow: {
        start: new Date('2023-01-01T12:00:00Z'),
        end: new Date('2023-01-01T14:00:00Z'),
      },
      priority: 'HIGH',
      serviceTimeMinutes: 30,
      weightLbs: 1500,
      volumeCubicFt: 100,
      rated: false,
      billingFields: {},
    };
    const result = ShipmentSchema.safeParse(validShipment);
    expect(result.success).toBe(true);
  });

  it('should reject a Shipment with invalid priority', () => {
    const invalidShipment = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      terminalId: '123e4567-e89b-12d3-a456-426614174000',
      origin: {
        address: '123 Main St',
        latitude: 40.7128,
        longitude: -74.0060,
      },
      destination: {
        address: '456 Oak Ave',
        latitude: 40.7589,
        longitude: -73.9851,
      },
      pickupWindow: {
        start: new Date('2023-01-01T08:00:00Z'),
        end: new Date('2023-01-01T10:00:00Z'),
      },
      deliveryWindow: {
        start: new Date('2023-01-01T12:00:00Z'),
        end: new Date('2023-01-01T14:00:00Z'),
      },
      priority: 'INVALID', // Invalid
      serviceTimeMinutes: 30,
      weightLbs: 1500,
      volumeCubicFt: 100,
      rated: false,
      billingFields: {},
    };
    const result = ShipmentSchema.safeParse(invalidShipment);
    expect(result.success).toBe(false);
  });

  it('should validate a valid Stop', () => {
    const validStop = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      shipmentId: '123e4567-e89b-12d3-a456-426614174000',
      sequence: 1,
      type: 'PICKUP',
      location: {
        address: '123 Main St',
        latitude: 40.7128,
        longitude: -74.0060,
      },
      timeWindow: {
        start: new Date('2023-01-01T08:00:00Z'),
        end: new Date('2023-01-01T10:00:00Z'),
      },
      serviceTimeMinutes: 30,
      status: 'PENDING',
    };
    const result = StopSchema.safeParse(validStop);
    expect(result.success).toBe(true);
  });

  it('should reject a Stop with invalid type', () => {
    const invalidStop = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      shipmentId: '123e4567-e89b-12d3-a456-426614174000',
      sequence: 1,
      type: 'INVALID', // Invalid
      location: {
        address: '123 Main St',
        latitude: 40.7128,
        longitude: -74.0060,
      },
      timeWindow: {
        start: new Date('2023-01-01T08:00:00Z'),
        end: new Date('2023-01-01T10:00:00Z'),
      },
      serviceTimeMinutes: 30,
      status: 'PENDING',
    };
    const result = StopSchema.safeParse(invalidStop);
    expect(result.success).toBe(false);
  });

  it('should validate a valid Route', () => {
    const validRoute = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      tractorId: '123e4567-e89b-12d3-a456-426614174000',
      driverId: '123e4567-e89b-12d3-a456-426614174000',
      terminalId: '123e4567-e89b-12d3-a456-426614174000',
      stops: [],
      totalDistanceMiles: 150.5,
      totalDurationMinutes: 300,
      estimatedStartTime: new Date('2023-01-01T08:00:00Z'),
      estimatedEndTime: new Date('2023-01-01T13:00:00Z'),
      status: 'DRAFT',
    };
    const result = RouteSchema.safeParse(validRoute);
    expect(result.success).toBe(true);
  });

  it('should validate a valid Assignment', () => {
    const validAssignment = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      routeId: '123e4567-e89b-12d3-a456-426614174000',
      stopId: '123e4567-e89b-12d3-a456-426614174000',
      tractorId: '123e4567-e89b-12d3-a456-426614174000',
      driverId: '123e4567-e89b-12d3-a456-426614174000',
      sequence: 1,
      assignedAt: new Date('2023-01-01T07:00:00Z'),
      assignedBy: 'dispatcher1',
      reasonCode: 'INITIAL_ASSIGNMENT',
    };
    const result = AssignmentSchema.safeParse(validAssignment);
    expect(result.success).toBe(true);
  });

  it('should validate a valid AuditLog', () => {
    const validAuditLog = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      entityType: 'Route',
      entityId: '123e4567-e89b-12d3-a456-426614174000',
      action: 'CREATE',
      actor: 'dispatcher1',
      timestamp: new Date('2023-01-01T07:00:00Z'),
      priorState: {},
      newState: { status: 'DRAFT' },
      reasonCode: 'INITIAL_PLAN',
    };
    const result = AuditLogSchema.safeParse(validAuditLog);
    expect(result.success).toBe(true);
  });
});
