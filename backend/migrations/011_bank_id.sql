-- +goose Up

-- Rename bank_name → bank_id and convert existing free-text values to constants.
ALTER TABLE accounts RENAME COLUMN bank_name TO bank_id;

UPDATE accounts SET bank_id = CASE
    WHEN bank_id ILIKE '%banco de chile%' OR bank_id ILIKE '%bancochile%' THEN 'banco_de_chile'
    WHEN bank_id ILIKE '%santander%'                                       THEN 'santander'
    WHEN bank_id ILIKE '%estado%'                                          THEN 'banco_estado'
    WHEN bank_id ILIKE '%scotiabank%'                                      THEN 'scotiabank'
    WHEN bank_id ILIKE '%itau%' OR bank_id ILIKE '%itaú%'                 THEN 'itau'
    WHEN bank_id ILIKE '%bice%'                                            THEN 'bice'
    WHEN bank_id ILIKE '%falabella%'                                       THEN 'falabella'
    WHEN bank_id ILIKE '%ripley%'                                          THEN 'ripley'
    WHEN bank_id ILIKE '%mercado%'                                         THEN 'mercado_pago'
    WHEN bank_id ILIKE '%bci%'                                             THEN 'bci'
    ELSE 'otro'
END;

ALTER TABLE accounts ADD CONSTRAINT accounts_bank_id_check
    CHECK (bank_id IN (
        'banco_de_chile','santander','bci','banco_estado',
        'scotiabank','itau','bice','falabella','ripley','mercado_pago','otro'
    ));

-- +goose Down

ALTER TABLE accounts DROP CONSTRAINT accounts_bank_id_check;
ALTER TABLE accounts RENAME COLUMN bank_id TO bank_name;
