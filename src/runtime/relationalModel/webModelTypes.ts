export interface MailModelConfig {
  isMonoRecord?: boolean;
  context?: MailModelConfigContext;
  fieldsToAggregate?: any[];
  resModel?: string;
  resId?: number;
  resIds?: number[];
  fields: {
    [key: string]: FieldInfo;
  };
  activeFields?: {
    [key: string]: ActiveFieldInfo;
  };
  mode?: string;
  isRoot?: boolean;
  loadId?: string;
}
export interface FieldInfo {
  change_default?: boolean;
  groupable?: boolean;
  name?: string;
  readonly?: boolean;
  required?: boolean;
  searchable?: boolean;
  sortable?: boolean;
  store?: boolean;
  string?: string;
  type?: string;
  help?: string;
  translate?: boolean;
  trim?: boolean;
  context?: {};
  domain?: any[];
  relation?: string;
  related?: string;
  selection?: Array<[string, string]>;
  groups?: string;
  relation_field?: string;
  aggregator?: string;
  digits?: [number, number];
  size?: number;
  currency_field?: string;
  sanitize?: boolean;
  sanitize_tags?: boolean;
  definition_record?: string;
  definition_record_field?: string;
}

export interface ActiveFieldInfo {
  context: {};
  invisible: string | boolean;
  readonly: string | boolean;
  required: string | boolean;
  onChange: boolean;
  forceSave: boolean;
  isHandle: boolean;
  related?: {
    activeFields: {
      [key: string]: ActiveFieldInfo;
    };
    fields: {
      [key: string]: FieldInfo;
    };
  };
}

export interface MailModelConfigContext {
  default_is_company: boolean;
  lang: string;
  tz: string;
  uid: number;
  allowed_company_ids: number[];
}
