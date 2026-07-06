/**
 * ONE-TIME migration: Firestore shared/data/employees + settings → Neon Postgres.
 *
 * USAGE (run locally with tsx):
 *   1. Download your Firebase service account JSON into ./service-account.json
 *      (Firebase console → Project settings → Service accounts → Generate new private key).
 *      This file is gitignored — never commit it.
 *   2. Set DATABASE_URL + DIRECT_URL in .env (Neon connection strings).
 *   3. Run:   npm run migrate:firestore
 *   4. Verify counts in the console output; spot-check a few rows.
 *   5. After verifying, delete service-account.json and uninstall firebase-admin.
 *
 * The script is idempotent-ish: it matches existing Postgres rows by nip/nik
 * and updates them; new rows are created. Re-running is safe.
 */
import { initializeApp, cert, type ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function loadServiceAccount(): ServiceAccount {
  try {
    const raw = readFileSync("./service-account.json", "utf8");
    return JSON.parse(raw) as ServiceAccount;
  } catch {
    throw new Error(
      "service-account.json not found. Download it from Firebase console → Project settings → Service accounts → Generate new private key.",
    );
  }
}

interface FirestoreEmployee {
  id?: string;
  nik?: string;
  nama?: string;
  nip?: string;
  jk?: string;
  tempatLahir?: string;
  tanggalLahir?: string;
  jalanDusun?: string;
  rt?: string;
  rw?: string;
  desaKelurahan?: string;
  kecamatan?: string;
  kabupaten?: string;
  jabatan?: string;
  bidang?: string;
  status?: string;
  tmtKerja?: string;
  pangkat?: string;
  gol?: string;
  pangkatGolongan?: string;
  tmtGolonganRuang?: string;
  masaKerjaGolonganRuang?: string;
  tanggalBerkalaTerakhir?: string;
  gajiPokok?: string;
  besaranGajiKotor?: string;
  digajiMenurut?: string;
  noRekeningBank?: string;
  npwp?: string;
  nomorKarpeg?: string;
  pendidikan?: string;
  jurusan?: string;
  diklatJenjang?: string;
  tahunDiklat?: string;
  statusKawin?: string;
  agama?: string;
  nomorHp?: string;
  sisaCutiN?: string;
  sisaCutiN1?: string;
  sisaCutiN2?: string;
  skTerakhir?: string;
  jumlahTertanggung?: number;
  dataKeluarga?: unknown[];
  createdAt?: number;
  updatedAt?: number;
}

function s(v: unknown): string {
  return v == null ? "" : String(v);
}

function coerceStatus(raw: string): string {
  const u = raw.toUpperCase();
  if (u.includes("CPNS")) return "CPNS";
  if (u.includes("PPPKPW")) return "PPPKPW";
  if (u.includes("PPPK")) return "PPPK";
  if (u.includes("HONORER")) return "Honorer";
  if (u.includes("PNS")) return "PNS";
  return "Lainnya";
}

async function migrate() {
  const sa = loadServiceAccount();
  initializeApp({ credential: cert(sa) });
  const firestore = getFirestore();

  console.log("→ Fetching employees from Firestore...");
  const empSnap = await firestore.collection("shared/data/employees").get();
  console.log(`  ${empSnap.size} employee documents found.`);

  // Build existing lookup maps (idempotency)
  const existingByNip = new Map<string, string>();
  const existingByNik = new Map<string, string>();
  for (const e of await prisma.employee.findMany({ select: { id: true, nip: true, nik: true } })) {
    if (e.nip) existingByNip.set(e.nip.trim(), e.id);
    if (e.nik) existingByNik.set(e.nik.trim(), e.id);
  }

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const doc of empSnap.docs) {
    const d = { id: doc.id, ...(doc.data() as FirestoreEmployee) };
    try {
      const data = {
        nik: s(d.nik),
        nama: s(d.nama) || s((d as Record<string, unknown>).name),
        nip: s(d.nip),
        jk: d.jk === "P" ? "P" : "L",
        tempatLahir: s(d.tempatLahir),
        tanggalLahir: s(d.tanggalLahir),
        jalanDusun: s(d.jalanDusun),
        rt: s(d.rt),
        rw: s(d.rw),
        desaKelurahan: s(d.desaKelurahan),
        kecamatan: s(d.kecamatan),
        kabupaten: s(d.kabupaten),
        jabatan: s(d.jabatan),
        bidang: s(d.bidang),
        status: coerceStatus(s(d.status)),
        tmtKerja: s(d.tmtKerja),
        pangkat: s(d.pangkat),
        gol: s(d.gol),
        pangkatGolongan: s(d.pangkatGolongan) || s((d as Record<string, unknown>).pangkatGol),
        tmtGolonganRuang: s(d.tmtGolonganRuang),
        masaKerjaGolonganRuang: s(d.masaKerjaGolonganRuang),
        tanggalBerkalaTerakhir: s(d.tanggalBerkalaTerakhir),
        gajiPokok: s(d.gajiPokok),
        besaranGajiKotor: s(d.besaranGajiKotor),
        digajiMenurut: s(d.digajiMenurut),
        noRekeningBank: s(d.noRekeningBank),
        npwp: s(d.npwp),
        nomorKarpeg: s(d.nomorKarpeg),
        pendidikan: s(d.pendidikan),
        jurusan: s(d.jurusan),
        diklatJenjang: s(d.diklatJenjang),
        tahunDiklat: s(d.tahunDiklat),
        statusKawin: s(d.statusKawin),
        agama: s(d.agama),
        nomorHp: s(d.nomorHp),
        sisaCutiN: s(d.sisaCutiN),
        sisaCutiN1: s(d.sisaCutiN1),
        sisaCutiN2: s(d.sisaCutiN2),
        skTerakhir: s(d.skTerakhir),
        jumlahTertanggung: Number(d.jumlahTertanggung) || 0,
        dataKeluarga: (d.dataKeluarga ?? []) as object[],
        createdAt: d.createdAt ?? Date.now(),
        updatedAt: d.updatedAt ?? Date.now(),
      };

      const nipKey = data.nip.trim();
      const nikKey = data.nik.trim();
      const existingId = (nipKey && existingByNip.get(nipKey)) || (nikKey && existingByNik.get(nikKey));

      if (existingId) {
        await prisma.employee.update({ where: { id: existingId }, data });
        updated++;
      } else {
        const createdRow = await prisma.employee.create({ data });
        if (nipKey) existingByNip.set(nipKey, createdRow.id);
        if (nikKey) existingByNik.set(nikKey, createdRow.id);
        created++;
      }
    } catch (e) {
      errors++;
      console.error(`  ✗ Failed to migrate ${d.id} (${d.nama}):`, e instanceof Error ? e.message : e);
    }
  }

  console.log(`\nEmployees: ${created} created, ${updated} updated, ${errors} errors.`);

  // --- Settings ---
  console.log("\n→ Fetching settings from Firestore...");
  const settingsSnap = await firestore.doc("shared/data/settings/app").get();
  if (settingsSnap.exists) {
    const settings = settingsSnap.data();
    await prisma.settings.upsert({
      where: { id: "app" },
      create: { id: "app", data: settings as object },
      update: { data: settings as object },
    });
    console.log("  ✓ Settings migrated.");
  } else {
    console.log("  – No settings document found.");
  }

  // --- Write JSON backup alongside ---
  // (Data is also persisted in Neon now, so this is a redundant safety copy.)
  console.log("\n✓ Migration complete.");
  await prisma.$disconnect();
}

migrate().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
