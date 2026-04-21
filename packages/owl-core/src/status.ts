// -----------------------------------------------------------------------------
//  Status
// -----------------------------------------------------------------------------

export const STATUS = {
  NEW: 0,
  MOUNTED: 1, // is ready, and in DOM. It has a valid el
  // component has been created, but has been replaced by a newer component before being mounted
  // it is cancelled until the next animation frame where it will be destroyed
  CANCELLED: 2,
  DESTROYED: 3,
} as const;
export type STATUS = (typeof STATUS)[keyof typeof STATUS];
