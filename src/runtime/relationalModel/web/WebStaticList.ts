import { derived } from "../../signals";
import { Model } from "../model";
import { InstanceId, ManyFn } from "../types";
import { DataPoint } from "./WebDataPoint";
import { MakeWebRecord, WebRecord } from "./WebRecord";

export type StaticListConfig = {
  parentRecord: any;
  orecord: Model;
  fieldName: string;
  makeWebRecord: MakeWebRecord;
};

export class StaticList extends DataPoint {
  _records!: () => WebRecord[];
  orecordList!: ManyFn<Model>;

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

    this.orecordList = (sconfig.orecord as any)[sconfig.fieldName] as ManyFn<Model>;
    this._defineRecords();
  }
  _defineRecords() {
    // const Mod = this.sconfig.orecord.constructor as typeof Model;
    // const modelId = Mod.id;
    const _records: Record<InstanceId, WebRecord> = {};
    const getRecord = (record: Model) => {
      const id = record.id!;
      if (_records[id]) return _records[id];

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
      _records[id] = wrecord;
      return wrecord;
      // return { config } as any;
    };
    this._records = derived(() => this.orecordList().map(getRecord));
  }
  get count() {
    return this._records().length;
  }
  get records() {
    return this._records();
  }

  // datapoint  ----------------------------------------------------------------

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

  // resequencing --------------------------------------------------------------
  canResequence() {
    coucou("canResequence");
  }

  // Context -----------------------------------------------------------------
  get evalContext() {
    return coucou("evalContext");
  }

  // UI state - editable list ------------------------------------------------
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

  // UI state - selection ----------------------------------------------------
  get selection() {
    return [];
  }
  // Actions -----------------------------------------------------------------
  duplicateRecords() {
    coucou("duplicateRecords");
  }
  delete() {
    coucou("delete");
  }

  // Server / load -----------------------------------------------------------

  load() {
    coucou("load");
  }

  // Save point --------------------------------------------------------------

  linkTo() {
    coucou("linkTo");
  }
  unlinkFrom() {
    coucou("unlinkFrom");
  }

  // ??? ---------------------------------------------------------------------

  validateExtendedRecord() {
    coucou("validateExtendedRecord");
  }

  // Mutations ---------------------------------------------------------------

  addNewRecord() {
    coucou("addNewRecord");
  }
  addNewRecordAtIndex() {
    coucou("addNewRecordAtIndex");
  }
  applyCommands() {
    coucou("applyCommands");
  }
  extendRecord() {
    coucou("extendRecord");
  }
  forget() {
    coucou("forget");
  }
  moveRecord() {
    coucou("moveRecord");
  }
  sortBy() {
    coucou("sortBy");
  }
  addAndRemove() {
    coucou("addAndRemove");
  }
  resequence() {
    coucou("resequence");
  }
}

function coucou(s: string) {
  console.warn(s);
  return s;
}
