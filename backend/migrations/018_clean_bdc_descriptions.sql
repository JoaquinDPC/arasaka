-- +goose Up
-- Strip Banco de Chile portal prefixes from already-imported descriptions.
-- bank_raw_id is intentionally left unchanged: it was computed from the original
-- description, so future imports of the same records will still dedup correctly.

UPDATE transactions t
SET description = trim(regexp_replace(t.description,
    '^(traspaso a|traspaso de|traspaso|pago):[[:space:]]*', '', 'i'))
FROM accounts a
WHERE t.account_id = a.id
  AND a.bank_id = 'banco_de_chile'
  AND t.description ~* '^(traspaso a|traspaso de|traspaso|pago):';

UPDATE credit_card_items cci
SET description = trim(regexp_replace(cci.description,
    '^(traspaso a|traspaso de|traspaso|pago):[[:space:]]*', '', 'i'))
FROM accounts a
WHERE cci.account_id = a.id
  AND a.bank_id = 'banco_de_chile'
  AND cci.description ~* '^(traspaso a|traspaso de|traspaso|pago):';

-- +goose Down
