import { derived } from "../../signals";
import { Model } from "../model";
import { loadRecordWithRelated } from "../store";
import { DraftContext, InstanceId, ManyFn } from "../types";
import { DataPoint } from "./WebDataPoint";
import { MakeWebRecord, WebRecord } from "./WebRecord";

export type StaticListConfig = {
  parentRecord: any;
  orecord: Model;
  fieldName: string;
  makeWebRecord: MakeWebRecord;
};
export type MakeNewRecordParams = {
  activeFields: Object;
  fields: Object;
  context?: Object;
  withoutParent?: boolean;
  mode?: string;
};

export class StaticList extends DataPoint {
  _records!: () => WebRecord[];
  orecordList!: ManyFn<Model>;
  _webRecords: Record<InstanceId, WebRecord> = {};
  _draftRecord: Map<InstanceId, WebRecord> = new Map();
  draftContext: DraftContext = {
    store: {},
  };
  draftORecord!: Model;

  constructor(public sconfig: StaticListConfig) {
    super();
    this._constructor(sconfig);
  }

  _constructor(sconfig: StaticListConfig): void {
    const parent = sconfig.parentRecord;
    const fieldName = sconfig.fieldName;
    const { related, limit, defaultOrderBy } = parent.activeFields[fieldName];
    const relatedActiveFields = (related && related.activeFields) || {};
    const config = {
      resModel: parent.fields[fieldName].relation,
      activeFields: relatedActiveFields,
      fields: (related && related.fields) || {},
      relationField: parent.fields[fieldName].relation_field || false,
      offset: 0,
      // resIds: data.map((r) => r.id),
      // orderBy: orderBys?.[fieldName] || defaultOrderBy || [],
      orderBy: defaultOrderBy || [],
      limit: limit || (Object.keys(relatedActiveFields).length ? Number.MAX_SAFE_INTEGER : 1),
      context: {}, // will be set afterwards, see "_updateContext" in "_setEvalContext"
    };
    this.model = parent.model;
    this._config = config;

    this.draftORecord = sconfig.orecord.makeDraft();
    (this.draftORecord.draftContext as any).name = "staticlist";
    this.orecordList = (sconfig.orecord as any)[sconfig.fieldName] as ManyFn<Model>;
    this._defineRecords();
  }
  _defineRecords() {
    // const Mod = this.sconfig.orecord.constructor as typeof Model;
    // const modelId = Mod.id;

    // return { config } as any;
    this._records = derived(() => this.orecordList().map(this._getRecord.bind(this)));
  }
  _getRecord(record: Model) {
    const id = record.id!;
    if (this._webRecords[id]) return this._webRecords[id];

    const config = {
      context: this.sconfig.parentRecord.context,
      // activeFields: Object.assign({}, params.activeFields || this.activeFields),
      activeFields: Object.assign({}, this.activeFields),
      resModel: this.resModel,
      // fields: params.fields || this.fields,
      fields: this.fields,
      relationField: this.config.relationField,
      resId: id,
      resIds: id ? [id] : [],
      // mode: params.mode || "readonly",
      mode: "readonly",
      isMonoRecord: true,
    };

    const wrecord = this.sconfig.makeWebRecord(this.model, config, undefined, {
      orecord: record,
    });
    this._webRecords[id] = wrecord;
    return wrecord;
  }

  get count() {
    return this._records().length;
  }
  get records() {
    return this._records();
  }

  // List infos - basic --------------------------------------------------------
  get resIds() {
    coucou("resIds");
    return this.orecordList.ids();
  }
  get currentIds() {
    return coucou("currentIds");
  }

  // List infos - config -------------------------------------------------------
  get limit() {
    coucou("limit");
    return 100;
  }
  get offset() {
    coucou("offset");
    return 0;
  }
  get orderBy() {
    coucou("orderBy");
    return [];
  }

