import type { Content } from "../rendering/content";

export { config } from "./config";
export { createBlock } from "./block_compiler";
export type { Block } from "./block_compiler";

export function mount(content: Content, target: Node, afterNode: Node | null = null) {
  content.mount(target, afterNode);
}
