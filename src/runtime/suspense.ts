import { BDom, VNode } from "./blockdom";
import { Component } from "./component";
import { ComponentNode } from "./component_node";
import { Fiber, RootFiber } from "./rendering/fibers";
import { STATUS } from "./status";

// ---------------------------------------------------------------------------
//  SuspenseBoundaryRoot
// ---------------------------------------------------------------------------

/**
 * A special RootFiber that acts as a boundary for Suspense content children.
 * Instead of patching the DOM directly (like a normal RootFiber), its
 * complete() method triggers the VSuspense to swap fallback → content.
 */
class SuspenseBoundaryRoot extends RootFiber {
  vsuspense: VSuspense | null = null;

  constructor(node: ComponentNode) {
    super(node, null);
    // Override: counter starts at 0 because the boundary root itself never
    // renders. It only tracks content children's async work.
    this.counter = 0;
  }

  complete() {
    if (this.appliedToDom) {
      return; // Prevent double completion
    }
    const vs = this.vsuspense;
    if (!vs) {
      return;
    }
    this.locked = true;
    let current: Fiber | undefined = undefined;
    let mountedFibers = this.mounted;
    try {
      // Step 1: call willPatch lifecycle hooks
      for (current of this.willPatch) {
        let node = current.node;
        if (node.fiber === current) {
          const component = node.component;
          for (let cb of node.willPatch) {
            cb.call(component);
          }
        }
      }
      current = undefined;

      // Step 2: apply content to DOM (mount or patch)
      vs.applyContent();

      this.locked = false;
      this.appliedToDom = true;

      // Step 3: call mounted lifecycle hooks
      while ((current = mountedFibers.pop())) {
        if (current.appliedToDom) {
          for (let cb of current.node.mounted) {
            cb();
          }
        }
      }

      // Step 4: call patched lifecycle hooks
      while ((current = this.patched.pop())) {
        if (current.appliedToDom) {
          for (let cb of current.node.patched) {
            cb();
          }
        }
      }
    } catch (e) {
      for (let fiber of mountedFibers) {
        fiber.node.willUnmount = [];
      }
      this.locked = false;
      this.node.app.handleError({ fiber: current || this, error: e });
    }
  }
}

// ---------------------------------------------------------------------------
//  VSuspense VNode
// ---------------------------------------------------------------------------

const nodeInsertBefore = Node.prototype.insertBefore;
const nodeRemoveChild = Node.prototype.removeChild;

/**
 * A blockdom VNode that manages two sub-trees: content and fallback.
 * It handles the transition between fallback and content based on the
 * SuspenseBoundaryRoot's completion.
 */
class VSuspense implements VNode<VSuspense> {
  content: BDom;
  fallback: BDom;
  boundaryRoot: SuspenseBoundaryRoot;
  delay: number;

  parentEl?: HTMLElement;
  anchor?: Text; // text node anchor for positioning
  showingContent: boolean = false;
  showingFallback: boolean = false;
  delayTimer: ReturnType<typeof setTimeout> | null = null;
  pendingContent: BDom | null = null;
  pendingBoundaryRoot: SuspenseBoundaryRoot | null = null;

  constructor(
    content: BDom,
    fallback: BDom,
    boundaryRoot: SuspenseBoundaryRoot,
    delay: number
  ) {
    this.content = content;
    this.fallback = fallback;
    this.boundaryRoot = boundaryRoot;
    this.delay = delay;
  }

  mount(parent: HTMLElement, afterNode: Node | null) {
    this.parentEl = parent;
    this.anchor = document.createTextNode("");
    nodeInsertBefore.call(parent, this.anchor, afterNode);

    if (this.boundaryRoot.counter === 0) {
      // Content is already ready (sync content or already resolved).
      // Mount content directly — no fallback needed.
      this.content.mount(parent, this.anchor);
      this.showingContent = true;
    } else if (this.delay === 0) {
      // No delay: show fallback immediately
      this.fallback.mount(parent, this.anchor);
      this.showingFallback = true;
    } else {
      // Delay > 0: wait before showing fallback
      this.delayTimer = setTimeout(() => {
        this.delayTimer = null;
        if (!this.showingContent) {
          this.fallback.mount(this.parentEl!, this.anchor!);
          this.showingFallback = true;
        }
      }, this.delay);
    }
  }

  /**
   * Called by SuspenseBoundaryRoot.complete() when content children are ready.
   */
  applyContent() {
    if (this.showingContent) {
      // Update case: patch old content with new
      if (this.pendingContent) {
        this.content.patch(this.pendingContent, true);
        this.content = this.pendingContent;
        this.pendingContent = null;
        this.pendingBoundaryRoot = null;
      }
    } else {
      // Initial mount: swap fallback/placeholder → content
      if (this.delayTimer !== null) {
        clearTimeout(this.delayTimer);
        this.delayTimer = null;
      }
      if (this.showingFallback) {
        this.fallback.beforeRemove();
        this.fallback.remove();
        this.showingFallback = false;
      }
      this.content.mount(this.parentEl!, this.anchor!);
      this.showingContent = true;
    }
  }

