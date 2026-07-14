-- List/search helpers for Pegawai (order by nama, filter status)
CREATE INDEX IF NOT EXISTS "employees_nama_idx" ON "employees"("nama");
CREATE INDEX IF NOT EXISTS "employees_status_nama_idx" ON "employees"("status", "nama");
