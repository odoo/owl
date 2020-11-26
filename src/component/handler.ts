export function mainEventHandler(data: any, ev: Event) {
  if (typeof data === "function") {
    data(ev);
  } else {
    const ctx = data[0];
    const method = data[1];
    const args = data[2] || [];
    ctx.__owl__.component[method](...args, ev);
  }
}
