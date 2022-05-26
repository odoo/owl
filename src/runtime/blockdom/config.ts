export function filterOutModifiersFromData(dataList: any[]): { modifiers: string[]; data: any[] } {
  dataList = dataList.slice();
  const modifiers = [];
  let elm;
  while ((elm = dataList[0]) && typeof elm === "string") {
    modifiers.push(dataList.shift());
  }
  return { modifiers, data: dataList };
}

export const config = {
  // whether or not blockdom should normalize DOM whenever a block is created.
  // Normalizing dom mean removing empty text nodes (or containing only spaces)
  shouldNormalizeDom: true,

  // this is the main event handler. Every event handler registered with blockdom
  // will go through this function, giving it the data registered in the block
  // and the event
  mainEventHandler: (data: any, ev: Event, currentTarget?: EventTarget | null): boolean => {
    if (typeof data === "function") {
      data(ev);
    } else if (Array.isArray(data)) {
      data = filterOutModifiersFromData(data).data;
      data[0](data[1], ev);
    }
    return false;
  },
};
