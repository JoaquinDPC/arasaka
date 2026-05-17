package domain

// queries.go defines read-side filter and pagination objects.
// These are not entities — they describe how to query data, not what data is.

// TransactionFilter holds optional query filters for listing transactions.
type TransactionFilter struct {
	Year      string
	Month     string
	Flow      string
	AccountID string
	Tags      []string // AND filter: rows must contain all listed tags (tags @> ARRAY[...])
	Limit     int      // 0 means use default (1000)
}
