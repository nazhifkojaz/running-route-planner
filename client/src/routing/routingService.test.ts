import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LonLat } from '../types';
import { RoutingService } from './routingService';

function osrmResponse(coordinates: LonLat[], distance: number): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      routes: [
        {
          geometry: { coordinates },
          distance,
          duration: distance / 3,
        },
      ],
    }),
  } as Response;
}

function createService(): RoutingService {
  const orsKeyInput = document.createElement('input');
  const engineOSRM = document.createElement('input');
  const engineORS = document.createElement('input');
  const engineNote = document.createElement('p');

  engineOSRM.type = 'radio';
  engineOSRM.checked = true;
  engineORS.type = 'radio';

  return new RoutingService(orsKeyInput, engineOSRM, engineORS, engineNote);
}

describe('RoutingService road running', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the reversed OSRM segment when it scores better for road running', async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      const requestUrl = String(url);

      if (requestUrl.includes('/0,0;1,0?')) {
        return osrmResponse(
          [
            [0, 0],
            [0, 1],
            [1, 1],
            [1, 0],
          ],
          4000,
        );
      }

      if (requestUrl.includes('/1,0;0,0?')) {
        return osrmResponse(
          [
            [1, 0],
            [0.5, 0],
            [0, 0],
          ],
          1000,
        );
      }

      throw new Error(`Unexpected URL: ${requestUrl}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await createService().osrmRoadRunning([
      [0, 0],
      [1, 0],
    ]);

    expect(result.distance).toBe(1000);
    expect(result.geometry).toEqual([
      [0, 0],
      [0.5, 0],
      [1, 0],
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('caches rounded OSRM segment requests', async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      const requestUrl = String(url);

      if (requestUrl.includes('/0,0;1,0?')) {
        return osrmResponse(
          [
            [0, 0],
            [1, 0],
          ],
          1000,
        );
      }

      if (requestUrl.includes('/1,0;0,0?')) {
        return osrmResponse(
          [
            [1, 0],
            [0, 0],
          ],
          1000,
        );
      }

      throw new Error(`Unexpected URL: ${requestUrl}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const service = createService();

    await service.osrmRoadRunning([
      [0, 0],
      [1, 0],
    ]);
    await service.osrmRoadRunning([
      [0, 0],
      [1, 0],
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
