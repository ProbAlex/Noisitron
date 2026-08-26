/** Matches a pactl/pipewire device.description against the labels Chromium
 *  reports for system audio outputs, so we can resolve a setSinkId() target. */
export function findOutputDeviceId(
  devices: MediaDeviceInfo[],
  label: string | null
): string | null {
  if (!label) return null
  const outputs = devices.filter((d) => d.kind === 'audiooutput')
  const exact = outputs.find((d) => d.label === label)
  if (exact) return exact.deviceId
  const partial = outputs.find((d) => d.label.includes(label) || label.includes(d.label))
  return partial?.deviceId ?? null
}
