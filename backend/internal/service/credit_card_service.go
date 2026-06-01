package service

import (
	"context"
	"fmt"
	"os"
	"os/exec"

	"arasaka/internal/domain"
	"arasaka/internal/pdfparser"
)

type CreditCardService struct {
	repo domain.CreditCardRepository
}

func NewCreditCardService(repo domain.CreditCardRepository) *CreditCardService {
	return &CreditCardService{repo: repo}
}

func (s *CreditCardService) ListBills(ctx context.Context, userID int64, accountID int64) ([]domain.CreditCardBill, error) {
	return s.repo.ListBills(ctx, userID, accountID)
}

func (s *CreditCardService) GetBill(ctx context.Context, id int64, userID int64) (domain.CreditCardBill, error) {
	return s.repo.GetBillByID(ctx, id, userID)
}

func (s *CreditCardService) LinkPayments(ctx context.Context, userID int64, accountID int64, bankID domain.BankID) error {
	return s.repo.LinkAllBills(ctx, userID, accountID, bankID)
}

// ImportPDF parses a Banco de Chile CC statement PDF and persists the results.
// If password is non-empty the PDF is decrypted via pikepdf before parsing.
func (s *CreditCardService) ImportPDF(ctx context.Context, userID int64, pdfData []byte, password string, accountID int64) (imported, duplicates int, err error) {
	data := pdfData
	if password != "" {
		data, err = decryptPDF(pdfData, password)
		if err != nil {
			return 0, 0, fmt.Errorf("decrypt pdf: %w", err)
		}
	}

	result, err := pdfparser.ParseCCBancoChile(data)
	if err != nil {
		return 0, 0, fmt.Errorf("parse pdf: %w", err)
	}

	for _, section := range []*pdfparser.CCBillData{result.National, result.International} {
		if section == nil || section.PeriodFrom.IsZero() {
			continue
		}

		bill, err := s.repo.UpsertBill(ctx, domain.CreateCCBillParams{
			ExternalAccountID: section.ExternalAccountID,
			PeriodFrom:        section.PeriodFrom,
			PeriodTo:          section.PeriodTo,
			DueDate:           section.DueDate,
			Currency:          section.Currency,
			TotalAmount:       section.TotalAmount,
			UserID:            &userID,
		})
		if err != nil {
			return imported, duplicates, fmt.Errorf("upsert bill %s: %w", section.ExternalAccountID, err)
		}

		var itemParams []domain.CreateCCItemParams
		for _, it := range section.Items {
			itemParams = append(itemParams, domain.CreateCCItemParams{
				BillID:             bill.ID,
				Date:               it.Date,
				Description:        it.Description,
				Amount:             it.Amount,
				Currency:           it.Currency,
				InstallmentCurrent: it.InstallmentCurrent,
				InstallmentTotal:   it.InstallmentTotal,
				ItemType:           it.ItemType,
				BankRawID:          it.BankRawID,
				UserID:             &userID,
			})
		}

		if len(itemParams) > 0 {
			imp, dup, err := s.repo.CreateItemsBatch(ctx, itemParams)
			if err != nil {
				return imported, duplicates, fmt.Errorf("create items: %w", err)
			}
			imported += imp
			duplicates += dup
		}
	}

	// Non-fatal: attempt to link CC payments to bank transactions.
	_ = s.repo.LinkAllBills(ctx, userID, accountID, domain.BankBancoDeChile)

	return imported, duplicates, nil
}

// decryptPDF uses Python's pikepdf to remove the password from an encrypted PDF.
func decryptPDF(data []byte, password string) ([]byte, error) {
	enc, err := os.CreateTemp("", "cc-enc-*.pdf")
	if err != nil {
		return nil, err
	}
	defer os.Remove(enc.Name())
	if _, err := enc.Write(data); err != nil {
		enc.Close()
		return nil, err
	}
	enc.Close()

	dec, err := os.CreateTemp("", "cc-dec-*.pdf")
	if err != nil {
		return nil, err
	}
	decPath := dec.Name()
	dec.Close()
	defer os.Remove(decPath)

	script := fmt.Sprintf(
		"import pikepdf; pdf = pikepdf.open(%q, password=%q); pdf.save(%q)",
		enc.Name(), password, decPath,
	)
	cmd := exec.Command("python3", "-c", script)
	if out, err := cmd.CombinedOutput(); err != nil {
		return nil, fmt.Errorf("pikepdf: %s: %w", string(out), err)
	}

	return os.ReadFile(decPath)
}
