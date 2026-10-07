declare module 'xlsx' {
  export interface CellObject {
    v?: unknown;
    w?: string;
    t?: string;
    z?: string;
  }
  export interface WorkSheet {
    [addr: string]: CellObject | string | undefined;
    '!ref'?: string;
  }
  export interface WorkBook {
    SheetNames: string[];
    Sheets: Record<string, WorkSheet>;
    Workbook?: { WBProps?: { date1904?: boolean } };
  }
  export const SSF: {
    is_date(fmt: string): boolean;
    parse_date_code(v: number, opts?: { date1904?: boolean }): { y: number; m: number; d: number } | null;
  };
  export function read(data: Uint8Array, opts: Record<string, unknown>): WorkBook;
  export function write(wb: WorkBook, opts: Record<string, unknown>): Uint8Array | ArrayBuffer;
  export const utils: {
    decode_range(ref: string): { s: { r: number; c: number }; e: { r: number; c: number } };
    encode_cell(addr: { r: number; c: number }): string;
    encode_range(range: { s: { r: number; c: number }; e: { r: number; c: number } }): string;
    book_new(): WorkBook;
    book_append_sheet(wb: WorkBook, ws: WorkSheet, name: string): void;
  };
}
