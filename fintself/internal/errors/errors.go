package finterrors

import "fmt"

type FintselfError struct {
	Message string
}

func (e *FintselfError) Error() string { return e.Message }

type LoginError struct{ FintselfError }

func NewLoginError(msg string) *LoginError {
	if msg == "" {
		msg = "Login failed. Incorrect credentials or website issue."
	}
	return &LoginError{FintselfError{msg}}
}

type DataExtractionError struct{ FintselfError }

func NewDataExtractionError(msg string) *DataExtractionError {
	if msg == "" {
		msg = "Data extraction failed. The website structure may have changed."
	}
	return &DataExtractionError{FintselfError{msg}}
}

type ScraperNotFound struct{ FintselfError }

func NewScraperNotFound(bankID string) *ScraperNotFound {
	return &ScraperNotFound{FintselfError{
		Message: fmt.Sprintf("Scraper '%s' not found. Use 'fintself list' to see available ones.", bankID),
	}}
}

type OutputError struct{ FintselfError }

func NewOutputError(msg string) *OutputError {
	if msg == "" {
		msg = "Error generating output file."
	}
	return &OutputError{FintselfError{msg}}
}
