import { defineLazyProperty, ensureContext, Model } from "../model";
import { getRecordChanges } from "../modelData";
import { flushDataToLoad, loadRecordWithRelated } from "../store";
import { DataPoint } from "./WebDataPoint";
import { makeModelFromWeb } from "./webModel";
import { StaticList, StaticListConfig } from "./WebStaticList";

export type MakeWebRecord = (model: any, config: any, data: any, options: any) => WebRecord;
const makeWebRecord: MakeWebRecord = (...args) => new WebRecord(...args);

export class WebRecord extends DataPoint {
  static type = "Record";
  orecord!: Model;
  data!: Record<string, any>;
  evalContext!: Record<string, any>;
  evalContextWithVirtualIds!: Record<string, any>;
  _isEvalContextReady = false;
  canSaveOnUpdate: boolean = true;
  selected: boolean | undefined;

  constructor(...args: Parameters<MakeWebRecord>) {
    super();
    this._constructor(...args);
  }

  setup(_config: any, data: any, options: any = {}) {
    // options.orecord is created by static list
    if (options.orecord) {
      this.orecord = options.orecord;
      this.data = makeFieldObject(this, this.orecord);
      this._setEvalContext();
      return;
    }

    const OModel = makeModelFromWeb(_config);
    this.orecord = new OModel(this.config.resId);
    if (options.draftContext) {
      this.orecord = ensureContext(options.draftContext, this.orecord)!;
    } else if (this.config.resId) {
      this.orecord = this.orecord.makeDraft();
      (this.orecord.draftContext as any).name ??= "main";
    }
    loadRecordWithRelated(OModel, { id: this.orecord.id, ...data });
    flushDataToLoad();
    this.data = makeFieldObject(this, this.orecord);
    // this.evalContext = reactive({});
    // this.evalContextWithVirtualIds = reactive({});
    this._setEvalContext();
  }

  // record infos - basic ----------------------------------------------------
  get id() {
    return this.orecord.id;
  }
  get resId() {
    const { orecord } = this;
    return !orecord.isNew() && orecord.id;
  }
  get isNew() {
    return this.orecord.isNew();
  }
  get dirty() {
    return this.orecord.hasChanges();
  }
  // required, number
  get isValid() {
    return true;
    // return !this._invalidFields.size;
  }

  _isRequired(fieldName: string) {
    const win = window as any;
    const required = this.activeFields[fieldName].required;
    return required ? win.evaluateBooleanExpr(required, this.evalContextWithVirtualIds) : false;
  }
  // record infos - odoo specific --------------------------------------------
  // is archived
  get isActive() {
    const data = this.data;
    if ("active" in data) {
      return data.active;
    } else if ("x_active" in data) {
      return data.x_active;
    }
    return true;
  }
  _isInvisible(fieldName: string) {
    const win = window as any;
    const invisible = this.activeFields[fieldName].invisible;
    return invisible ? win.evaluateBooleanExpr(invisible, this.evalContextWithVirtualIds) : false;
  }
  _isReadonly(fieldName: string) {
    const win = window as any;
    const readonly = this.activeFields[fieldName].readonly;
    return readonly ? win.evaluateBooleanExpr(readonly, this.evalContextWithVirtualIds) : false;
  }
  // record update -----------------------------------------------------------
  update(changes: any, { save }: any = {}) {
    if (this.model._urgentSave) {
      return this._updateORecord(this.orecord, changes);
      // return this._update(changes);
    }
    return this.model.mutex.exec(async () => {
      // await this._update(changes, { withoutOnchange: save });
      await this._updateORecord(this.orecord, changes);
      if (save && this.canSaveOnUpdate) {
        return this._save();
      }
    });
    // save;
  }
  async _updateORecord(orecord: any, changes: any) {
    for (const key in changes) {
      if (key === "id") {
        continue;
      }
      const field = orecord.constructor.fields[key];
      if (field.type === "many2one") {
        this._updateORecord(orecord[key], changes[key]);
        continue;
      }
      if (["one2many", "many2many"].includes(field?.type)) {
        throw new Error("debug me");
      }
      (this.orecord as any)[key] = changes[key];
    }
  }
  async _update(changes: any, { withoutOnchange, withoutParentUpdate }: any = {}) {
    throw new Error("debug me");
    // this.dirty = true;
    // const prom = Promise.all([
    //   this._preprocessMany2oneChanges(changes),
    //   this._preprocessMany2OneReferenceChanges(changes),
    //   this._preprocessReferenceChanges(changes),
    //   this._preprocessX2manyChanges(changes),
    //   this._preprocessPropertiesChanges(changes),
    //   this._preprocessHtmlChanges(changes),
    // ]);
    // if (!this.model._urgentSave) {
    //   await prom;
    // }
    // if (this.selected && this.model.multiEdit) {
    //   return this.model.root._multiSave(this, changes);
    // }
    // let onchangeServerValues = {};
    // if (!this.model._urgentSave && !withoutOnchange) {
    //   onchangeServerValues = await this._getOnchangeValues(changes);
    // }
    // // changes inside the record set as value for a many2one field must trigger the onchange,
    // // but can't be considered as changes on the parent record, so here we detect if many2one
    // // fields really changed, and if not, we delete them from changes
    // for (const fieldName in changes) {
    //   if (this.fields[fieldName].type === "many2one") {
    //     const curVal = toRaw(this.data[fieldName]);
    //     const nextVal = changes[fieldName];
    //     if (
    //       curVal &&
    //       nextVal &&
    //       curVal.id === nextVal.id &&
    //       curVal.display_name === nextVal.display_name
    //     ) {
    //       delete changes[fieldName];
    //     }
    //   }
    // }
    // const undoChanges = this._applyChanges(changes, onchangeServerValues);
    // if (Object.keys(changes).length > 0 || Object.keys(onchangeServerValues).length > 0) {
    //   try {
    //     await this._onUpdate({ withoutParentUpdate });
    //   } catch (e) {
    //     undoChanges();
    //     throw e;
    //   }
    //   await this.model.hooks.onRecordChanged(this, this._getChanges());
    // }
  }

