export const config = {
  // whether or not blockdom should normalize DOM whenever a block is created.
  // Normalizing dom mean removing empty text nodes (or containing only spaces)
  shouldNormalizeDom: true,

  // this is the main event handler. Every event handler registered with blockdom
  // will go through this function, giving it the data registered in the block
  // and the event
  mainEventHandler: (data: any, ev: Event) => {
    if (typeof data === "function") {
      data(ev);
    } else if (Array.isArray(data)) {
      data[0](data[1], ev);
    }
  },
};