  // Context -------------------------------------------------------------------
  get evalContext() {
    coucou("evalContext");
    const win = window as any;
    const evalContext = win.getBasicEvalContext(this.config);
    evalContext.parent = this.sconfig.parentRecord.evalContext;
    return evalContext;
  }

  // Draft ---------------------------------------------------------------------
  async extendRecord(params: MakeNewRecordParams, record: WebRecord) {
    coucou("extendRecord");
    return this.model.mutex.exec(async () => {
      // extend fields and activeFields of the list with those given in params
      completeActiveFields(this.config.activeFields, params.activeFields);
      Object.assign(this.fields, params.fields);
      const activeFields = this._getActiveFields(params);

      if (record) {
        return await this._getDraftRecord(params, record, activeFields);
      } else if (!record) {
        record = await this._makeNewRecord({
          activeFields,
          context: params.context,
          withoutParent: params.withoutParent,
          // manuallyAdded: true,
        });
      }
      return record;
    });
  }
  async _getDraftRecord(
    params: MakeNewRecordParams,
    webrecord: WebRecord,
    activeFields: Record<string, any>
  ) {
    const orecord = webrecord.orecord;
    const config = {
      ...webrecord.config,
      ...params,
      activeFields,
    };

    let draftWebRecord = this._draftRecord.get(orecord.id!);
    if (draftWebRecord) {
      this.model._updateConfig(webrecord.config, config, { reload: false });
      return draftWebRecord;
    }

    let data = {};
    if (!orecord.isNew()) {
      const evalContext = Object.assign({}, webrecord.evalContext, config.context);
      const resIds = [webrecord.resId];
      [data] = await this.model._loadRecords({ ...config, resIds }, evalContext);
      loadRecordWithRelated(orecord.constructor as typeof Model, { id: orecord.id, ...data });
    }
    this.model._updateConfig(webrecord.config, config, { reload: false });
    // webrecord._applyDefaultValues();
    // for (const fieldName in webrecord.activeFields) {
    //   if (["one2many", "many2many"].includes(webrecord.fields[fieldName].type)) {
    //     const list = webrecord.data[fieldName];
    //     const patch = {
    //       activeFields: activeFields[fieldName].related.activeFields,
    //       fields: activeFields[fieldName].related.fields,
    //     };
    //     // todo: what is this?
    //     // for (const subRecord of Object.values(list._cache)) {
    //     //   this.model._updateConfig(subRecord.config, patch, {
    //     //     reload: false,
    //     //   });
    //     // }
    //     this.model._updateConfig(list.config, patch, { reload: false });
    //   }
    // }

    const Mod = orecord.constructor as typeof Model;
    const parentDraftContext = this.sconfig.parentRecord.orecord.draftContext;
    console.warn(`parentDraftContext:`, parentDraftContext);
    const orecordDraft = Mod.get(orecord.id!, this.draftORecord.draftContext);
    console.warn(`orecordDraft.draftContext:`, orecordDraft.draftContext);

    const wrecord = this.sconfig.makeWebRecord(this.model, config, undefined, {
      orecord: orecordDraft,
      mode: "edit",
    });
    console.warn(`wrecord:`, wrecord);
    this._draftRecord.set(orecord.id!, wrecord);
    return wrecord;
  }
  validateExtendedRecord(record: WebRecord) {
    coucou("validateExtendedRecord");
    // let draftWebRecord = this._draftRecord.get(record.orecord.id!)!;
    // draftWebRecord.orecord.saveDraft();
    this.orecordList.add(record.orecord);
    this.draftORecord.saveDraft();
  }
  _getActiveFields(params: MakeNewRecordParams) {
    const activeFields: Record<string, any> = { ...params.activeFields };
    for (const fieldName in this.activeFields) {
      if (fieldName in activeFields) {
        patchActiveFields(activeFields[fieldName], this.activeFields[fieldName]);
      } else {
        activeFields[fieldName] = this.activeFields[fieldName];
      }
    }
    return activeFields;
  }
  async _makeNewRecord(params: any) {
    const changes = {};
    // if (!params.withoutParent && this.config.relationField) {
    //   changes[this.config.relationField] = this._parent._getChanges();
    //   if (!this._parent.isNew) {
    //     changes[this.config.relationField].id = this._parent.resId;
    //   }
    // }
    const values = await this.model._loadNewRecord(
      {
        resModel: this.resModel,
        activeFields: params.activeFields || this.activeFields,
        fields: this.fields,
        context: Object.assign({}, this.context, params.context),
      },
      { changes, evalContext: this.evalContext }
    );

    return this._createRecordDatapoint(values, {
      mode: params.mode || "edit",
      // virtualId: getId("virtual"),
      activeFields: params.activeFields,
      manuallyAdded: params.manuallyAdded,
    });
  }
  _createRecordDatapoint(data: any, params: any = {}) {
    // const resId = data.id || false;
    // if (!resId && !params.virtualId) {
    //   throw new Error("You must provide a virtualId if the record has no id");
    // }
    // const id = resId || params.virtualId;
    const config = {
      context: this.context,
      activeFields: Object.assign({}, params.activeFields || this.activeFields),
      resModel: this.resModel,
      fields: params.fields || this.fields,
      relationField: this.config.relationField,
      // resId,
      // resIds: resId ? [resId] : [],
      mode: params.mode || "readonly",
      isMonoRecord: true,
    };
    // const { CREATE, UPDATE } = x2ManyCommands;
    // const options = {
    //   parentRecord: this._parent,
    //   onUpdate: async ({ withoutParentUpdate }) => {
    //     const id = record.isNew ? record._virtualId : record.resId;
    //     if (!this.currentIds.includes(id)) {
    //       // the record hasn't been added to the list yet (we're currently creating it
    //       // from a dialog)
    //       return;
    //     }
    //     const hasCommand = this._commands.some(
    //       (c) => (c[0] === CREATE || c[0] === UPDATE) && c[1] === id
    //     );
    //     if (!hasCommand) {
    //       this._commands.push([UPDATE, id]);
    //     }
    //     if (record._noUpdateParent) {
    //       // the record is edited from a dialog, so we don't want to notify the parent
    //       // record to be notified at each change inside the dialog (it will be notified
    //       // at the end when the dialog is saved)
    //       return;
    //     }
    //     if (!withoutParentUpdate) {
    //       await this._onUpdate({
    //         withoutOnchange: !record._checkValidity({ silent: true }),
    //       });
    //     }
    //   },
    //   virtualId: params.virtualId,
    //   manuallyAdded: params.manuallyAdded,
    // };
    const webRecord = this.sconfig.makeWebRecord(this.model, config, data, {
      parentRecord: this.sconfig.parentRecord,
      draftContext: this.draftORecord.draftContext,
    });
    this._webRecords[webRecord.orecord.id!] = webRecord;

    return webRecord;
    // this._cache[id] = record;
    // if (!params.dontApplyCommands) {
    //   const commands = this._unknownRecordCommands[id];
    //   if (commands) {
    //     delete this._unknownRecordCommands[id];
    //     this._applyCommands(commands);
    //   }
    // }
  }

