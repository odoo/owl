import {
  AttrParams,
  DateParams,
  DatetimeParams,
  HtmlParams,
  ManyParams,
  RelationParams,
} from "./discussModelTypes";
import { fieldMany2Many, fieldMany2One, fieldOne2Many, fieldString } from "./field";
import { Model } from "./model";
import { FieldDefinition } from "./types";

export class DiscussRecord {
  static Model: typeof Model;
  static fields: Record<string, FieldDefinition> = {};

  static register() {
    const name = this.name;
    const fields = this.fields;
    const Mod = {
      [name]: class extends Model {
        static id = name;
        static fields = fields;
      },
    }[name];
    Mod.register();
    this.Model = Mod;
  }
  static insert(data: Partial<any>): any {
    const Constructor = this.constructor as typeof DiscussRecord;
    const record = this.Model.create(data);
    const m = new Constructor();
    m.record = record;
    return m;
  }

  record!: Model;

  constructor() {
    return new Proxy(this, {
      get(target, prop, receiver) {
        return Reflect.get(target.record, prop, receiver);
      },
    });
  }
}

export const fields = {
  One: (modelName: string, params: RelationParams = {}) => fieldMany2One(modelName),
  Many: (modelName: string, params: ManyParams = {}) =>
    params.inverse
      ? fieldOne2Many(modelName, {
          relatedField: params.inverse,
        })
      : fieldMany2Many(modelName),
  Attr: (defaultValue: string, params: AttrParams = {}) => fieldString(),
  Html: (defaultValue: string, params: HtmlParams = {}) => fieldString(),
  Date: (params: DateParams = {}) => fieldString(),
  Datetime: (params: DatetimeParams = {}) => fieldString(),
};
