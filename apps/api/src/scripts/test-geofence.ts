/**
 * Unit tests for sequential geofence guards.
 * Run: npm run test:geofence --workspace=@logx/api
 */
import assert from 'node:assert/strict';

import {
  findGeofenceEligibleStop,
  isValidStopCoordinates,
  shouldTriggerGeofenceArrival,
} from '../modules/tracking/geofence.service';

function makeStop(order: number, status: string, lat: number, lng: number) {
  return {
    _id: `stop-${order}`,
    order,
    status,
    location: { lat, lng },
  };
}

function runTests(): void {
  assert.equal(isValidStopCoordinates(0, 0), false);
  assert.equal(isValidStopCoordinates(-19.82, -40.27), true);

  const routeStops = [
    makeStop(0, 'ON_THE_WAY', -19.82, -40.27),
    makeStop(1, 'PENDING', -20.25, -40.28),
    makeStop(2, 'PENDING', -20.12, -40.31),
    makeStop(3, 'PENDING', -20.09, -40.17),
  ];

  assert.equal(findGeofenceEligibleStop(routeStops)?._id, 'stop-0');

  const nearStop4 = shouldTriggerGeofenceArrival(routeStops[3], {
    lat: -20.09,
    lng: -40.17,
    accuracy: 10,
    speed: 0,
  });
  assert.equal(nearStop4.trigger, false, 'Stop 4 must not auto-arrive while Stop 0 is ON_THE_WAY');

  const nearStop1 = shouldTriggerGeofenceArrival(routeStops[0], {
    lat: -19.8201,
    lng: -40.2701,
    accuracy: 12,
    speed: 0,
  });
  assert.equal(nearStop1.trigger, true, 'Stop 1 should auto-arrive when ON_THE_WAY and within radius');

  const badAccuracy = shouldTriggerGeofenceArrival(routeStops[0], {
    lat: -19.8201,
    lng: -40.2701,
    accuracy: 120,
    speed: 0,
  });
  assert.equal(badAccuracy.trigger, false, 'Low-accuracy GPS must not trigger geofence');

  const fastDriveBy = shouldTriggerGeofenceArrival(routeStops[0], {
    lat: -19.8201,
    lng: -40.2701,
    accuracy: 10,
    speed: 15,
  });
  assert.equal(fastDriveBy.trigger, false, 'High speed must not trigger geofence');

  const invalidCoords = shouldTriggerGeofenceArrival(makeStop(0, 'ON_THE_WAY', 0, 0), {
    lat: -19.82,
    lng: -40.27,
    accuracy: 10,
  });
  assert.equal(invalidCoords.trigger, false, 'Invalid stop coordinates must not trigger geofence');

  console.log('[test-geofence] All tests passed');
}

runTests();
