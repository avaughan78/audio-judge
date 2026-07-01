export function getDeviceId(): string {
  try {
    let id = sessionStorage.getItem('aj_device_id')
    if (!id) { id = crypto.randomUUID(); sessionStorage.setItem('aj_device_id', id) }
    return id
  } catch (_) { return crypto.randomUUID() }
}
