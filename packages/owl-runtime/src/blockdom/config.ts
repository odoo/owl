import { mainEventHandler } from "./default_event_handler";

export const config = {
  // Main event handler. Every event handler registered with blockdom goes
  // through this function, giving it the data registered in the block and
  // the event.
  mainEventHandler,
};
