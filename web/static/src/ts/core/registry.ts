//------------------------------------------------------------------------------
// Registry code
//------------------------------------------------------------------------------
export class Registry<T> {
  private map: { [key: string]: T } = {};

  add(key: string, item: T): Registry<T> {
    if (key in this.map) {
      throw new Error(`Key ${key} already exists!`);
    }
    this.map[key] = item;
    return this;
  }

  get(key: string): T {
    return this.map[key];
  }
}

//------------------------------------------------------------------------------
// Main registry instance
//------------------------------------------------------------------------------
export const registry = new Registry();
