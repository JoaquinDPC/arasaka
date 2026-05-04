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
func (s *ReportService) BuildMonthlyReport(ctx context.Context, year, month int, accountID *int64) (domain.MonthlyReport, error) {
	report := domain.MonthlyReport{Year: year, Month: month}

	income, expenses, investments, err := s.reports.MonthlyTotals(ctx, year, month, accountID)
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

	report.ByCategory, err = s.reports.CategoryTotals(ctx, year, month, accountID)
	if err != nil {
		return report, err
	}

	report.BySubtype, err = s.reports.SubtypeTotals(ctx, year, month, accountID)
	if err != nil {
		return report, err
	}

	report.TopExpenses, err = s.reports.TopExpenses(ctx, year, month, 5, accountID)
	if err != nil {
		return report, err
	}

	return report, nil
}

// CalculateKPIs computes year-to-date financial KPIs.
func (s *ReportService) CalculateKPIs(ctx context.Context, year int, accountID *int64) (domain.KPIReport, error) {
	opening, income, expenses, investments, fixed, err := s.reports.YearlyKPIs(ctx, year, accountID)
	if err != nil {
		return domain.KPIReport{}, err
	}

	kpis := domain.KPIReport{
		IncomeYTD:      income,
		ExpensesYTD:    expenses,
		InvestmentsYTD: investments,
		FixedExpenses:  fixed,
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
func (s *ReportService) GetTrend(ctx context.Context, year int, accountID *int64) ([]domain.MonthlyReport, error) {
	return s.reports.MonthlyTrend(ctx, year, accountID)
}

// GetBudgetVsActual returns budget vs actual spending by category for a given month.
func (s *ReportService) GetBudgetVsActual(ctx context.Context, year, month int, accountID *int64) ([]domain.CategorySummary, error) {
	return s.reports.BudgetVsActual(ctx, year, month, accountID)
}

// BuildAnnualReport assembles KPIs, monthly trend, category totals, top expenses,
// year-end projection, and active CC installments for a full year.
func (s *ReportService) BuildAnnualReport(ctx context.Context, year int, accountID *int64) (domain.AnnualReport, error) {
	report := domain.AnnualReport{Year: year}

	kpis, err := s.CalculateKPIs(ctx, year, accountID)
	if err != nil {
		return report, err
	}
	report.KPIs = kpis

	trend, err := s.reports.MonthlyTrend(ctx, year, accountID)
	if err != nil {
		return report, err
	}
	report.MonthlyTrend = trend

	cats, err := s.reports.YearlyCategoryTotals(ctx, year, accountID)
	if err != nil {
		return report, err
	}
	report.CategoryTotals = cats

	top, err := s.reports.YearlyTopExpenses(ctx, year, 10, accountID)
	if err != nil {
		return report, err
	}
	report.TopExpenses = top

	report.Projection = s.computeProjection(year, kpis)

	installments, err := s.reports.ActiveInstallments(ctx)
	if err != nil {
		return report, err
	}
	report.ActiveInstallments = installments

	return report, nil
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
func (s *ReportService) GetMonthlyHistory(ctx context.Context, year, beforeMonth int, accountID *int64) ([]domain.MonthlyReport, error) {
	return s.reports.MonthlyHistory(ctx, year, beforeMonth, accountID)
}

// GetYearlyCategoryTotals returns expense totals grouped by category for a full year.
func (s *ReportService) GetYearlyCategoryTotals(ctx context.Context, year int, accountID *int64) ([]domain.CategorySummary, error) {
	return s.reports.YearlyCategoryTotals(ctx, year, accountID)
}

// GetAllTimeCategoryTotals returns expense totals grouped by category across all time.
func (s *ReportService) GetAllTimeCategoryTotals(ctx context.Context, accountID *int64) ([]domain.CategorySummary, error) {
	return s.reports.AllTimeCategoryTotals(ctx, accountID)
}