  moveBeforeDOMNode(node: Node | null, parent?: HTMLElement) {
    if (this.showingContent) {
      this.content.moveBeforeDOMNode(node, parent);
    } else if (this.showingFallback) {
      this.fallback.moveBeforeDOMNode(node, parent);
    }
    // Also move the anchor
    const targetParent = parent || this.parentEl!;
    nodeInsertBefore.call(targetParent, this.anchor!, node);
  }

  moveBeforeVNode(other: VSuspense | null, afterNode: Node | null) {
    this.moveBeforeDOMNode((other && other.firstNode()) || afterNode);
  }

  patch(other: VSuspense, withBeforeRemove: boolean) {
    if (this === other) {
      return;
    }

    if (this.showingContent) {
      // Content is currently visible
      if (other.boundaryRoot.counter === 0) {
        // New content is ready immediately: patch content directly
        this.content.patch(other.content, withBeforeRemove);
        this.content = other.content;
        this.boundaryRoot = other.boundaryRoot;
        this.boundaryRoot.vsuspense = this;
        this.boundaryRoot.appliedToDom = true;
      } else {
        // New content has async work: keep showing old content
        this.pendingContent = other.content;
        this.pendingBoundaryRoot = other.boundaryRoot;
        this.boundaryRoot = other.boundaryRoot;
        this.boundaryRoot.vsuspense = this;
      }
    } else {
      // Fallback is visible (or placeholder with delay timer)
      // Patch fallback
      if (this.showingFallback) {
        this.fallback.patch(other.fallback, withBeforeRemove);
        this.fallback = other.fallback;
      } else {
        this.fallback = other.fallback;
      }
      // Update content reference
      this.content = other.content;
      this.boundaryRoot = other.boundaryRoot;
      this.boundaryRoot.vsuspense = this;
      this.delay = other.delay;
    }
  }

  beforeRemove() {
    if (this.showingContent) {
      this.content.beforeRemove();
    } else if (this.showingFallback) {
      this.fallback.beforeRemove();
    }
  }

  remove() {
    if (this.delayTimer !== null) {
      clearTimeout(this.delayTimer);
      this.delayTimer = null;
    }
    if (this.showingContent) {
      this.content.remove();
    } else if (this.showingFallback) {
      this.fallback.remove();
    }
    nodeRemoveChild.call(this.parentEl!, this.anchor!);
  }

  firstNode(): Node | undefined {
    if (this.showingContent) {
      return this.content.firstNode();
    }
    if (this.showingFallback) {
      return this.fallback.firstNode();
    }
    return this.anchor;
  }
}

// ---------------------------------------------------------------------------
//  Suspense template function
// ---------------------------------------------------------------------------

export function suspenseTemplate(app: any, bdom: any, helpers: any) {
  let { callSlot } = helpers;

  return function template(ctx: any, node: any, key = ""): any {
    const props = ctx.__owl__.props;
    const delay = props.delay || 0;

    // ---- Clean up old boundary root if re-rendering ----
    const oldBoundary: SuspenseBoundaryRoot | undefined = (node as any)._suspenseBoundary;
    if (oldBoundary) {
      // Cancel unmounted content children (STATUS.NEW) — they'll be recreated
      // with fresh willStart. Mounted children are kept and updated normally.
      for (let child of oldBoundary.children) {
        if (child.node.status === STATUS.NEW) {
          child.node.cancel();
          child.node.fiber = null;
        }
      }
      node.app.scheduler.tasks.delete(oldBoundary);
    }

    // ---- Create new boundary root ----
    const boundaryRoot = new SuspenseBoundaryRoot(node);
    (node as any)._suspenseBoundary = boundaryRoot;
    node.app.scheduler.addFiber(boundaryRoot);

    // ---- Swap fiber: content children's fibers go to boundary root ----
    const realFiber = node.fiber;
    node.fiber = boundaryRoot;

    // Render content slot (child components created here use boundaryRoot as parent)
    const contentBdom = callSlot(ctx, node, key, "default", false, null);

    // Copy content children to real fiber's childrenMap so they persist in
    // node.children across re-renders (createComponent looks them up there)
    for (let k in boundaryRoot.childrenMap) {
      realFiber.childrenMap[k] = boundaryRoot.childrenMap[k];
    }

    // ---- Restore fiber ----
    node.fiber = realFiber;

    // Render fallback slot (uses the real fiber, so fallback is part of the
    // normal rendering flow)
    const fallbackBdom = callSlot(ctx, node, key, "fallback", false, null);

    // ---- Create VSuspense ----
    const vs = new VSuspense(contentBdom, fallbackBdom, boundaryRoot, delay);
    boundaryRoot.vsuspense = vs;
    return vs;
  };
}

// ---------------------------------------------------------------------------
//  Suspense Component
// ---------------------------------------------------------------------------

export class Suspense extends Component {
  static template = "__suspense__";
}
