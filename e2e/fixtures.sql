-- Local e2e only (package.json test:e2e), AFTER the sample import: one sample provider with a
-- fictional WhatsApp number that has claimed its profile, to test the WhatsApp click beacon and
-- the question form (#28). Never used outside the local D1.
UPDATE providers SET status = 'claimed', whatsapp = '6281200000000' WHERE slug = 'contoh-tuk-k3-tangerang';
