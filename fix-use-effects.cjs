const fs = require('fs');
let content = fs.readFileSync('src/components/EmployeeForm.tsx', 'utf8');

// replace formState
content = content.replace(
  'formState: { errors },',
  'formState: { errors, dirtyFields },'
);

// replace jabatan kamus effect
const effect1old = `  useEffect(() => {
    if (!settings?.jabatanKamusCsv || !jabatan) return;

    // Parse kamus
    const rows = settings.jabatanKamusCsv.split("\\n");
    let matchedKelas = "";
    let matchedBeban = "";

    for (const row of rows) {
      if (!row || row.trim() === "") continue;
      const cols = row.split(/;|\\t/);
      if (cols.length >= 4) {
        const kamusJabatan = cols[1]?.trim().toLowerCase() || "";
        if (kamusJabatan === jabatan.trim().toLowerCase()) {
          matchedKelas = cols[2]?.trim() || "";
          matchedBeban = cols[3]?.trim() || "";
          break;
        }
      }
    }

    if (matchedKelas || matchedBeban) {
      if (matchedKelas)
        setValue("kelasJabatan", matchedKelas, { shouldDirty: true });
      if (matchedBeban)
        setValue("bebanKerja", matchedBeban, { shouldDirty: true });
    }
  }, [jabatan, settings?.jabatanKamusCsv, setValue]);`;

const effect1new = `  useEffect(() => {
    if (!settings?.jabatanKamusCsv || !jabatan || !dirtyFields.jabatan) return;

    // Parse kamus
    const rows = settings.jabatanKamusCsv.split("\\n");
    let matchedKelas = "";
    let matchedBeban = "";

    for (const row of rows) {
      if (!row || row.trim() === "") continue;
      const cols = row.split(/;|\\t/);
      if (cols.length >= 4) {
        const kamusJabatan = cols[1]?.trim().toLowerCase() || "";
        if (kamusJabatan === jabatan.trim().toLowerCase()) {
          matchedKelas = cols[2]?.trim() || "";
          matchedBeban = cols[3]?.trim() || "";
          break;
        }
      }
    }

    if (matchedKelas || matchedBeban) {
      if (matchedKelas)
        setValue("kelasJabatan", matchedKelas, { shouldDirty: true });
      if (matchedBeban)
        setValue("bebanKerja", matchedBeban, { shouldDirty: true });
    }
  }, [jabatan, settings?.jabatanKamusCsv, setValue, dirtyFields.jabatan]);`;

content = content.replace(effect1old, effect1new);

// replace nip effect
const effect2old = `  useEffect(() => {
    if (!nip) return;
    
    const currentStatus = getValues("status");
    const extractResult = validateAndExtractNIP(nip, currentStatus);
    
    if (extractResult.jk) {
      setValue("jk", extractResult.jk, { shouldDirty: true });
    }
    if (extractResult.tanggalLahir) {
      setValue("tanggalLahir", extractResult.tanggalLahir, { shouldDirty: true });
    }
    if (extractResult.tmtKerja) {
      setValue("tmtKerja", extractResult.tmtKerja, { shouldDirty: true });
    }
  }, [nip, setValue, getValues]);`;

const effect2new = `  useEffect(() => {
    if (!nip || !dirtyFields.nip) return;
    
    const currentStatus = getValues("status");
    const extractResult = validateAndExtractNIP(nip, currentStatus);
    
    if (extractResult.jk) {
      setValue("jk", extractResult.jk, { shouldDirty: true });
    }
    if (extractResult.tanggalLahir) {
      setValue("tanggalLahir", extractResult.tanggalLahir, { shouldDirty: true });
    }
    if (extractResult.tmtKerja) {
      setValue("tmtKerja", extractResult.tmtKerja, { shouldDirty: true });
    }
  }, [nip, setValue, getValues, dirtyFields.nip]);`;

content = content.replace(effect2old, effect2new);

// replace calculateBUP effect
const effect3old = `  useEffect(() => {
    if (tanggalLahir && jabatan) {
      const calculatedPensiun = calculateBUP(tanggalLahir, jabatan);
      if (calculatedPensiun) {
        setValue("pensiun", calculatedPensiun, { shouldDirty: true });
      }
    }
  }, [tanggalLahir, jabatan, setValue]);`;

const effect3new = `  useEffect(() => {
    if (tanggalLahir && jabatan && (dirtyFields.tanggalLahir || dirtyFields.jabatan)) {
      const calculatedPensiun = calculateBUP(tanggalLahir, jabatan);
      if (calculatedPensiun) {
        setValue("pensiun", calculatedPensiun, { shouldDirty: true });
      }
    }
  }, [tanggalLahir, jabatan, setValue, dirtyFields.tanggalLahir, dirtyFields.jabatan]);`;

content = content.replace(effect3old, effect3new);

// replace calculateMasaKerja effect
const effect4old = `  useEffect(() => {
    if (tmtKerja) {
      const calculatedMasaKerja = calculateMasaKerja(tmtKerja);
      if (calculatedMasaKerja) {
        setValue("masaKerja", calculatedMasaKerja, { shouldDirty: true });
      }
    }
  }, [tmtKerja, setValue]);`;

const effect4new = `  useEffect(() => {
    if (tmtKerja && dirtyFields.tmtKerja) {
      const calculatedMasaKerja = calculateMasaKerja(tmtKerja);
      if (calculatedMasaKerja) {
        setValue("masaKerja", calculatedMasaKerja, { shouldDirty: true });
      }
    }
  }, [tmtKerja, setValue, dirtyFields.tmtKerja]);`;

content = content.replace(effect4old, effect4new);

fs.writeFileSync('src/components/EmployeeForm.tsx', content);
console.log('Fixed use effects in EmployeeForm');
