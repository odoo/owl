// Compile-time checks for schema defaults (.default()). This file is only
// typechecked (npm run test:types); it is not executed.
import { config, props, Registry, Resource, t, type GetProps } from "../src";

// A call to assertEq<A, B>() only typechecks if A and B are mutually assignable
type Eq<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
declare function assertEq<A, B>(...args: Eq<A, B> extends true ? [] : [never]): void;

class Comp {
  props = props({
    p: t.number().default(4),
    q: t.string().default("a"),
    r: t.string(),
    s: t.boolean().optional(),
  });
}
declare const comp: Comp;
void comp;

// reader view: defaulted keys are required and stripped of the brand,
// optional keys may be undefined
assertEq<typeof comp.props.p, number>();
assertEq<typeof comp.props.q, string>();
assertEq<typeof comp.props.r, string>();
assertEq<typeof comp.props.s, boolean | undefined>();

// parent view: defaulted and optional keys may be omitted
type ParentProps = GetProps<Comp>;
const ok1: ParentProps = { r: "x" };
const ok2: ParentProps = { r: "x", p: 1, q: "y", s: true };
// @ts-expect-error r is mandatory
const ko1: ParentProps = { p: 1 };
// @ts-expect-error p must be a number
const ko2: ParentProps = { r: "x", p: "nope" };
// @ts-expect-error s must be a boolean
const ko3: ParentProps = { r: "x", s: 1 };

// defaults must match the declared type, as a plain value or a factory
props({ p: t.number().default(4) });
props({ p: t.number().default(() => 4) });
// @ts-expect-error default must be a number
props({ p: t.number().default("4") });
// a default for a function type must use the factory form
props({ cb: t.function().default(() => () => {}) });
// @ts-expect-error a plain function default is rejected (factory form only)
props({ cb: t.function().default(() => {}) });

// props.static: schema default strips to the value type, optional adds undefined
function _staticPropCheck() {
  const label = props.static("label", t.string().default("fallback"));
  assertEq<typeof label, string>();
  const plain = props.static("plain", t.string());
  assertEq<typeof plain, string>();
  const opt = props.static("opt", t.string().optional());
  assertEq<typeof opt, string | undefined>();
  void [label, plain, opt];
}

// config: schema default strips to the value type, optional adds undefined
function _configCheck() {
  const delay = config("delay", t.number().default(500));
  assertEq<typeof delay, number>();
  const plain = config("plain", t.number());
  assertEq<typeof plain, number>();
  const opt = config("opt", t.number().optional());
  assertEq<typeof opt, number | undefined>();
  void [delay, plain, opt];
}

// Registry / Resource: the validation type describes the item value type
function _registryCheck() {
  const registry = new Registry({ validation: t.string() });
  registry.add("key", "some value");
  const value = registry.get("key");
  assertEq<typeof value, string>();
  assertEq<ReturnType<typeof registry.items>, string[]>();
  // @ts-expect-error a number is not a string
  registry.add("other", 42);

  const resource = new Resource({ validation: t.number() });
  resource.add(5);
  assertEq<ReturnType<typeof resource.items>, number[]>();
  // @ts-expect-error a string is not a number
  resource.add("nope");
  void value;
}

void [ok1, ok2, ko1, ko2, ko3, _staticPropCheck, _configCheck, _registryCheck];
