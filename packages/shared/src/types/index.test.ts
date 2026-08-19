import { describe, it, expect } from 'vitest';
import type {
  Terminal,
  Tractor,
  Driver,
  Shipment,
  Stop,
  Route,
  Assignment,
  AuditLog,
  HOSStatus,
  StopStatus,
  RouteStatus,
} from './index';

describe('Domain Types', () => {
  it('should create a valid Terminal object', () => {
    const terminal: Terminal = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Terminal A',
      location: {
        latitude: 40.7128,
        longitude: -74.0060,
      },
      timezone: 'America/New_York',
    };
    expect(terminal.name).toBe('Terminal A');
  });

  it('should create a valid Tractor object', () => {
    const tractor: Tractor = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      terminalId: '123e4567-e89b-12d3-a456-426614174000',
      driverId: '123e4567-e89b-12d3-a456-426614174000',
      vin: '1HGBH41JXMN109186',
      make: 'Volvo',
      model: 'VNL64T',
      year: 2023,
    };
    expect(tractor.make).toBe('Volvo');
  });

  it('should create a valid Driver object', () => {
    const driver: Driver = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'John Doe',
      employeeId: 'DRV001',
      hosStatus: 'OFF_DUTY' as HOSStatus,
      currentCycleHours: 0,
      maxCycleHours: 70,
    };
    expect(driver.name).toBe('John Doe');
  });

  it('should create a valid Shipment object', () => {
    const shipment: Shipment = {
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
    expect(shipment.priority).toBe('HIGH');
  });

  it('should create a valid Stop object', () => {
    const stop: Stop = {
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
      status: 'PENDING' as StopStatus,
    };
    expect(stop.type).toBe('PICKUP');
  });

  it('should create a valid Route object', () => {
    const route: Route = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      tractorId: '123e4567-e89b-12d3-a456-426614174000',
      driverId: '123e4567-e89b-12d3-a456-426614174000',
      terminalId: '123e4567-e89b-12d3-a456-426614174000',
      stops: [],
      totalDistanceMiles: 150.5,
      totalDurationMinutes: 300,
      estimatedStartTime: new Date('2023-01-01T08:00:00Z'),
      estimatedEndTime: new Date('2023-01-01T13:00:00Z'),
      status: 'DRAFT' as RouteStatus,
    };
    expect(route.status).toBe('DRAFT');
  });

  it('should create a valid Assignment object', () => {
    const assignment: Assignment = {
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
    expect(assignment.sequence).toBe(1);
  });

  it('should create a valid AuditLog object', () => {
    const auditLog: AuditLog = {
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
    expect(auditLog.action).toBe('CREATE');
  });
});
