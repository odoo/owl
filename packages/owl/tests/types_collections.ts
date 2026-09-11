// Compile-time checks for the Set and Map prop types. This file is only
// typechecked (npm run test:types); it is not executed.
import { props, t } from "../src";

type IsAny<T> = boolean extends (T extends never ? true : false) ? true : false;
declare function assertNotAny<T>(...args: IsAny<T> extends true ? [never] : []): void;

type Eq<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
declare function assertEq<A, B>(...args: Eq<A, B> extends true ? [] : [never]): void;

class Comp {
  props = props({
    anyMap: t.map(),
    anySet: t.set(),
    ids: t.set(t.number()),
    keyed: t.map(t.string()),
    scores: t.map(t.string(), t.number()),
    tags: t.set(t.string()).optional(() => new Set<string>()),
  });
}
declare const comp: Comp;
void comp;

assertNotAny<typeof comp.props.ids>();
assertNotAny<typeof comp.props.scores>();

assertEq<typeof comp.props.anyMap, Map<any, any>>();
assertEq<typeof comp.props.anySet, Set<any>>();
assertEq<typeof comp.props.ids, Set<number>>();
assertEq<typeof comp.props.keyed, Map<string, any>>();
assertEq<typeof comp.props.scores, Map<string, number>>();
assertEq<typeof comp.props.tags, Set<string>>();

// the key and value types reach the members
comp.props.ids.forEach((id) => id.toFixed());
comp.props.scores.get("a")?.toFixed();
// @ts-expect-error a set of numbers holds no string
comp.props.ids.add("a");
// @ts-expect-error the map values are numbers
comp.props.scores.set("a", "b");
// @ts-expect-error the map keys are strings
comp.props.scores.get(1);
