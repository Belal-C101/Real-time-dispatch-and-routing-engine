// Core domain types

export interface Terminal {
  id: string;
  name: string;
  location: {
    latitude: number;
    longitude: number;
  };
  timezone: string;
}

export interface Tractor {
  id: string;
  terminalId: string;
  driverId: string;
  vin: string;
  make: string;
  model: string;
  year: number;
}

export interface Driver {
  id: string;
  name: string;
  employeeId: string;
  hosStatus: HOSStatus;
  currentCycleHours: number;
  maxCycleHours: number;
}

export type HOSStatus = 'OFF_DUTY' | 'SLEEPER_BERTH' | 'DRIVING' | 'ON_DUTY';

export interface Shipment {
  id: string;
  terminalId: string;
  origin: StopLocation;
  destination: StopLocation;
  pickupWindow: TimeWindow;
  deliveryWindow: TimeWindow;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  serviceTimeMinutes: number;
  weightLbs: number;
  volumeCubicFt: number;
  rated: boolean;
  billingFields: Record<string, unknown>;
}

export interface StopLocation {
  address: string;
  latitude: number;
  longitude: number;
}

export interface TimeWindow {
  start: Date;
  end: Date;
}

export interface Stop {
  id: string;
  shipmentId: string;
  sequence: number;
  type: 'PICKUP' | 'DELIVERY';
  location: StopLocation;
  timeWindow: TimeWindow;
  serviceTimeMinutes: number;
  status: StopStatus;
}

export type StopStatus = 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface Route {
  id: string;
  tractorId: string;
  driverId: string;
  terminalId: string;
  stops: Stop[];
  totalDistanceMiles: number;
  totalDurationMinutes: number;
  estimatedStartTime: Date;
  estimatedEndTime: Date;
  status: RouteStatus;
}

export type RouteStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface Assignment {
  id: string;
  routeId: string;
  stopId: string;
  tractorId: string;
  driverId: string;
  sequence: number;
  assignedAt: Date;
  assignedBy: string;
  reasonCode: string;
}

export interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actor: string;
  timestamp: Date;
  priorState: Record<string, unknown>;
  newState: Record<string, unknown>;
  reasonCode: string;
}
