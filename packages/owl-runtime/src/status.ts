import type { Component } from "./component";
import { Plugin } from "./plugin_manager";
import { STATUS } from "@odoo/owl-core";

export { STATUS } from "@odoo/owl-core";

type STATUS_DESCR = "new" | "started" | "mounted" | "cancelled" | "destroyed";

export function status(entity: Component | Plugin): STATUS_DESCR {
  switch (entity.__owl__.status) {
    case STATUS.NEW:
      return "new";
    case STATUS.CANCELLED:
      return "cancelled";
    case STATUS.MOUNTED:
      return entity instanceof Plugin ? "started" : "mounted";
    case STATUS.DESTROYED:
      return "destroyed";
  }
}
