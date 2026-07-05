import { z } from 'zod';

/** openData MainProdListPrice 原始紀錄 */
export const RawPriceSchema = z
  .object({
    型別名稱: z.string(),
    產品名稱: z.string(),
    參考牌價_金額: z.number(),
    牌價生效日期: z.string(), // 民國格式 YYYMMDD，如 "1150629"
  })
  .loose();

export type RawPrice = z.infer<typeof RawPriceSchema>;

/** 單一生效日的四油品牌價（元/公升） */
export const PriceEntrySchema = z.object({
  /** ISO 日期 YYYY-MM-DD（牌價生效日） */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  g92: z.number().positive(),
  g95: z.number().positive(),
  g98: z.number().positive(),
  diesel: z.number().positive(),
});

export type PriceEntry = z.infer<typeof PriceEntrySchema>;

export const CurrentPriceFileSchema = z.object({
  generatedAt: z.string(),
  source: z.string(),
  current: PriceEntrySchema,
});

export const PriceHistoryFileSchema = z.object({
  generatedAt: z.string(),
  source: z.string(),
  /** 依 date 由舊到新排序，date 不重複 */
  entries: z.array(PriceEntrySchema).min(1),
});

export type PriceHistoryFile = z.infer<typeof PriceHistoryFileSchema>;

/** 民國 YY(Y)MMDD → ISO YYYY-MM-DD（民國 2-3 位年皆可） */
export function rocToIso(roc: string): string {
  const m = roc.trim().match(/^(\d{2,3})(\d{2})(\d{2})$/);
  if (!m) throw new Error(`無法解析民國日期: "${roc}"`);
  const year = Number(m[1]) + 1911;
  return `${year}-${m[2]}-${m[3]}`;
}
