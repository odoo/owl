// -----------------------------------------------------------------------------
//  Status
// -----------------------------------------------------------------------------

export const STATUS = {
  NEW: 0,
  MOUNTED: 1, // is ready, and in DOM. It has a valid el
  DESTROYED: 2,
} as const;
export type StatusValue = (typeof STATUS)[keyof typeof STATUS];
