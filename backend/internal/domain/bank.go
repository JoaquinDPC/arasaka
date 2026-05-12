package domain

// BankID is the canonical identifier for a financial institution, stored in
// accounts.bank_id. Use the Bank* constants — never construct from raw strings.
type BankID string

// Valid reports whether b is a recognised bank identifier.
func (b BankID) Valid() bool {
	for _, v := range ValidBankIDs {
		if b == v {
			return true
		}
	}
	return false
}

// Bank ID constants — the canonical identifier stored in accounts.bank_id.
// Add new banks here when support is extended to additional institutions.
const (
	BankBancoDeChile BankID = "banco_de_chile"
	BankSantander    BankID = "santander"
	BankBCI          BankID = "bci"
	BankBancoEstado  BankID = "banco_estado"
	BankScotiabank   BankID = "scotiabank"
	BankItau         BankID = "itau"
	BankBICE         BankID = "bice"
	BankFalabella    BankID = "falabella"
	BankRipley       BankID = "ripley"
	BankMercadoPago  BankID = "mercado_pago"
	BankOther        BankID = "otro"
)

// ValidBankIDs is the authoritative list of accepted bank_id values.
var ValidBankIDs = []BankID{
	BankBancoDeChile,
	BankSantander,
	BankBCI,
	BankBancoEstado,
	BankScotiabank,
	BankItau,
	BankBICE,
	BankFalabella,
	BankRipley,
	BankMercadoPago,
	BankOther,
}

// BankLabel returns the human-readable display name for a bank_id.
func BankLabel(bankID BankID) string {
	switch bankID {
	case BankBancoDeChile:
		return "Banco de Chile"
	case BankSantander:
		return "Santander"
	case BankBCI:
		return "BCI"
	case BankBancoEstado:
		return "BancoEstado"
	case BankScotiabank:
		return "Scotiabank"
	case BankItau:
		return "Itaú"
	case BankBICE:
		return "BICE"
	case BankFalabella:
		return "Falabella"
	case BankRipley:
		return "Ripley"
	case BankMercadoPago:
		return "Mercado Pago"
	default:
		return string(bankID)
	}
}