  // Context -----------------------------------------------------------------
  _setEvalContext() {
    // todo: what is this?
    const win = window as any;
    const evalContext = win.getBasicEvalContext(this.config);
    const dataContext = this._computeDataContext();
    this.evalContext ??= {};
    this.evalContextWithVirtualIds ??= {};
    Object.assign(this.evalContext, evalContext, dataContext.withoutVirtualIds);
    Object.assign(this.evalContextWithVirtualIds, evalContext, dataContext.withVirtualIds);
    this._isEvalContextReady = true;

    // if (!this._parentRecord || this._parentRecord._isEvalContextReady) {
    //     for (const [fieldName, value] of Object.entries(toRaw(this.data))) {
    //         if (["one2many", "many2many"].includes(this.fields[fieldName].type)) {
    //             value._updateContext(getFieldContext(this, fieldName));
    //         }
    //     }
    // }
  }
  _computeDataContext() {
    const dataContext: Record<string, any> = {};
    const x2manyDataContext: Record<string, any> = {
      withVirtualIds: {},
      withoutVirtualIds: {},
    };
    const data = { ...this.data };
    console.warn(`data:`, data);
    for (const fieldName in data) {
      const value = data[fieldName];
      const field = this.fields[fieldName];
      if (field.relatedPropertyField) {
        continue;
      }
      const win = window as any;
      if (["char", "text", "html"].includes(field.type)) {
        dataContext[fieldName] = data[fieldName];
      } else if (field.type === "one2many" || field.type === "many2many") {
        x2manyDataContext.withVirtualIds[fieldName] = value;
        x2manyDataContext.withoutVirtualIds[fieldName] = value.filter(
          (id: any) => typeof id === "number"
        );
      } else if (value && field.type === "date") {
        dataContext[fieldName] = win.serializeDate(value);
      } else if (value && field.type === "datetime") {
        dataContext[fieldName] = win.serializeDateTime(value);
      } else if (value && field.type === "many2one") {
        dataContext[fieldName] = value;
      } else if (value && field.type === "reference") {
        dataContext[fieldName] = `${value.resModel},${value.resId}`;
      } else if (field.type === "properties") {
        // dataContext[fieldName] = value.filter(
        //   (property: any) => !property.definition_deleted !== false
        // );
        dataContext[fieldName] = null;
      } else {
        dataContext[fieldName] = value;
      }
    }
    dataContext.id = this.resId || false;
    console.warn(`dataContext:`, dataContext);
    const r = {
      withVirtualIds: { ...dataContext, ...x2manyDataContext.withVirtualIds },
      withoutVirtualIds: { ...dataContext, ...x2manyDataContext.withoutVirtualIds },
    };
    console.warn(`r:`, r);
    return r;
  }

