function toRadians(degrees) {
  return (degrees * Math.PI) / 180
}

export function distanceInMeters(a, b) {
  const earthRadius = 6371000
  const dLat = toRadians(b.lat - a.lat)
  const dLng = toRadians(b.lng - a.lng)
  const lat1 = toRadians(a.lat)
  const lat2 = toRadians(b.lat)

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2

  return 2 * earthRadius * Math.asin(Math.sqrt(h))
}

export function sumPolylineDistance(points) {
  if (!points || points.length < 2) return 0

  let total = 0
  for (let index = 0; index < points.length - 1; index += 1) {
    total += distanceInMeters(points[index], points[index + 1])
  }

  return total
}
