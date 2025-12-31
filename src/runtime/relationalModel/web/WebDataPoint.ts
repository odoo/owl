export class DataPoint {
  /**
   * @param {RelationalModel} model
   * @param {RelationalModelConfig} config
   * @param {Record<string, unknown>} data
   * @param {unknown} [options]
   */
  model: any;
  _config: any;
  // constructor(model: any, config: any, data: any, options: any) {
  //   this._constructor(model, config, data, options);
  // }
  _constructor(model: any, config: any, data: any, options: any) {
    // this.id = getId("datapoint");
    this.model = model;
    /** @type {RelationalModelConfig} */
    this._config = config;
    this.setup(config, data, options);
  }

  /**
   * @abstract
   * @template [O={}]
   * @param {RelationalModelConfig} _config
   * @param {Record<string, unknown>} _data
   * @param {O | undefined} _options
   */
  setup(_config: any, _data: any, _options: any) {}

  get activeFields() {
    return this.config.activeFields;
  }

  get fields() {
    return this.config.fields;
  }

  get fieldNames() {
    return Object.keys(this.activeFields).filter(
      (fieldName) => !this.fields[fieldName].relatedPropertyField
    );
  }

  get resModel() {
    return this.config.resModel;
  }

  get config() {
    return this._config;
  }

  get context() {
    return this.config.context;
  }
}