  // Server / save -----------------------------------------------------------
  /**
   * @param {Parameters<Record["_save"]>[0]} options
   */
  async save(options: any) {
    // console.warn("should save, options", options);
    await this.model._askChanges();
    return this.model.mutex.exec(() => this._save(options));
  }
  async _save({ reload = true, onError, nextId }: any = {}) {
    if (this.model._closeUrgentSaveNotification) {
      this.model._closeUrgentSaveNotification();
    }
    if (nextId) {
      debugger;
    }
    // const creation = !this.resId;
    // if (nextId) {
    //     if (creation) {
    //         throw new Error("Cannot set nextId on a new record");
    //     }
    //     reload = true;
    // }
    // // before saving, abandon new invalid, untouched records in x2manys
    // for (const fieldName in this.activeFields) {
    //     const field = this.fields[fieldName];
    //     if (["one2many", "many2many"].includes(field.type) && !field.relatedPropertyField) {
    //         this.data[fieldName]._abandonRecords();
    //     }
    // }
    // if (!this._checkValidity({ displayNotification: true })) {
    //     return false;
    // }
    // const changes = this._getChanges();
    const changes = this._getChanges();
    console.warn(`changes:`, changes);
    // delete changes.id; // id never changes, and should not be written
    // if (!creation && !Object.keys(changes).length) {
    //     if (nextId) {
    //         return this.model.load({ resId: nextId });
    //     }
    //     this._changes = markRaw({});
    //     this.data2 = { ...this._values };
    //     this.dirty = false;
    //     return true;
    // }
    // if (
    //     this.model._urgentSave &&
    //     this.model.useSendBeaconToSaveUrgently &&
    //     !this.model.env.inDialog
    // ) {
    //     // We are trying to save urgently because the user is closing the page. To
    //     // ensure that the save succeeds, we can't do a classic rpc, as these requests
    //     // can be cancelled (payload too heavy, network too slow, computer too fast...).
    //     // We instead use sendBeacon, which isn't cancellable. However, it has limited
    //     // payload (typically < 64k). So we try to save with sendBeacon, and if it
    //     // doesn't work, we will prevent the page from unloading.
    //     const route = `/web/dataset/call_kw/${this.resModel}/web_save`;
    //     const params = {
    //         model: this.resModel,
    //         method: "web_save",
    //         args: [this.resId ? [this.resId] : [], changes],
    //         kwargs: { context: this.context, specification: {} },
    //     };
    //     const data = { jsonrpc: "2.0", method: "call", params };
    //     const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    //     const succeeded = navigator.sendBeacon(route, blob);
    //     if (succeeded) {
    //         this._changes = markRaw({});
    //         this.dirty = false;
    //     } else {
    //         this.model._closeUrgentSaveNotification = this.model.notification.add(
    //             _t(
    //                 `Heads up! Your recent changes are too large to save automatically. Please click the %(upload_icon)s button now to ensure your work is saved before you exit this tab.`,
    //                 { upload_icon: markup`<i class="fa fa-cloud-upload fa-fw"></i>` }
    //             ),
    //             { sticky: true }
    //         );
    //     }
    //     return succeeded;
    // }
    const canProceed = await this.model.hooks.onWillSaveRecord(this, changes);
    if (canProceed === false) {
      return false;
    }
    // keep x2many orderBy if we stay on the same record
    const orderBys = {};
    // if (!nextId) {
    //     for (const fieldName of this.fieldNames) {
    //         if (["one2many", "many2many"].includes(this.fields[fieldName].type)) {
    //             orderBys[fieldName] = this.data[fieldName].orderBy;
    //         }
    //     }
    // }
    let fieldSpec = {};
    if (reload) {
      // console.warn("reload");
      // throw new Error("debug me: save with reload");
      const win = window as any;
      fieldSpec = win.getFieldsSpec(
        this.activeFields,
        this.fields,
        win.getBasicEvalContext(this.config),
        {
          orderBys,
        }
      );
    }
    const kwargs = {
      context: this.context,
      specification: fieldSpec,
      next_id: nextId,
    };
    console.warn(`kwargs:`, kwargs);
    let records = [];
    try {
      records = await this.model.orm.webSave(
        this.resModel,
        this.resId ? [this.resId] : [],
        changes,
        kwargs
      );
    } catch (e) {
      if (onError) {
        return onError(e, {
          discard: () => this._discard(),
          retry: () => this._save(...arguments),
        });
      }
      if (!this.isInEdition) {
        await this._load({});
      }
      throw e;
    }
    console.warn(`records[0]:`, records[0]);
    if (reload && !records.length) {
      const win = window as any;
      throw new win.FetchRecordError([nextId || this.resId]);
    }
    // if (creation) {
    //     const resId = records[0].id;
    //     const resIds = this.resIds.concat([resId]);
    //     this.model._updateConfig(this.config, { resId, resIds }, { reload: false });
    // }
    // commitRecordChanges(this.orecord);
    this.orecord.saveDraft();
    // await this.model.hooks.onRecordSaved(this, changes);
    // if (reload) {
    //     // if (this.resId) {
    //     //     this.model._updateSimilarRecords(this, records[0]);
    //     // }
    //     if (nextId) {
    //         this.model._updateConfig(this.config, { resId: nextId }, { reload: false });
    //     }
    //     if (this.config.isRoot) {
    //         this.model.hooks.onWillLoadRoot(this.config);
    //     }
    //     this._setData(records[0], { orderBys });
    // } else {
    //     this._values = markRaw({ ...this._values, ...this._changes });
    //     if ("id" in this.activeFields) {
    //         this._values.id = records[0].id;
    //     }
    //     for (const fieldName in this.activeFields) {
    //         const field = this.fields[fieldName];
    //         if (["one2many", "many2many"].includes(field.type) && !field.relatedPropertyField) {
    //             this._changes[fieldName]?._clearCommands();
    //         }
    //     }
    //     this._changes = markRaw({});
    //     this.data2 = { ...this._values };
    //     this.dirty = false;
    // }
    return true;
  }
  _getChanges() {
    // let changes = getRecordChanges(this.orecord);
    // return changes[this.resModel]?.[this.resId as number];
    return getRecordChanges(this.orecord);
    // if (!this.resId) {
    //   // Apply the initial changes when the record is new
    //   changes = { ...this._values, ...changes };
    // }
    // const result = {};
    // for (const [fieldName, value] of Object.entries(changes)) {
    //   const field = this.fields[fieldName];
    //   if (fieldName === "id") {
    //     continue;
    //   }
    //   if (
    //     !withReadonly &&
    //     fieldName in this.activeFields &&
    //     this._isReadonly(fieldName) &&
    //     !this.activeFields[fieldName].forceSave
    //   ) {
    //     continue;
    //   }
    //   if (field.relatedPropertyField) {
    //     continue;
    //   }
    //   if (field.type === "one2many" || field.type === "many2many") {
    //     const commands = value._getCommands({ withReadonly });
    //     if (!this.isNew && !commands.length && !withReadonly) {
    //       continue;
    //     }
    //     result[fieldName] = commands;
    //   } else {
    //     result[fieldName] = this._formatServerValue(field.type, value);
    //   }
    // }
    // return result;
  }
  async urgentSave() {
    this.model._urgentSave = true;
    this.model.bus.trigger("WILL_SAVE_URGENTLY");
    if (!this.resId && !this.dirty) {
      return true;
    }
    const succeeded = await this._save({ reload: false });
    this.model._urgentSave = false;
    return succeeded;
  }
  // Server / load -----------------------------------------------------------
  load() {
    if (arguments.length > 0) {
      throw new Error("Record.load() does not accept arguments");
    }
    return this.model.mutex.exec(() => this._load());
  }
  async _load(nextConfig = {}) {
    if ("resId" in nextConfig && this.resId) {
      throw new Error("Cannot change resId of a record");
    }
    await this.model._updateConfig(this.config, nextConfig, {
      commit: (values: Record<string, any>) => {
        // should not be necessary
        // if (this.resId) {
        //   this.model._updateSimilarRecords(this, values);
        // }
        this._setData(values);
      },
    });
  }

  // UI state - pager --------------------------------------------------------
  // form pager, is it really used?
  get resIds() {
    return this.config.resIds;
  }
  // UI state - data presence ------------------------------------------------
  // feature: 1) for no-content helper 2) fake data with sample_server.js, 3) maybe more
  get hasData() {
    return true;
  }

  // UI state - editable list ------------------------------------------------
  get isInEdition() {
    const { mode } = this.config;
    if (mode === "readonly") {
      return false;
    }
    return mode === "edit" || !this.resId;
  }
  /**
   * @param {Mode} mode
   */
  switchMode(mode: any) {
    return this.model.mutex.exec(() => this._switchMode(mode));
  }
  /**
   * @param {Mode} mode
   */
  _switchMode(mode: any) {
    // why is it necessary?
    this.model._updateConfig(this.config, { mode }, { reload: false });
    if (mode === "readonly") {
      // this._noUpdateParent = false;
      // this._invalidFields.clear();
    }
  }
  // list vue editable, can we discard the record (with key nav)
  get canBeAbandoned() {
    // return this.isNew && !this.dirty && this._manuallyAdded;
    return false;
  }
  // UI state - dirty --------------------------------------------------------
  async isDirty() {
    await this.model._askChanges();
    return this.dirty;
  }
  // UI state - selection ----------------------------------------------------
  toggleSelection(selected: any) {
    return this.model.mutex.exec(() => {
      this._toggleSelection(selected);
    });
  }
  _toggleSelection(selected: any) {
    if (typeof selected === "boolean") {
      this.selected = selected;
    } else {
      this.selected = !this.selected;
    }
    if (!this.selected && this.model.root.isDomainSelected) {
      this.model.root._selectDomain(false);
    }
  }
  // UI state - multi create (calendar, gantt) -------------------------------
  async getChanges({ withReadonly }: any = {}) {
    coucou("getChanges");
    await this.model._askChanges();
    return this.model.mutex.exec(() => this._getChanges());
  }