  // UI state - editable list --------------------------------------------------
  get editedRecord() {
    coucou("editedRecord");
    return null;
  }
  enterEditMode() {
    coucou("enterEditMode");
  }
  leaveEditMode() {
    coucou("leaveEditMode");
  }

  // UI state - selection ------------------------------------------------------
  get selection() {
    return [];
  }

  // resequencing --------------------------------------------------------------
  canResequence() {
    coucou("canResequence");
  }
  resequence() {
    coucou("resequence");
  }

  // Server / load -------------------------------------------------------------
  load() {
    coucou("load");
  }

  // Re-sort -------------------------------------------------------------------
  sortBy() {
    coucou("sortBy");
  }

  // Mutations -----------------------------------------------------------------
  addNewRecord() {
    coucou("addNewRecord");
  }
  addNewRecordAtIndex() {
    coucou("addNewRecordAtIndex");
  }
  applyCommands() {
    coucou("applyCommands");
  }
  linkTo() {
    coucou("linkTo");
  }
  unlinkFrom() {
    coucou("unlinkFrom");
  }
  forget() {
    coucou("forget");
  }
  moveRecord() {
    coucou("moveRecord");
  }

  addAndRemove() {
    coucou("addAndRemove");
  }

  // Actions -------------------------------------------------------------------
  duplicateRecords() {
    coucou("duplicateRecords");
  }
  delete() {
    coucou("delete");
  }
}

