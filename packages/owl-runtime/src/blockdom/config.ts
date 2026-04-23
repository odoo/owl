import { mainEventHandler } from "./default_event_handler";

export const config = {
  // whether or not blockdom should normalize DOM whenever a block is created.
  // Normalizing dom mean removing empty text nodes (or containing only spaces).
  // The owl compiler already strips meaningless whitespace during parsing, so
  // this is off by default.
  shouldNormalizeDom: false,

  // Main event handler. Every event handler registered with blockdom goes
  // through this function, giving it the data registered in the block and
  // the event.
  mainEventHandler,
};