  // Server / onchange -------------------------------------------------------
  async _getOnchangeValues(changes: any) {
    // const win = window as any;
    // for (const fieldName in changes) {
    //   if (changes[fieldName] instanceof win.Operation) {
    //     changes[fieldName] = changes[fieldName].compute(this.data[fieldName]);
    //   }
    // }
    // const onChangeFields = Object.keys(changes).filter(
    //   (fieldName) => this.activeFields[fieldName] && this.activeFields[fieldName].onChange
    // );
    // if (!onChangeFields.length) {
    //   return {};
    // }
    // const localChanges = this._getChanges({ ...this._changes, ...changes }, { withReadonly: true });
    // if (this.config.relationField) {
    //   const parentRecord = this._parentRecord;
    //   localChanges[this.config.relationField] = parentRecord._getChanges(parentRecord._changes, {
    //     withReadonly: true,
    //   });
    //   if (!this._parentRecord.isNew) {
    //     localChanges[this.config.relationField].id = this._parentRecord.resId;
    //   }
    // }
    // return this.model._onchange(this.config, {
    //   changes: localChanges,
    //   fieldNames: onChangeFields,
    //   evalContext: toRaw(this.evalContext),
    //   onError: (e) => {
    //     // We apply changes and revert them after to force a render of the Field components
    //     const undoChanges = this._applyChanges(changes);
    //     undoChanges();
    //     throw e;
    //   },
    // });
  }

  // Server / parsing --------------------------------------------------------
  /**
   * @param {RecordType<string, unknown>} serverValues
   * @param {FieldSpecifications} [params]
   */
  _parseServerValues(serverValues: any, { currentValues, orderBys }: any = {}) {
    // const parsedValues = {};
    // if (!serverValues) {
    //   return parsedValues;
    // }
    // for (const fieldName in serverValues) {
    //   const value = serverValues[fieldName];
    //   if (!this.activeFields[fieldName]) {
    //     continue;
    //   }
    //   const field = this.fields[fieldName];
    //   if (field.type === "one2many" || field.type === "many2many") {
    //     let staticList = currentValues?.[fieldName];
    //     let valueIsCommandList = true;
    //     // value can be a list of records or a list of commands (new record)
    //     valueIsCommandList = value.length > 0 && Array.isArray(value[0]);
    //     if (!staticList) {
    //       let data = valueIsCommandList ? [] : value;
    //       if (data.length > 0 && typeof data[0] === "number") {
    //         data = data.map((resId) => ({ id: resId }));
    //       }
    //       staticList = this._createStaticListDatapoint(data, fieldName, { orderBys });
    //       if (valueIsCommandList) {
    //         staticList._applyInitialCommands(value);
    //       }
    //     } else if (valueIsCommandList) {
    //       staticList._applyCommands(value);
    //     }
    //     parsedValues[fieldName] = staticList;
    //   } else {
    //     parsedValues[fieldName] = parseServerValue(field, value);
    //     if (field.type === "properties") {
    //       const parent = serverValues[field.definition_record];
    //       Object.assign(
    //         parsedValues,
    //         this._processProperties(parsedValues[fieldName], fieldName, parent, currentValues)
    //       );
    //     }
    //   }
    // }
    // return parsedValues;
  }
  // Server / serialization --------------------------------------------------
  _formatServerValue(fieldType: string, value: any) {
    // if (fieldType === "date") {
    //   return value ? serializeDate(value) : false;
    // } else if (fieldType === "datetime") {
    //   return value ? serializeDateTime(value) : false;
    // } else if (fieldType === "char" || fieldType === "text") {
    //   return value !== "" ? value : false;
    // } else if (fieldType === "html") {
    //   return value && value.length ? value : false;
    // } else if (fieldType === "many2one") {
    //   return value ? value.id : false;
    // } else if (fieldType === "many2one_reference") {
    //   return value ? value.resId : 0;
    // } else if (fieldType === "reference") {
    //   return value && value.resModel && value.resId ? `${value.resModel},${value.resId}` : false;
    // } else if (fieldType === "properties") {
    //   return value.map((property) => {
    //     property = { ...property };
    //     for (const key of ["value", "default"]) {
    //       let value;
    //       if (property.type === "many2one") {
    //         value = property[key] && [property[key].id, property[key].display_name];
    //       } else if (
    //         (property.type === "date" || property.type === "datetime") &&
    //         typeof property[key] === "string"
    //       ) {
    //         // TO REMOVE: need refactoring PropertyField to use the same format as the server
    //         value = property[key];
    //       } else if (property[key] !== undefined) {
    //         value = this._formatServerValue(property.type, property[key]);
    //       }
    //       property[key] = value;
    //     }
    //     return property;
    //   });
    // }
    // return value;
  }

