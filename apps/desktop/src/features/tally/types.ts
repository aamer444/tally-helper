export interface Company {
  name: string;
  guid: string;
  stateName: string;
  booksFrom: string; // YYYYMMDD
}

export interface StockItem {
  name: string;
  baseUnits: string;
  /** Empty when the item has no HSN code in Tally. */
  hsn?: string;
}

export interface Ledger {
  name: string;
  parent: string;
  gstin: string;
  stateName: string;
  isBillWise: boolean;
}
