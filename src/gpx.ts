// Convert array of [lat, lon] to GPX text
export function toGPX(latlngs: [number, number][]): string {
  const pts = latlngs.map(([lat, lon]) => `      <trkpt lat="${lat}" lon="${lon}"/>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="RoutePlanner" xmlns="http://www.topografix.com/GPX/1/1">\n  <trk>\n    <name>Planned route</name>\n    <trkseg>\n${pts}\n    </trkseg>\n  </trk>\n</gpx>\n`;
}