  // Server / checks ---------------------------------------------------------
  async checkValidity({ displayNotification }: any = {}) {
    coucou("checkValidity");
    return true;
    // if (!this._urgentSave) {
    //   await this.model._askChanges();
    // }
    // return this._checkValidity({ displayNotification });
  }
  _checkValidity({ silent, displayNotification, removeInvalidOnly }: any = {}) {
    // const unsetRequiredFields = new Set();
    // for (const fieldName in this.activeFields) {
    //   const fieldType = this.fields[fieldName].type;
    //   if (this._isInvisible(fieldName) || this.fields[fieldName].relatedPropertyField) {
    //     continue;
    //   }
    //   switch (fieldType) {
    //     case "boolean":
    //     case "float":
    //     case "integer":
    //     case "monetary":
    //       continue;
    //     case "html":
    //       if (this._isRequired(fieldName) && this.data[fieldName].length === 0) {
    //         unsetRequiredFields.add(fieldName);
    //       }
    //       break;
    //     case "one2many":
    //     case "many2many": {
    //       const list = this.data[fieldName];
    //       if (
    //         (this._isRequired(fieldName) && !list.count) ||
    //         !list.records.every((r) => !r.dirty || r._checkValidity({ silent, removeInvalidOnly }))
    //       ) {
    //         unsetRequiredFields.add(fieldName);
    //       }
    //       break;
    //     }
    //     case "properties": {
    //       const value = this.data[fieldName];
    //       if (value) {
    //         const ok = value.every(
    //           (propertyDefinition) =>
    //             propertyDefinition.name &&
    //             propertyDefinition.name.length &&
    //             propertyDefinition.string &&
    //             propertyDefinition.string.length
    //         );
    //         if (!ok) {
    //           unsetRequiredFields.add(fieldName);
    //         }
    //       }
    //       break;
    //     }
    //     case "json": {
    //       if (
    //         this._isRequired(fieldName) &&
    //         (!this.data[fieldName] || !Object.keys(this.data[fieldName]).length)
    //       ) {
    //         unsetRequiredFields.add(fieldName);
    //       }
    //       break;
    //     }
    //     default:
    //       if (!this.data[fieldName] && this._isRequired(fieldName)) {
    //         unsetRequiredFields.add(fieldName);
    //       }
    //   }
    // }
    // if (silent) {
    //   return !unsetRequiredFields.size;
    // }
    // if (removeInvalidOnly) {
    //   for (const fieldName of Array.from(this._unsetRequiredFields)) {
    //     if (!unsetRequiredFields.has(fieldName)) {
    //       this._unsetRequiredFields.delete(fieldName);
    //       this._invalidFields.delete(fieldName);
    //     }
    //   }
    // } else {
    //   for (const fieldName of Array.from(this._unsetRequiredFields)) {
    //     this._invalidFields.delete(fieldName);
    //   }
    //   this._unsetRequiredFields.clear();
    //   for (const fieldName of unsetRequiredFields) {
    //     this._unsetRequiredFields.add(fieldName);
    //     this._invalidFields.add(fieldName);
    //   }
    // }
    // const isValid = !this._invalidFields.size;
    // if (!isValid && displayNotification) {
    //   this._closeInvalidFieldsNotification = this._displayInvalidFieldNotification();
    // }
    // return isValid;
  }
  /**
   * @param {string} fieldName
   */
  isFieldInvalid(fieldName: string) {
    return false;
    // return this._invalidFields.has(fieldName);
  }
  /**
   * @param {string} fieldName
   */
  async setInvalidField(fieldName: string) {
    // this.dirty = true;
    // return this._setInvalidField(fieldName);
  }
  async _setInvalidField(fieldName: string) {
    // // what is this ?
    // const canProceed = this.model.hooks.onWillSetInvalidField(this, fieldName);
    // if (canProceed === false) {
    //   return;
    // }
    // if (toRaw(this._invalidFields).has(fieldName)) {
    //   return;
    // }
    // this._invalidFields.add(fieldName);
    // if (this.selected && this.model.multiEdit && this.model.root._recordToDiscard !== this) {
    //   this._displayInvalidFieldNotification();
    //   await this.discard();
    //   this.switchMode("readonly");
    // }
  }
  /**
   * @param {string} fieldName
   */
  async resetFieldValidity(fieldName: string) {
    // this.dirty = true;
    // return this._resetFieldValidity(fieldName);
  }
  _resetFieldValidity(fieldName: string) {
    // this._invalidFields.delete(fieldName);
  }
  _removeInvalidFields(...fieldNames: string[]) {
    // for (const fieldName of fieldNames) {
    //   this._invalidFields.delete(fieldName);
    // }
  }

  _displayInvalidFieldNotification() {
    // return this.model.notification.add(_t("Missing required fields"), { type: "danger" });
  }

  // Data management / setters -------------------------------------------------

  _setData(data: Record<string, any>, { orderBys, keepChanges }: any = {}) {
    // this._isEvalContextReady = false;
    // if (this.resId) {
    //     this._values = this._parseServerValues(data, { orderBys });
    //     Object.assign(this._textValues, this._getTextValues(data));
    // } else {
    //     const allVals = { ...this._getDefaultValues(), ...data };
    //     this._values = markRaw(this._parseServerValues(allVals, { orderBys }));
    //     Object.assign(this._textValues, this._getTextValues(allVals));
    // }
    // if (!keepChanges) {
    //     this._changes = markRaw({});
    // }
    // this.dirty = false;
    // deleteKeys(this.orecord.reactiveData);
    // Object.assign(this.orecord.reactiveData, this._values, this._changes);
    // this.data = {};
    // makeGetSet(this.data, Object.keys(this.orecord.reactiveData), this.orecord.reactiveData);
    // this._setEvalContext();
    // // this._initialTextValues = { ...this._textValues };
    // // this._invalidFields.clear();
    // if (!this.isNew && this.isInEdition && !this._parentRecord) {
    //     this._checkValidity();
    // }
    // this._savePoint = undefined;
    // window.d = true;
  }
  _applyValues(values: Record<string, any>) {
    // const newValues = this._parseServerValues(values);
    // Object.assign(this._values, newValues);
    // for (const fieldName in newValues) {
    //     if (fieldName in this._changes) {
    //         if (["one2many", "many2many"].includes(this.fields[fieldName].type)) {
    //             this._changes[fieldName] = newValues[fieldName];
    //         }
    //     }
    // }
    // Object.assign(this.data, this._values, this._changes);
    // const textValues = this._getTextValues(values);
    // Object.assign(this._initialTextValues, textValues);
    // Object.assign(this._textValues, textValues, this._getTextValues(this._changes));
    // this._setEvalContext();
  }
  _applyChanges(changes: Record<string, any>, serverChanges = {}) {
    // // We need to generate the undo function before applying the changes
    // const initialTextValues = { ...this._textValues };
    // const initialChanges = { ...this._changes };
    // const initialData = { ...toRaw(this.data) };
    // const invalidFields = [...toRaw(this._invalidFields)];
    // const undoChanges = () => {
    //     for (const fieldName of invalidFields) {
    //         this.setInvalidField(fieldName);
    //     }
    //     Object.assign(this.data, initialData);
    //     this._changes = markRaw(initialChanges);
    //     Object.assign(this._textValues, initialTextValues);
    //     this._setEvalContext();
    // };
    //
    // // Apply changes
    // for (const fieldName in changes) {
    //     let change = changes[fieldName];
    //     // todo: what is this?
    //     if (change instanceof Operation) {
    //         change = change.compute(this.data[fieldName]);
    //     }
    //     // this._changes[fieldName] = change;
    //     // this.data[fieldName] = change;
    //     if (this.fields[fieldName].type === "html") {
    //         this._textValues[fieldName] = change === false ? false : change.toString();
    //     } else if (["char", "text"].includes(this.fields[fieldName].type)) {
    //         this._textValues[fieldName] = change;
    //     }
    // }
    //
    // // Apply server changes
    // const parsedChanges = this._parseServerValues(serverChanges, { currentValues: this.data });
    // for (const fieldName in parsedChanges) {
    //     this._changes[fieldName] = parsedChanges[fieldName];
    //     this.data[fieldName] = parsedChanges[fieldName];
    // }
    // Object.assign(this._textValues, this._getTextValues(serverChanges));
    // this._setEvalContext();
    // mark changed fields as valid if they were not, and re-evaluate required attributes
    // for all fields, as some of them might still be unset but become valid with those changes
    // this._removeInvalidFields(...Object.keys(changes), ...Object.keys(serverChanges));
    // this._checkValidity({ removeInvalidOnly: true });
    // return undoChanges;
  }

