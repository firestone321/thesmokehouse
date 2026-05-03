const PUSH_DEVICE_ID_STORAGE_KEY = "smokehouse_push_device_id";

function createDeviceId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  const random = new Uint8Array(16);
  window.crypto.getRandomValues(random);
  return Array.from(random, (value) => value.toString(16).padStart(2, "0")).join("");
}

export function getOrCreatePushDeviceId() {
  const existing = window.localStorage.getItem(PUSH_DEVICE_ID_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const next = createDeviceId();
  window.localStorage.setItem(PUSH_DEVICE_ID_STORAGE_KEY, next);
  return next;
}
