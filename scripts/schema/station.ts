import { z } from 'zod';

/** openData getStationInfo 原始紀錄（僅列管線使用的欄位，其餘 passthrough） */
export const RawStationSchema = z
  .object({
    站代號: z.string().min(1),
    類別: z.enum(['自營站', '加盟站', '漁船站']),
    站名: z.string().min(1),
    縣市: z.string(),
    鄉鎮區: z.string(),
    地址: z.string(),
    電話: z.string(),
    營業中: z.string(),
    無鉛92: z.number(),
    無鉛95: z.number(),
    無鉛98: z.number(),
    超柴: z.number(),
    經度: z.number(),
    緯度: z.number(),
    營業時間: z.string(),
  })
  .loose();

export type RawStation = z.infer<typeof RawStationSchema>;

/** 前端使用的站點格式（stations.json 內容） */
export const StationSchema = z.object({
  id: z.string(),
  name: z.string(),
  county: z.string(),
  town: z.string(),
  /** 完整地址（縣市+鄉鎮區+地址），供顯示與一鍵複製 */
  address: z.string(),
  phone: z.string(),
  lat: z.number().min(21).max(27),
  lng: z.number().min(118).max(123),
  fuels: z.object({
    g92: z.boolean(),
    g95: z.boolean(),
    g98: z.boolean(),
    diesel: z.boolean(),
  }),
  isDirect: z.boolean(),
  hours: z.string(),
  /** 營業中狀態非 "1"（如修繕中）時為 false */
  isOpen: z.boolean(),
});

export type Station = z.infer<typeof StationSchema>;

export const StationsFileSchema = z.object({
  generatedAt: z.string(),
  source: z.string(),
  directCount: z.number().min(500).max(800),
  franchiseCount: z.number().min(1000).max(2000),
  stations: z.array(StationSchema).min(1500).max(2500),
});

export type StationsFile = z.infer<typeof StationsFileSchema>;
