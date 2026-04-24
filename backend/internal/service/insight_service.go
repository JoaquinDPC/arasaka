package service

import (
	"fmt"

	"arasaka/internal/domain"
)

// GenerateInsights analyses a monthly report and returns alerts ordered by severity.
//
// Rules implemented:
//  1. DANGER — category over budget
//  2. WARN   — category at >85% of budget
//  3. WARN   — month more than 50% above historical average
//  4. INFO   — budget systematically underestimated (>80% in 4+ months)
//  5. DANGER — savings rate below 20%
//  6. OK     — savings rate above 30%
func GenerateInsights(report domain.MonthlyReport, history []domain.MonthlyReport) []domain.Insight {
	var insights []domain.Insight

	// Rules 5 & 6: savings rate
	if report.Income > 0 {
		savings := float64(report.Income-report.Expenses) / float64(report.Income)
		switch {
		case savings < 0.20:
			insights = append(insights, domain.Insight{
				Type:    "danger",
				Message: fmt.Sprintf("Tasa de ahorro este mes: %.0f%% (mínimo recomendado: 20%%)", savings*100),
			})
		case savings > 0.30:
			insights = append(insights, domain.Insight{
				Type:    "ok",
				Message: fmt.Sprintf("Mes excelente: tasa de ahorro del %.0f%%", savings*100),
			})
		}
	}

	// Rule 3: atypically expensive month (>150% of historical average)
	if len(history) > 0 {
		var totalExp int64
		for _, h := range history {
			totalExp += h.Expenses
		}
		avg := float64(totalExp) / float64(len(history))
		if avg > 0 && float64(report.Expenses) > avg*1.5 {
			pct := float64(report.Expenses)/avg*100 - 100
			insights = append(insights, domain.Insight{
				Type:    "warn",
				Message: fmt.Sprintf("Gastos este mes %.0f%% sobre el promedio histórico", pct),
			})
		}
	}

	// Rules 1 & 2: category over or near budget
	for _, cs := range report.ByCategory {
		if cs.Budget <= 0 {
			continue
		}
		switch {
		case cs.PctUsed > 1.0:
			pct := (cs.PctUsed - 1.0) * 100
			insights = append(insights, domain.Insight{
				Type:     "danger",
				Category: cs.Category,
				Message:  fmt.Sprintf("%s superó el presupuesto en %.0f%%", cs.Category, pct),
			})
		case cs.PctUsed > 0.85:
			insights = append(insights, domain.Insight{
				Type:     "warn",
				Category: cs.Category,
				Message:  fmt.Sprintf("%s alcanzó el 85%% del presupuesto", cs.Category),
			})
		}
	}

	// Rule 4: budget systematically underestimated (>80% in 4+ past months)
	overCounts := map[string]int{}
	for _, h := range history {
		for _, cs := range h.ByCategory {
			if cs.Budget > 0 && cs.PctUsed > 0.80 {
				overCounts[cs.Category]++
			}
		}
	}
	for cat, count := range overCounts {
		if count >= 4 {
			insights = append(insights, domain.Insight{
				Type:     "info",
				Category: cat,
				Message:  fmt.Sprintf("El presupuesto de %s puede estar subestimado", cat),
			})
		}
	}

	return insights
}
