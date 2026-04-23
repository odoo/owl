import { useStore } from "../store/store";

const { Component, signal, onMounted, onPatched, onWillUnmount } = owl;
const getProps = owl.props;

function useLayoutEffect(fn, computeDeps) {
  let cleanup, deps;
  onMounted(() => {
    deps = computeDeps();
    cleanup = fn(...deps);
  });
  onPatched(() => {
    const newDeps = computeDeps();
    if (newDeps.some((d, i) => d !== deps[i])) {
      cleanup?.();
      deps = newDeps;
      cleanup = fn(...deps);
    }
  });
  onWillUnmount(() => cleanup?.());
}

export class ContextMenu extends Component {
  static template = "devtools.ContextMenu";

  props = getProps();

  setup() {
    this.store = useStore();
    this.menuEl = signal(null);
    useLayoutEffect(
      (position) => {
        const menu = this.menuEl();
        const menuWidth = menu.offsetWidth;
        const menuHeight = menu.offsetHeight;
        let { x, y } = position;
        if (x + menuWidth > window.innerWidth) {
          x = window.innerWidth - menuWidth;
        }
        if (y + menuHeight > window.innerHeight) {
          y = window.innerHeight - menuHeight;
        }
        menu.style.left = x + "px";
        // Need 25px offset because of the main navbar from the browser devtools
        menu.style.top = y + "px";
      },
      () => [this.store.contextMenu?.position]
    );
  }
  onClickItem(action) {
    action();
    this.store.contextMenu = null;
  }
}
