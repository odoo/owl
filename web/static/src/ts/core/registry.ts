/**
 * The registry is basically a simple hashmap. It is only a little safer and
 * more structured than a simple object.
 */
export class Registry<T> {
  private map: { [key: string]: T } = {};

  /**
   * Add an element to the registry.  Note that the add method returns the
   * registry, to it can be chained.
   */
  add(key: string, item: T): Registry<T> {
    if (key in this.map) {
      throw new Error(`Key ${key} already exists!`);
    }
    this.map[key] = item;
    return this;
  }

  /**
   * Returns the element corresponding to the key
   *
   * Nothing is done to check that the key actually exists.
   */
  get(key: string): T | undefined {
    return this.map[key];
  }
}
