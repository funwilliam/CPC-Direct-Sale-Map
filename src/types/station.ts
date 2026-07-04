// 鏡射 scripts/schema（zod 為管線契約；app 端用純型別避免把 zod 打進 bundle）

export interface Fuels {
  g92: boolean;
  g95: boolean;
  g98: boolean;
  diesel: boolean;
}

export interface Station {
  id: string;
  name: string;
  county: string;
  town: string;
  address: string;
  phone: string;
  lat: number;
  lng: number;
  fuels: Fuels;
  isDirect: boolean;
  hours: string;
  isOpen: boolean;
}

export interface StationsFile {
  generatedAt: string;
  source: string;
  directCount: number;
  franchiseCount: number;
  stations: Station[];
}

export interface PriceEntry {
  date: string;
  g92: number;
  g95: number;
  g98: number;
  diesel: number;
}

export interface CurrentPriceFile {
  generatedAt: string;
  source: string;
  current: PriceEntry;
}

export interface PriceHistoryFile {
  generatedAt: string;
  source: string;
  entries: PriceEntry[];
}

export const FUEL_LABELS: Record<keyof Fuels, string> = {
  g92: '92 無鉛',
  g95: '95 無鉛',
  g98: '98 無鉛',
  diesel: '超級柴油',
};
