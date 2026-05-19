package service

import (
	"context"
	"time"

	"arasaka/internal/domain"
)

// ReportService builds financial reports from aggregated repository data.
type ReportService struct {
	reports domain.ReportRepository
}

func NewReportService(reports domain.ReportRepository) *ReportService {
	return &ReportService{reports: reports}
}

// BuildMonthlyReport assembles the full monthly report (used by report and insights handlers).
func (s *ReportService) BuildMonthlyReport(ctx context.Context, userID int64, year, month int, accountID *int64) (domain.MonthlyReport, error) {
	report := domain.MonthlyReport{Year: year, Month: month}

	income, expenses, investments, err := s.reports.MonthlyTotals(ctx, userID, year, month, accountID)
	if err != nil {
		return report, err
	}
	report.Income = income
	report.Expenses = expenses
	report.Investments = investments
	report.Balance = income - expenses - investments
	if income > 0 {
		report.SavingsRate = float64(income-expenses-investments) / float64(income)
	}

	report.ByCategory, err = s.reports.TagTotals(ctx, userID, year, month, accountID)
	if err != nil {
		return report, err
	}

	report.TopExpenses, err = s.reports.TopExpenses(ctx, userID, year, month, 5, accountID)
	if err != nil {
		return report, err
	}

	return report, nil
}

// CalculateKPIs computes year-to-date financial KPIs.
func (s *ReportService) CalculateKPIs(ctx context.Context, userID int64, year int, accountID *int64) (domain.KPIReport, error) {
	opening, income, expenses, investments, err := s.reports.YearlyKPIs(ctx, userID, year, accountID)
	if err != nil {
		return domain.KPIReport{}, err
	}

	kpis := domain.KPIReport{
		IncomeYTD:      income,
		ExpensesYTD:    expenses,
		InvestmentsYTD: investments,
	}
	kpis.CashBalance = opening + income - expenses
	kpis.NetWorth = kpis.CashBalance + investments
	if income > 0 {
		kpis.InvestmentRate = float64(investments) / float64(income)
		kpis.CostOfLiving = float64(expenses) / float64(income)
	}
	return kpis, nil
}

// GetTrend returns monthly income/expense totals for a given year.
func (s *ReportService) GetTrend(ctx context.Context, userID int64, year int, accountID *int64) ([]domain.MonthlyReport, error) {
	return s.reports.MonthlyTrend(ctx, userID, year, accountID)
}

// GetTagTotals returns tag-based spending summary for a given month, used by the budget-vs-actual endpoint.
func (s *ReportService) GetTagTotals(ctx context.Context, userID int64, year, month int, accountID *int64) ([]domain.CategorySummary, error) {
	return s.reports.TagTotals(ctx, userID, year, month, accountID)
}

// BuildAnnualReport assembles KPIs, monthly trend, tag totals, top expenses,
// year-end projection, and active CC installments for a full year.
func (s *ReportService) BuildAnnualReport(ctx context.Context, userID int64, year int, accountID *int64) (domain.AnnualReport, error) {
	report := domain.AnnualReport{Year: year}

	kpis, err := s.CalculateKPIs(ctx, userID, year, accountID)
	if err != nil {
		return report, err
	}
	report.KPIs = kpis

	trend, err := s.reports.MonthlyTrend(ctx, userID, year, accountID)
	if err != nil {
		return report, err
	}
	report.MonthlyTrend = trend

	cats, err := s.reports.YearlyTagTotals(ctx, userID, year, accountID)
	if err != nil {
		return report, err
	}
	report.CategoryTotals = cats

	top, err := s.reports.YearlyTopExpenses(ctx, userID, year, 10, accountID)
	if err != nil {
		return report, err
	}
	report.TopExpenses = top

	report.Projection = s.computeProjection(year, kpis)

	installments, err := s.reports.ActiveInstallments(ctx, userID)
	if err != nil {
		return report, err
	}
	report.ActiveInstallments = installments

	return report, nil
}

func (s *ReportService) ActiveInstallments(ctx context.Context, userID int64) ([]domain.CreditCardItem, error) {
	return s.reports.ActiveInstallments(ctx, userID)
}

// computeProjection estimates the year-end cash balance based on YTD monthly averages.
func (s *ReportService) computeProjection(year int, kpis domain.KPIReport) int64 {
	now := time.Now()
	var monthsElapsed int
	switch {
	case year < now.Year():
		monthsElapsed = 12
	case year == now.Year():
		monthsElapsed = int(now.Month())
	default:
		return 0
	}
	if monthsElapsed == 0 {
		return kpis.CashBalance
	}
	monthlyNet := (kpis.IncomeYTD - kpis.ExpensesYTD) / int64(monthsElapsed)
	remaining := int64(12 - monthsElapsed)
	return kpis.CashBalance + monthlyNet*remaining
}

// GetMonthlyHistory returns per-month summaries for months before the given month.
func (s *ReportService) GetMonthlyHistory(ctx context.Context, userID int64, year, beforeMonth int, accountID *int64) ([]domain.MonthlyReport, error) {
	return s.reports.MonthlyHistory(ctx, userID, year, beforeMonth, accountID)
}

// GetYearlyTagTotals returns expense totals grouped by tag for a full year.
func (s *ReportService) GetYearlyTagTotals(ctx context.Context, userID int64, year int, accountID *int64) ([]domain.CategorySummary, error) {
	return s.reports.YearlyTagTotals(ctx, userID, year, accountID)
}

// GetAllTimeTagTotals returns expense totals grouped by tag across all time.
func (s *ReportService) GetAllTimeTagTotals(ctx context.Context, userID int64, accountID *int64) ([]domain.CategorySummary, error) {
	return s.reports.AllTimeTagTotals(ctx, userID, accountID)
}