function coucou(s: string) {
  // console.warn(s);
  return s;
}

export function completeActiveFields(
  activeFields: Record<string, any>,
  extraActiveFields: Record<string, any>
) {
  for (const fieldName in extraActiveFields) {
    const extraActiveField = {
      ...extraActiveFields[fieldName],
      invisible: "True",
    };
    if (fieldName in activeFields) {
      completeActiveField(activeFields[fieldName], extraActiveField);
    } else {
      activeFields[fieldName] = extraActiveField;
    }
  }
}
function completeActiveField(activeField: any, extra: any) {
  if (extra.related) {
    for (const fieldName in extra.related.activeFields) {
      if (fieldName in activeField.related.activeFields) {
        completeActiveField(
          activeField.related.activeFields[fieldName],
          extra.related.activeFields[fieldName]
        );
      } else {
        activeField.related.activeFields[fieldName] = {
          ...extra.related.activeFields[fieldName],
        };
      }
    }
    Object.assign(activeField.related.fields, extra.related.fields);
  }
}

function combineModifiers(
  mod1: string | undefined,
  mod2: string | undefined,
  operator: "AND" | "OR"
): string | undefined {
  if (operator === "AND") {
    if (!mod1 || mod1 === "False" || !mod2 || mod2 === "False") {
      return "False";
    }
    if (mod1 === "True") {
      return mod2;
    }
    if (mod2 === "True") {
      return mod1;
    }
    return "(" + mod1 + ") and (" + mod2 + ")";
  } else if (operator === "OR") {
    if (mod1 === "True" || mod2 === "True") {
      return "True";
    }
    if (!mod1 || mod1 === "False") {
      return mod2;
    }
    if (!mod2 || mod2 === "False") {
      return mod1;
    }
    return "(" + mod1 + ") or (" + mod2 + ")";
  }
  throw new Error(
    `Operator provided to "combineModifiers" must be "AND" or "OR", received ${operator}`
  );
}

function patchActiveFields(activeField: any, patch: any) {
  activeField.invisible = combineModifiers(activeField.invisible, patch.invisible, "AND");
  activeField.readonly = combineModifiers(activeField.readonly, patch.readonly, "AND");
  activeField.required = combineModifiers(activeField.required, patch.required, "OR");
  activeField.onChange = activeField.onChange || patch.onChange;
  activeField.forceSave = activeField.forceSave || patch.forceSave;
  activeField.isHandle = activeField.isHandle || patch.isHandle;
  // x2manys
  if (patch.related) {
    const related = activeField.related;
    for (const fieldName in patch.related.activeFields) {
      if (fieldName in related.activeFields) {
        patchActiveFields(related.activeFields[fieldName], patch.related.activeFields[fieldName]);
      } else {
        related.activeFields[fieldName] = { ...patch.related.activeFields[fieldName] };
      }
    }
    Object.assign(related.fields, patch.related.fields);
  }
  if ("limit" in patch) {
    activeField.limit = patch.limit;
  }
  if (patch.defaultOrderBy) {
    activeField.defaultOrderBy = patch.defaultOrderBy;
  }
}
