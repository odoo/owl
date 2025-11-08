// import { derived, getChangeItem, onReadAtom } from "./signals";

// export function listenChanges(obj, key, fn) {
//   getTargetKeyAtom(obj, key);
// }

export function reactiveMap<A, B>(arr: A[], fn: (a: A, index: number) => B) {
  // return derived(() => );

  // const item = getChangeItem(arr)!;
  // const atom = item[0];
  // let mappedArray: B[];

  // return derived(() => {
  //   onReadAtom(atom);
  //   const changes = item[1];

  //   if (!mappedArray) {
  //     mappedArray = arr.map(fn);
  //     return mappedArray;
  //   }

  //   for (const [key, receiver] of changes) {
  //     // console.warn(`receiver:`, receiver);
  //     receiver;
  //     if (key === "length") {
  //       mappedArray.length = arr.length;
  //     } else if (typeof key === "number") {
  //       // mappedArray[key] = fn(arr[key], key);
  //     }
  //   }
  //   return mappedArray;
  // });
  return undefined as any;
}
