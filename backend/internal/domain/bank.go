package domain

// Bank ID constants — the canonical identifier stored in accounts.bank_id.
// Add new banks here when support is extended to additional institutions.
const (
	BankBancoDeChile = "banco_de_chile"
	BankSantander    = "santander"
	BankBCI          = "bci"
	BankBancoEstado  = "banco_estado"
	BankScotiabank   = "scotiabank"
	BankItau         = "itau"
	BankBICE         = "bice"
	BankFalabella    = "falabella"
	BankRipley       = "ripley"
	BankMercadoPago  = "mercado_pago"
	BankOther        = "otro"
)

// ValidBankIDs is the authoritative list of accepted bank_id values.
var ValidBankIDs = []string{
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
func BankLabel(bankID string) string {
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
		return bankID
	}
}
