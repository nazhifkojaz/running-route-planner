export interface ElevStats { gain: number; loss: number; }

function downsample<T>(arr: T[], maxPoints = 100): T[] {
  if (arr.length <= maxPoints) return arr.slice();
  const step = Math.ceil(arr.length / maxPoints);
  const out: T[] = [];
  for (let i = 0; i < arr.length; i += step) out.push(arr[i]);
  if (out[out.length - 1] !== arr[arr.length - 1]) out.push(arr[arr.length - 1]);
  return out;
}

// Fetch elevation profile using the Open‑Elevation public API
export async function elevationStats(latlngs: [number, number][]): Promise<ElevStats | null> {
  try {
    const pts = downsample(latlngs, 100);
    const locs = pts.map(([lat, lon]) => `${lat},${lon}`).join('|');
    const url = `https://api.open-elevation.com/api/v1/lookup?locations=${encodeURIComponent(locs)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`elev ${res.status}`);
    const data = await res.json();
    const elevations: number[] = (data.results ?? []).map((r: any) => r.elevation);
    if (elevations.length < 2) return null;
    let gain = 0, loss = 0;
    for (let i = 1; i < elevations.length; i++) {
      const diff = elevations[i] - elevations[i - 1];
      if (diff > 0) gain += diff; else loss += -diff;
    }
    return { gain: Math.round(gain), loss: Math.round(loss) };
  } catch {
    return null;
  }
}