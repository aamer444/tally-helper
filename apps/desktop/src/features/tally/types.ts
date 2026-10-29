export interface Company {
  name: string;
  guid: string;
  stateName: string;
  booksFrom: string; // YYYYMMDD
}

export interface Ledger {
  name: string;
  parent: string;
  gstin: string;
  stateName: string;
  isBillWise: boolean;
}
