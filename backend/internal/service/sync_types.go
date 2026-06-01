package service

const (
	accountTypeChecking = "corriente"
	accountTypeCredit   = "credito"
)

// BankRecord is the canonical intermediate format for any transaction source.
// fintself populates all fields from JSON; PDF imports use PDFRowsToBankRecords.
type BankRecord struct {
	Date            string  `json:"date"`
	Description     string  `json:"description"`
	Amount          string  `json:"amount"`
	Currency        string  `json:"currency"`
	TransactionType string  `json:"transaction_type"`
	AccountID       string  `json:"account_id"`
	AccountType     string  `json:"account_type"`
	Source          string  `json:"source"` // "bank_json" | "pdf"
	RawData         RawData `json:"raw_data"`
}

type RawData struct {
	DateStr        string `json:"date_str"`
	CargoStr       string `json:"cargo_str"`
	AbonoStr       string `json:"abono_str"`
	FullAccountID  string `json:"full_account_id"`
	PageNumber     *int   `json:"page_number"`
	RowIndex       int    `json:"row_index"`
	MovementType string `json:"tipo_movimiento"`
	Cuotas         string `json:"cuotas"`
	PagoStr        string `json:"pago_str"`
	SectionType    string `json:"section_type"`
	CurrencyType   string `json:"currency_type"`
}

// SyncResult summarises one sync run.
type SyncResult struct {
	BankImported   int              `json:"bank_imported"`
	BankDuplicates int              `json:"bank_duplicates"`
	CCBills        []CCSyncResult   `json:"cc_bills"`
}

type CCSyncResult struct {
	AccountID       string `json:"account_id"`
	BillID          int64  `json:"bill_id"`
	ItemsImported   int    `json:"items_imported"`
	ItemsDuplicates int    `json:"items_duplicates"`
}
