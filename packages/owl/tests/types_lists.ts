// Compile-time checks for prop type lists e.g. t.or([...]). This file is
// only typechecked (npm run test:types); it is not executed.
import { props, t } from "../src";

type IsAny<T> = boolean extends (T extends never ? true : false) ? true : false;
declare function assertNotAny<T>(...args: IsAny<T> extends true ? [never] : []): void;

type Eq<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
declare function assertEq<A, B>(...args: Eq<A, B> extends true ? [] : [never]): void;

class Comp {
  props = props({
    union: t.or([t.string(), t.number()]),
    tuple: t.tuple([t.string(), t.number()]),
    function: t.function([t.string(), t.number()]),
  });
}
declare const comp: Comp;
void comp;

assertNotAny<typeof comp.props.union>();
assertNotAny<typeof comp.props.tuple>();
assertNotAny<(typeof comp.props.tuple)[0]>();
assertNotAny<(typeof comp.props.tuple)[1]>();
assertNotAny<typeof comp.props.function>();
assertNotAny<Parameters<typeof comp.props.function>[0]>();
assertNotAny<Parameters<typeof comp.props.function>[1]>();

assertEq<typeof comp.props.union, string | number>();
assertEq<typeof comp.props.tuple, [string, number]>();
assertEq<typeof comp.props.function, (a: string, b: number) => void>();