  // Server / default values -------------------------------------------------
  _applyDefaultValues() {
    // const fieldNames = this.fieldNames.filter((fieldName) => !(fieldName in this.data));
    // const defaultValues = this._getDefaultValues(fieldNames);
    // if (this.isNew) {
    //     this._applyChanges({}, defaultValues);
    // } else {
    //     this._applyValues(defaultValues);
    // }
  }
  _getDefaultValues(fieldNames = this.fieldNames) {
    // const defaultValues = {};
    // for (const fieldName of fieldNames) {
    //   switch (this.fields[fieldName].type) {
    //     case "integer":
    //     case "float":
    //     case "monetary":
    //       defaultValues[fieldName] = fieldName === "id" ? false : 0;
    //       break;
    //     case "one2many":
    //     case "many2many":
    //       defaultValues[fieldName] = [];
    //       break;
    //     default:
    //       defaultValues[fieldName] = false;
    //   }
    // }
    // return defaultValues;
  }

  // Server / properties -----------------------------------------------------
  /**
   * This function extracts all properties and adds them to fields and activeFields.
   *
   * @param {Object[]} properties the list of properties to be extracted
   * @param {string} fieldName name of the field containing the properties
   * @param {Array} parent Array with ['id, 'display_name'], representing the record to which the definition of properties is linked
   * @param {Object} currentValues current values of the record
   * @returns An object containing as key `${fieldName}.${property.name}` and as value the value of the property
   */
  _processProperties(
    properties: Array<any>,
    fieldName: string,
    parent: Array<any>,
    currentValues: Object = {}
  ) {
    // const data = {};
    // const hasCurrentValues = Object.keys(currentValues).length > 0;
    // for (const property of properties) {
    //   const propertyFieldName = `${fieldName}.${property.name}`;
    //   // Add Unknown Property Field and ActiveField
    //   if (hasCurrentValues || !this.fields[propertyFieldName]) {
    //     this.fields[propertyFieldName] = {
    //       ...property,
    //       name: propertyFieldName,
    //       relatedPropertyField: {
    //         name: fieldName,
    //       },
    //       propertyName: property.name,
    //       relation: property.comodel,
    //       sortable: !["many2one", "many2many", "tags"].includes(property.type),
    //     };
    //   }
    //   if (hasCurrentValues || !this.activeFields[propertyFieldName]) {
    //     this.activeFields[propertyFieldName] = createPropertyActiveField(property);
    //   }
    //   if (!this.activeFields[propertyFieldName].relatedPropertyField) {
    //     this.activeFields[propertyFieldName].relatedPropertyField = {
    //       name: fieldName,
    //       id: parent?.id,
    //       displayName: parent?.display_name,
    //     };
    //   }
    //   // Extract property data
    //   if (property.type === "many2many") {
    //     let staticList = currentValues[propertyFieldName];
    //     if (!staticList) {
    //       staticList = this._createStaticListDatapoint(
    //         (property.value || []).map((record) => ({
    //           id: record[0],
    //           display_name: record[1],
    //         })),
    //         propertyFieldName
    //       );
    //     }
    //     data[propertyFieldName] = staticList;
    //   } else if (property.type === "many2one") {
    //     data[propertyFieldName] =
    //       property.value && property.value.display_name === null
    //         ? { id: property.value.id, display_name: _t("No Access") }
    //         : property.value;
    //   } else {
    //     data[propertyFieldName] = property.value ?? false;
    //   }
    // }
    // return data;
  }

  // Server / preprocessing ? what is that -----------------------------------
  async _preprocessMany2oneChanges(changes: any) {
    // const proms = Object.entries(changes)
    //   .filter(([fieldName]) => this.fields[fieldName].type === "many2one")
    //   .map(async ([fieldName, value]) => {
    //     if (!value) {
    //       changes[fieldName] = false;
    //     } else if (!this.activeFields[fieldName]) {
    //       changes[fieldName] = value;
    //     } else {
    //       const relation = this.fields[fieldName].relation;
    //       return this._completeMany2OneValue(value, fieldName, relation).then((v) => {
    //         changes[fieldName] = v;
    //       });
    //     }
    //   });
    // return Promise.all(proms);
  }

