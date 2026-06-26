/**
 * Lightweight unit tests for execution-sync pure helpers.
 * Run: npm run test --workspace=@logx/api
 */
import assert from 'node:assert/strict';
import { Types } from 'mongoose';

import type { IRoute, IRouteStop } from '../models/Route.model';
import type { IRouteExecution } from '../models/RouteExecution.model';
import {
  collectCompletedStopFingerprints,
  computeDeltaStops,
  stopFingerprint,
} from '../modules/executions/execution-sync.service';

function makeStop(
  clientId: string,
  address: string,
  status = 'PENDING',
  routeStopIndex = 0
) {
  return {
    _id: new Types.ObjectId(),
    routeStopIndex,
    clientId: new Types.ObjectId(clientId.padEnd(24, '0').slice(0, 24)),
    order: routeStopIndex,
    address,
    location: { lat: 0, lng: 0 },
    plannedTime: '08:00',
    expectedDurationMinutes: 15,
    type: 'DELIVERY',
    status,
  };
}

function makeExecution(stops: ReturnType<typeof makeStop>[]): IRouteExecution {
  return {
    _id: new Types.ObjectId(),
    stops,
  } as unknown as IRouteExecution;
}

function makeRoute(
  stops: Array<{ clientId: string; order: number; address: string; plannedTime: string }>
): Pick<IRoute, 'stops'> {
  return {
    stops: stops.map((stop) => ({
      clientId: new Types.ObjectId(stop.clientId.padEnd(24, '0').slice(0, 24)),
      order: stop.order,
      address: stop.address,
      location: { lat: 0, lng: 0 },
      plannedTime: stop.plannedTime,
      expectedDurationMinutes: 15,
      type: 'DELIVERY',
    })) as IRouteStop[],
  };
}

function runTests(): void {
  const a = stopFingerprint('client1', 'Rua A, 100');
  const b = stopFingerprint('client1', 'rua a, 100');
  assert.equal(a, b);

  const executions = [
    makeExecution([
      makeStop('aaaaaaaaaaaaaaaaaaaaaaaa', 'Morning Stop', 'COMPLETED', 0),
      makeStop('bbbbbbbbbbbbbbbbbbbbbbbb', 'Skipped Stop', 'SKIPPED', 1),
    ]),
  ];
  const keys = collectCompletedStopFingerprints(executions);
  assert.equal(keys.size, 1);
  assert.ok(keys.has(stopFingerprint('aaaaaaaaaaaaaaaaaaaaaaaa', 'Morning Stop')));

  const clientA = 'aaaaaaaaaaaaaaaaaaaaaaaa';
  const clientB = 'bbbbbbbbbbbbbbbbbbbbbbbb';
  const clientC = 'cccccccccccccccccccccccc';
  const completedExecutions = [
    makeExecution([makeStop(clientA, 'Stop A', 'COMPLETED', 0)]),
  ];
  const completed = collectCompletedStopFingerprints(completedExecutions);
  const delta = computeDeltaStops(
    makeRoute([
      { clientId: clientA, order: 0, address: 'Stop A', plannedTime: '08:00' },
      { clientId: clientB, order: 1, address: 'Stop B', plannedTime: '09:00' },
      { clientId: clientC, order: 2, address: 'Stop C', plannedTime: '10:00' },
    ]),
    completed
  );
  assert.equal(delta.length, 2);
  assert.equal(delta[0].stop.address, 'Stop B');
  assert.equal(delta[1].stop.address, 'Stop C');

  const allDelta = computeDeltaStops(
    makeRoute([
      { clientId: clientA, order: 0, address: 'Stop A', plannedTime: '08:00' },
      { clientId: clientB, order: 1, address: 'Stop B', plannedTime: '09:00' },
    ]),
    new Set()
  );
  assert.equal(allDelta.length, 2);

  const emptyDelta = computeDeltaStops(
    makeRoute([{ clientId: clientA, order: 0, address: 'Stop A', plannedTime: '08:00' }]),
    completed
  );
  assert.equal(emptyDelta.length, 0);

  console.log('[test-execution-sync] All tests passed');
}

runTests();
