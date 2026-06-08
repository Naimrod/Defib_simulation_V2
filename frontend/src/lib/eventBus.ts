//ModifcodeSam
type Callback = (...args: any[]) => void;

const listeners: Record<string, Callback[]> = {};

export const emit = (eventName: string, ...args: any[]) => {
  (listeners[eventName] || []).forEach((cb) => cb(...args));
};

export const on = (eventName: string, callback: Callback) => {
  listeners[eventName] = listeners[eventName] || [];
  listeners[eventName].push(callback);
};

export const off = (eventName: string, callback: Callback) => {
  if (!listeners[eventName]) return;
  listeners[eventName] = listeners[eventName].filter((cb) => cb !== callback);
};
//ModifcodeSam