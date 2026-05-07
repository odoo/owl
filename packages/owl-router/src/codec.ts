// -----------------------------------------------------------------------------
// RouterCodec
// -----------------------------------------------------------------------------
//
// A codec converts a domain state object to/from a URL. The Router is
// otherwise agnostic about state shape — every app-specific concern (path
// segments, query keys, hash usage, slash conventions) lives in a codec.
//
// Codecs are composable: a base codec that knows the canonical state shape can
// be wrapped with middleware that transforms the state on its way in and out.
// Two middlewares ship out of the box:
//
//   - lockedKeys(keys): preserve the listed keys across `replace` calls so the
//     state shape stays "sticky" for things like `?debug=1` or `?lang=fr`.
//   - hiddenKeys(keys): keep the listed keys in the in-memory state but strip
//     them from the URL on encode.
//
// Both are intentionally narrow primitives that mirror what odoo's existing
// router did, expressed as composable middleware instead of bespoke fields.
// -----------------------------------------------------------------------------

export interface RouterCodec<TState> {
  encode(state: TState): string;
  decode(url: URL): TState;
}

export type CodecMiddleware<TState> = (codec: RouterCodec<TState>) => RouterCodec<TState>;

/** Compose a base codec with one or more middlewares (applied left-to-right). */
export function composeCodec<TState>(
  base: RouterCodec<TState>,
  middlewares: Array<CodecMiddleware<TState>>
): RouterCodec<TState> {
  let codec = base;
  for (const mw of middlewares) {
    codec = mw(codec);
  }
  return codec;
}

// -----------------------------------------------------------------------------
// Built-in middlewares
// -----------------------------------------------------------------------------

/**
 * `hiddenKeys(keys)` removes the listed keys from the encoded URL. The keys
 * stay readable on `state` (so the in-memory state still has them); they just
 * never round-trip through the URL.
 *
 * Useful for state slots that are too volatile or too large to encode (e.g.
 * a serialized component snapshot, or a derived breadcrumb stack that the
 * encoder produces from another field).
 */
export function hiddenKeys<TState extends Record<string, any>>(
  keys: ReadonlyArray<keyof TState & string>
): CodecMiddleware<TState> {
  return (inner) => ({
    encode(state) {
      const stripped = { ...state };
      for (const key of keys) {
        delete stripped[key];
      }
      return inner.encode(stripped as TState);
    },
    decode(url) {
      return inner.decode(url);
    },
  });
}

/**
 * `lockedKeys(keys)` preserves the listed keys when `replace()` is called
 * with a partial state. The Router calls codec.encode with the full next
 * state, but the Router itself merges incoming partials with locked keys
 * pulled from the previous state — that's done in the Router, not here. This
 * middleware exposes the locked-keys list so the Router can read it.
 */
export function lockedKeys<TState extends Record<string, any>>(
  keys: ReadonlyArray<keyof TState & string>
): CodecMiddleware<TState> {
  return (inner) => {
    // Stash the locked keys on the codec so Router can find them. We use a
    // symbol so the field doesn't collide with anything an inner codec
    // might add.
    const codec: RouterCodec<TState> = {
      encode: (state) => inner.encode(state),
      decode: (url) => inner.decode(url),
    };
    (codec as any)[lockedKeysSymbol] = [...((inner as any)[lockedKeysSymbol] ?? []), ...keys];
    return codec;
  };
}

export const lockedKeysSymbol = Symbol("owl-router.lockedKeys");

/** Reads the locked-key list a codec advertises (empty if none). */
export function getLockedKeys(codec: RouterCodec<any>): ReadonlyArray<string> {
  return (codec as any)[lockedKeysSymbol] ?? [];
}
