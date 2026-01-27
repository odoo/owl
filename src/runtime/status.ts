import { getContext } from "./context";

// -----------------------------------------------------------------------------
//  Status
// -----------------------------------------------------------------------------

export const enum STATUS {
  NEW,
  MOUNTED, // is ready, and in DOM. It has a valid el
  // component has been created, but has been replaced by a newer component before being mounted
  // it is cancelled until the next animation frame where it will be destroyed
  CANCELLED,
  DESTROYED,
}

type STATUS_DESCR = "new" | "started" | "mounted" | "cancelled" | "destroyed";

export function status(): () => STATUS_DESCR {
  const context = getContext();
  const entity = context.type === "component" ? context.node : context.manager;
  return () => {
    switch (entity.status) {
      case STATUS.NEW:
        return "new";
      case STATUS.CANCELLED:
        return "cancelled";
      case STATUS.MOUNTED:
        return context.type === "plugin" ? "started" : "mounted";
      case STATUS.DESTROYED:
        return "destroyed";
    }
  };
}