  async _preprocessMany2OneReferenceChanges(changes: any) {
    // const proms = Object.entries(changes)
    //   .filter(([fieldName]) => this.fields[fieldName].type === "many2one_reference")
    //   .map(async ([fieldName, value]) => {
    //     if (!value) {
    //       changes[fieldName] = false;
    //     } else if (typeof value === "number") {
    //       // Many2OneReferenceInteger field only manipulates the id
    //       changes[fieldName] = { resId: value };
    //     } else {
    //       const relation = this.data[this.fields[fieldName].model_field];
    //       return this._completeMany2OneValue(
    //         { id: value.resId, display_name: value.displayName },
    //         fieldName,
    //         relation
    //       ).then((v) => {
    //         changes[fieldName] = { resId: v.id, displayName: v.display_name };
    //       });
    //     }
    //   });
    // return Promise.all(proms);
  }

  async _preprocessReferenceChanges(changes: any) {
    // const proms = Object.entries(changes)
    //   .filter(([fieldName]) => this.fields[fieldName].type === "reference")
    //   .map(async ([fieldName, value]) => {
    //     if (!value) {
    //       changes[fieldName] = false;
    //     } else {
    //       return this._completeMany2OneValue(
    //         { id: value.resId, display_name: value.displayName },
    //         fieldName,
    //         value.resModel
    //       ).then((v) => {
    //         changes[fieldName] = {
    //           resId: v.id,
    //           resModel: value.resModel,
    //           displayName: v.display_name,
    //         };
    //       });
    //     }
    //   });
    // return Promise.all(proms);
  }

  async _preprocessX2manyChanges(changes: any) {
    // for (const [fieldName, value] of Object.entries(changes)) {
    //   if (
    //     this.fields[fieldName].type !== "one2many" &&
    //     this.fields[fieldName].type !== "many2many"
    //   ) {
    //     continue;
    //   }
    //   const list = this.data[fieldName];
    //   for (const command of value) {
    //     switch (command[0]) {
    //       case x2ManyCommands.SET:
    //         await list._replaceWith(command[2]);
    //         break;
    //       default:
    //         await list._applyCommands([command]);
    //     }
    //   }
    //   changes[fieldName] = list;
    // }
  }

  _preprocessPropertiesChanges(changes: any) {
    // for (const [fieldName, value] of Object.entries(changes)) {
    //   const field = this.fields[fieldName];
    //   if (field.type === "properties") {
    //     const parent = changes[field.definition_record] || this.data[field.definition_record];
    //     Object.assign(changes, this._processProperties(value, fieldName, parent, this.data));
    //   } else if (field && field.relatedPropertyField) {
    //     const [propertyFieldName, propertyName] = field.name.split(".");
    //     const propertiesData = this.data[propertyFieldName] || [];
    //     if (!propertiesData.find((property) => property.name === propertyName)) {
    //       // try to change the value of a properties that has a different parent
    //       this.model.notification.add(
    //         _t("This record belongs to a different parent so you can not change this property."),
    //         { type: "warning" }
    //       );
    //       return;
    //     }
    //     changes[propertyFieldName] = propertiesData.map((property) =>
    //       property.name === propertyName ? { ...property, value } : property
    //     );
    //   }
    // }
  }

  _preprocessHtmlChanges(changes: any) {
    // for (const [fieldName, value] of Object.entries(changes)) {
    //   if (this.fields[fieldName].type === "html") {
    //     changes[fieldName] = value === false ? false : markup(value);
    //   }
    // }
  }
  /**
   * Given a possibily incomplete value for a many2one field (i.e. a object { id, display_name } but
   * with id and/or display_name being undefined), return the complete value as follows:
   *  - if a display_name is given but no id, perform a name_create to get an id
   *  - if an id is given but display_name is undefined, call web_read to get the display_name
   *  - if both id and display_name are given, return the value as is
   *  - in any other cases, return false
   *
   * @param {{ id?: number; display_name?: string }} value
   * @param {string} fieldName
   * @param {string} resModel
   * @returns {Promise<false | { id: number; display_name: string; }>} the completed record { id, display_name } or false
   */
  async _completeMany2OneValue(
    value: { id?: number; display_name?: string },
    fieldName: string,
    resModel: string
  ) {
    // const resId = value.id;
    // const displayName = value.display_name;
    // // why check for displayName?
    // if (!resId && !displayName) {
    //   return false;
    // }
    // const context = getFieldContext(this, fieldName);
    // if (!resId && displayName !== undefined) {
    //   const pair = await this.model.orm.call(resModel, "name_create", [displayName], {
    //     context,
    //   });
    //   return pair && { id: pair[0], display_name: pair[1] };
    // }
    // if (resId && displayName === undefined) {
    //   const fieldSpec = { display_name: {} };
    //   if (this.activeFields[fieldName].related) {
    //     Object.assign(
    //       fieldSpec,
    //       getFieldsSpec(
    //         this.activeFields[fieldName].related.activeFields,
    //         this.activeFields[fieldName].related.fields,
    //         getBasicEvalContext(this.config)
    //       )
    //     );
    //   }
    //   const kwargs = {
    //     context,
    //     specification: fieldSpec,
    //   };
    //   const records = await this.model.orm.webRead(resModel, [resId], kwargs);
    //   return records[0];
    // }
    // return value;
  }

  // Actions -----------------------------------------------------------------
  async discard() {
    coucou("discard");
    // if (this.model._closeUrgentSaveNotification) {
    //   this.model._closeUrgentSaveNotification();
    // }
    // await this.model._askChanges();
    // return this.model.mutex.exec(() => this._discard());
  }
  _discard() {
    // todo: discard
    // for (const fieldName in this._changes) {
    //     if (["one2many", "many2many"].includes(this.fields[fieldName].type)) {
    //         this._changes[fieldName]._discard();
    //     }
    // }
    // if (this._savePoint) {
    //     this.dirty = this._savePoint.dirty;
    //     this._changes = markRaw({ ...this._savePoint.changes });
    //     this._textValues = markRaw({ ...this._savePoint.textValues });
    // } else {
    //     this.dirty = false;
    //     this._changes = markRaw({});
    //     this._textValues = markRaw({ ...this._initialTextValues });
    // }
    // this.data = { ...this._values, ...this._changes };
    // this._savePoint = undefined;
    // this._setEvalContext();
    // this._invalidFields.clear();
    // if (!this.isNew) {
    //     this._checkValidity();
    // }
    // this._closeInvalidFieldsNotification();
    // this._closeInvalidFieldsNotification = () => {};
    // this._restoreActiveFields();
  }

