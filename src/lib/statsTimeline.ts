/**
 * Load ALL employee rows needed for KP/KGB/pensiun timelines.
 * Cursor-paginated so orgs > 3000 are fully covered.
 */
import { prisma } from "./db.js";

export const TIMELINE_SELECT = {
  id: true,
  nik: true,
  nama: true,
  nip: true,
  status: true,
  gol: true,
  pangkatGolongan: true,
  jabatan: true,
  tanggalBerkalaTerakhir: true,
  tmtKerja: true,
  tmtGolonganRuang: true,
  tanggalLahir: true,
  bupTanggal: true,
  tmtKp: true,
  nomorHp: true,
} as const;

export type TimelineRow = {
  id: string;
  nik: string;
  nama: string;
  nip: string;
  status: string;
  gol: string;
  pangkatGolongan: string;
  jabatan: string;
  tanggalBerkalaTerakhir: string;
  tmtKerja: string;
  tmtGolonganRuang: string;
  tanggalLahir: string;
  bupTanggal: string;
  tmtKp: string;
  nomorHp: string;
};

/** Hard safety against runaway loops / memory (≈50k employees). */
const MAX_ROWS = 50_000;
const PAGE = 1_000;

export async function fetchAllTimelineRows(): Promise<{
  rows: TimelineRow[];
  truncated: boolean;
  totalKnown: number;
}> {
  const totalKnown = await prisma.employee.count();
  const rows: TimelineRow[] = [];
  let cursor: string | undefined;

  for (;;) {
    const batch = await prisma.employee.findMany({
      select: TIMELINE_SELECT,
      orderBy: { id: "asc" },
      take: PAGE,
      ...(cursor
        ? { skip: 1, cursor: { id: cursor } }
        : {}),
    });

    for (const r of batch) {
      rows.push(r as TimelineRow);
    }

    if (batch.length < PAGE) break;
    cursor = batch[batch.length - 1]!.id;
    if (rows.length >= MAX_ROWS) {
      return { rows, truncated: true, totalKnown };
    }
  }

  return {
    rows,
    truncated: rows.length < totalKnown,
    totalKnown,
  };
}
