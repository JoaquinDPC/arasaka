package controller

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"arasaka/internal/domain"
	"arasaka/internal/service"
)

// BudgetController handles HTTP requests for budget targets.
type BudgetController struct {
	svc *service.BudgetService
}

func NewBudgetController(svc *service.BudgetService) *BudgetController {
	return &BudgetController{svc: svc}
}

// ListBudgets godoc
// @Summary      List budgets
// @Tags         budgets
// @Produce      json
// @Param        year  query  string  false  "Filter by year"
// @Success      200  {array}   domain.Budget
// @Failure      500  {object}  map[string]string
// @Router       /budgets [get]
func (ctrl *BudgetController) ListBudgets(c *gin.Context) {
	budgets, err := ctrl.svc.ListBudgets(c.Request.Context(), c.Query("year"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, budgets)
}

type upsertBudgetReq struct {
	Category string `json:"category" binding:"required"`
	Year     int    `json:"year"     binding:"required"`
	Month    int    `json:"month"`
	Amount   int64  `json:"amount"   binding:"min=0"`
}

// UpsertBudget godoc
// @Summary      Create or update a budget
// @Tags         budgets
// @Accept       json
// @Produce      json
// @Param        body  body  upsertBudgetReq  true  "Budget payload"
// @Success      200  {object}  domain.Budget
// @Failure      400  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Router       /budgets [put]
func (ctrl *BudgetController) UpsertBudget(c *gin.Context) {
	var req upsertBudgetReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	b, err := ctrl.svc.UpsertBudget(c.Request.Context(), domain.Budget{
		Category: req.Category,
		Year:     req.Year,
		Month:    req.Month,
		Amount:   req.Amount,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, b)
}

type upsertBaseBudgetsReq struct {
	Year    int `json:"year" binding:"required"`
	Budgets []struct {
		Category string `json:"category" binding:"required"`
		Amount   int64  `json:"amount"   binding:"min=0"`
	} `json:"budgets" binding:"required"`
}

// UpsertBase bulk-upserts annual baseline budgets (month=0) for all categories.
func (ctrl *BudgetController) UpsertBase(c *gin.Context) {
	var req upsertBaseBudgetsReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	budgets := make([]domain.Budget, len(req.Budgets))
	for i, b := range req.Budgets {
		budgets[i] = domain.Budget{
			Category: b.Category,
			Year:     req.Year,
			Month:    0,
			Amount:   b.Amount,
		}
	}

	if err := ctrl.svc.UpsertBatch(c.Request.Context(), budgets); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}
