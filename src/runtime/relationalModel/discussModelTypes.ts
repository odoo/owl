import { DiscussRecord } from "./discussModel";

export type FieldCommonParams = {
  compute?: (record: DiscussRecord) => any;
  eager?: boolean;
  onUpdate?: (record: DiscussRecord) => void;
};
export type RelationParams = FieldCommonParams & {
  inverse?: string;
  onAdd?: (record: DiscussRecord) => void;
  onDelete?: (record: DiscussRecord) => void;
};
export type ManyParams = RelationParams & {
  sort?: (a: DiscussRecord, b: DiscussRecord) => number;
};
export type AttrParams = FieldCommonParams & {
  sort?: (a: DiscussRecord, b: DiscussRecord) => number;
  type?: string;
};
export type HtmlParams = FieldCommonParams;
export type DateParams = FieldCommonParams;
export type DatetimeParams = FieldCommonParams;

export type DManyFn<T extends DiscussRecord> = () => T[];
