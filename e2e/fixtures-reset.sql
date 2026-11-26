-- Local e2e only (package.json test:e2e), BEFORE the sample import: undo fixtures.sql so the
-- import, which never touches claimed providers, can update the sample data again.
UPDATE providers SET status = 'unclaimed', whatsapp = NULL WHERE slug = 'contoh-tuk-k3-tangerang';
