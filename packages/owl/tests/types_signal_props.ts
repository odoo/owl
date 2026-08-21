// Compile-time checks for signal prop keys. This file is only typechecked
// (npm run test:types); it is not executed.
import { signal, t, useProps, type GetProps, type ReactiveValue } from "../src";

type Eq<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
declare function assertEq<A, B>(...args: Eq<A, B> extends true ? [] : [never]): void;

class Comp {
  props = useProps({
    value: t.signal(t.number()),
    label: t.signal(t.string()).optional(),
    edited: t.signal(t.string(), { settable: true }),
    picked: t.signal(t.string(), { settable: true }).optional(),
  });
}
declare const comp: Comp;

// reader view: an omitted read-only key is promoted, so it is always a signal
assertEq<typeof comp.props.value, ReactiveValue<number>>();
assertEq<typeof comp.props.label, ReactiveValue<string | undefined>>();
const label: string | undefined = comp.props.label();
// @ts-expect-error an omitted settable key is not promoted
comp.props.picked();

// parent view: a read-only key also takes the plain value that props promote
type ParentProps = GetProps<Comp>;
const ok1: ParentProps = { value: 1, edited: signal("a") };
const ok2: ParentProps = { value: signal(1), label: "a", edited: signal("a") };
const ok3: ParentProps = { value: 1, label: signal("a"), edited: signal("a"), picked: signal("b") };
// @ts-expect-error value must be a number
const ko1: ParentProps = { value: "1", edited: signal("a") };
// @ts-expect-error a settable key takes a signal only
const ko2: ParentProps = { value: 1, edited: "a" };
// @ts-expect-error value is mandatory
const ko3: ParentProps = { edited: signal("a") };

// a read-only signal type has no .static(): it would drop the promotion
// @ts-expect-error
t.signal(t.number()).static();
// @ts-expect-error
t.signal(t.number()).optional().static();
t.signal(t.number())
  .optional(() => signal(1))
  // @ts-expect-error
  .static();

void [comp, label, ok1, ok2, ok3, ko1, ko2, ko3];
