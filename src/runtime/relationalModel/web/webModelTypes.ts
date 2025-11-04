export interface WebModelConfig {
  isMonoRecord: boolean;
  context: Record<string, any>;
  fieldsToAggregate: string[];
  activeFields?: {
    [key: string]: ActiveFieldInfo;
  };
  fields: {
    [key: string]: FieldInfo;
  };
  isRoot: boolean;
  resModel: string;
  groupBy: string[];
  resId?: number | false;
  resIds?: number[];
  mode?: "edit" | "readonly";
  domain: any[]; // Domain type might need more specific definition
  orderBy: OrderBy[];
  groups?: Record<string, any>;
  offset: number;
  limit: number;
  countLimit: number;
  currentGroups?: {
    params: string;
    groups: any[]; // More specific type if possible
  };
  loadId?: string;
  openGroupsByDefault?: boolean;
  [key: string]: any; // Allow other properties
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

export interface WebModelConfigContext {
  default_is_company: boolean;
  lang: string;
  tz: string;
  uid: number;
  allowed_company_ids: number[];
}

// Define types for parameters and configurations based on usage
export interface RelationalModelParams {
  config: {
    activeFields: {
      [key: string]: ActiveFieldInfo;
    };
    [key: string]: any;
  };
  limit?: number;
  groupsLimit?: number;
  countLimit?: number;
  defaultOrderBy?: OrderBy[];
  maxGroupByDepth?: number;
  groupByInfo?: Record<string, any>;
  multiEdit?: boolean;
  activeIdsLimit?: number;
  state?: {
    specialDataCaches?: Record<string, any>;
  };
  useSendBeaconToSaveUrgently?: boolean;
  hooks?: Partial<RelationalModelHooks>;
  [key: string]: any; // Allow other properties
}

export interface OrderBy {
  name: string;
  asc?: boolean;
}

export interface SearchParams {
  context?: Record<string, any>;
  resId?: number | false;
  resIds?: number[];
  domain?: any[];
  groupBy?: string[];
  orderBy?: OrderBy[];
  limit?: number;
  offset?: number;
  countLimit?: number;
}

export interface Services {
  action: any; // Define ActionService type
  dialog: any; // Define DialogService type
  notification: any; // Define NotificationService type
  orm: any; // Define ORMService type
}

export interface OnChangeParams {
  changes?: Record<string, any>;
  fieldNames?: string[];
  evalContext?: Record<string, any>;
  onError?: (error: any) => void;
  cache?: any;
}

export interface RelationalModelHooks {
  onWillLoadRoot: (config: WebModelConfig) => Promise<void>;
  onRootLoaded: (root: any) => Promise<void>; // DataPoint type
  onWillDisplayOnchangeWarning: (warning: any) => Promise<void>;
}
