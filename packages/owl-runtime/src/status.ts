import type { Component } from "./component";
import { Plugin, STATUS } from "@odoo/owl-core";

export { STATUS } from "@odoo/owl-core";

type STATUS_DESCR = "new" | "started" | "mounted" | "destroyed";

export function status(entity: Component | Plugin): STATUS_DESCR {
  switch (entity.__owl__.status) {
    case STATUS.NEW:
      return "new";
    case STATUS.MOUNTED:
      return entity instanceof Plugin ? "started" : "mounted";
    case STATUS.DESTROYED:
      return "destroyed";
  }
}