  duplicate() {
    coucou("duplicate");
    // return this.model.mutex.exec(async () => {
    //   const kwargs = { context: this.context };
    //   const index = this.resIds.indexOf(this.resId);
    //   const [resId] = await this.model.orm.call(this.resModel, "copy", [[this.resId]], kwargs);
    //   const resIds = this.resIds.slice();
    //   resIds.splice(index + 1, 0, resId);
    //   await this.model.load({ resId, resIds, mode: "edit" });
    // });
  }
  delete() {
    coucou("delete");
    // return this.model.mutex.exec(async () => {
    //   const unlinked = await this.model.orm.unlink(this.resModel, [this.resId], {
    //     context: this.context,
    //   });
    //   if (!unlinked) {
    //     return false;
    //   }
    //   const resIds = this.resIds.slice();
    //   const index = resIds.indexOf(this.resId);
    //   resIds.splice(index, 1);
    //   const resId = resIds[Math.min(index, resIds.length - 1)] || false;
    //   if (resId) {
    //     await this.model.load({ resId, resIds });
    //   } else {
    //     this.model._updateConfig(this.config, { resId: false }, { reload: false });
    //     this.dirty = false;
    //     this._changes = markRaw({});
    //     this._values = markRaw(this._parseServerValues(this._getDefaultValues()));
    //     this._textValues = markRaw({});
    //     this.data2 = { ...this._values };
    //     this._setEvalContext();
    //   }
    // });
  }

  // Actions - archive/unarchive ---------------------------------------------
  archive() {
    coucou("archive");
    // return this.model.mutex.exec(() => this._toggleArchive(true));
  }
  unarchive() {
    coucou("unarchive");
    // return this.model.mutex.exec(() => this._toggleArchive(false));
  }
  async _toggleArchive(state: boolean) {
    // const method = state ? "action_archive" : "action_unarchive";
    // const action = await this.model.orm.call(this.resModel, method, [[this.resId]], {
    //   context: this.context,
    // });
    // if (action && Object.keys(action).length) {
    //   this.model.action.doAction(action, { onClose: () => this._load() });
    // } else {
    //   return this._load();
    // }
  }

  // Should not be necessary -------------------------------------------------

  _getTextValues(values: any) {
    // const textValues = {};
    // for (const fieldName in values) {
    //   if (!this.activeFields[fieldName]) {
    //     continue;
    //   }
    //   if (["char", "text", "html"].includes(this.fields[fieldName].type)) {
    //     textValues[fieldName] = values[fieldName];
    //   }
    // }
    // return textValues;
  }

  _addSavePoint() {
    // this._savePoint = markRaw({
    //     dirty: this.dirty,
    //     textValues: { ...this._textValues },
    //     changes: { ...this._changes },
    // });
    // for (const fieldName in this._changes) {
    //     if (["one2many", "many2many"].includes(this.fields[fieldName].type)) {
    //         this._changes[fieldName]._addSavePoint();
    //     }
    // }
  }

  _createStaticListDatapoint(data: any, fieldName: string, { orderBys }: any = {}) {
    //     const { related, limit, defaultOrderBy } = this.activeFields[fieldName];
    //     const relatedActiveFields = (related && related.activeFields) || {};
    //     const config = {
    //       resModel: this.fields[fieldName].relation,
    //       activeFields: relatedActiveFields,
    //       fields: (related && related.fields) || {},
    //       relationField: this.fields[fieldName].relation_field || false,
    //       offset: 0,
    //       resIds: data.map((r) => r.id),
    //       orderBy: orderBys?.[fieldName] || defaultOrderBy || [],
    //       limit: limit || (Object.keys(relatedActiveFields).length ? Number.MAX_SAFE_INTEGER : 1),
    //       context: {}, // will be set afterwards, see "_updateContext" in "_setEvalContext"
    //     };
    //     const options = {
    //       onUpdate: ({ withoutOnchange } = {}) =>
    //         this._update({ [fieldName]: [] }, { withoutOnchange }),
    //       parent: this,
    //     };
    //     return new this.model.constructor.StaticList(this.model, config, data, options);
  }
}

export function makeFieldObject(record: any, orecord: Model) {
  const Mod = orecord.constructor as typeof Model;
  const fields = Mod.fields;
  const prototype = Object.create(null);
  const fieldObject = Object.create(prototype);
  for (const field of Object.values(fields)) {
    const { fieldName, type } = field;
    switch (type) {
      case "one2many":
        defineLazyProperty(prototype, fieldName, (obj: any) => {
          const staticConfig: StaticListConfig = {
            parentRecord: record,
            orecord,
            fieldName,
            makeWebRecord,
            // resModel: ,
            // activeFields: ,
            // fields: ,

            // relationField: ,
            // resIds: ,
            //
            // offset: 0,
            // orderBy: [],
            // limit: 100,
            //
            // context: {},
          };
          const staticList = new StaticList(staticConfig);
          return [() => staticList] as const;
        });
        break;
      case "many2one":
        Object.defineProperty(fieldObject, fieldName, {
          get() {
            return (orecord as any)[fieldName];
          },
          set(value: any) {
            (orecord as any)[fieldName] = value;
          },
          enumerable: true,
        });
        break;
      case "many2many":
        break;
      default:
        Object.defineProperty(fieldObject, fieldName, {
          get() {
            return (orecord as any)[fieldName];
          },
          set(value: any) {
            (orecord as any)[fieldName] = value;
          },
          enumerable: true,
        });
        break;
    }
  }
  return fieldObject;
}

function coucou(s: string) {
  console.warn(s);
  return s;
}
