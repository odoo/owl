// Compile-time checks for hook signatures. This file is only typechecked
// (npm run test:types); it is not executed.
import { signal, useOnChange } from "../src";

type Eq<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
declare function assertEq<A, B>(...args: Eq<A, B> extends true ? [] : [never]): void;

declare const count: ReturnType<typeof signal<number>>;
declare const label: ReturnType<typeof signal<string>>;

// each dependency keeps its own type, without needing `as const`
useOnChange(
  () => [count(), label()],
  (c, l) => {
    assertEq<typeof c, number>();
    assertEq<typeof l, string>();
  }
);

// the callback may declare fewer parameters than there are dependencies...
useOnChange(
  () => [count(), label()],
  (c) => {
    assertEq<typeof c, number>();
  }
);

// ... or none at all
useOnChange(
  () => [count()],
  () => {}
);

// the callback may return a cleanup function
useOnChange(
  () => [count()],
  (c) => () => {
    assertEq<typeof c, number>();
  }
);

useOnChange(
  () => [count()],
  () => {},
  { initialRun: false }
);

useOnChange(
  () => [count()],
  // @ts-expect-error the callback cannot declare more parameters than there are
  // dependencies
  (_c: number, _extra: string) => {}
);

useOnChange(
  () => [count()],
  // @ts-expect-error wrong dependency type
  (_c: string) => {}
);

useOnChange(
  // @ts-expect-error dependencies must return an array
  () => count(),
  () => {}
);

useOnChange(
  () => [count()],
  () => {},
  // @ts-expect-error unknown option
  { initial: false }
);
