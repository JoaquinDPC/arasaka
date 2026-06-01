package controller

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"arasaka/internal/domain"
	"arasaka/internal/service"
)

// TransactionController handles HTTP requests for the /transactions resource.
type TransactionController struct {
	svc *service.TransactionService
}

func NewTransactionController(svc *service.TransactionService) *TransactionController {
	return &TransactionController{svc: svc}
}

// List godoc
// @Summary      List transactions
// @Tags         transactions
// @Produce      json
// @Param        year      query   string  false  "Filter by year (e.g. 2026)"
// @Param        month     query   string  false  "Filter by month (1-12)"
// @Param        flow      query   string  false  "Filter by flow (income|expense|investment)"
// @Success      200  {array}   domain.Transaction
// @Failure      500  {object}  map[string]string
// @Router       /transactions [get]
func (ctrl *TransactionController) List(c *gin.Context) {
	limit, _ := strconv.Atoi(c.Query("limit"))
	var tags []string
	if raw := c.Query("tags"); raw != "" {
		for _, t := range strings.Split(raw, ",") {
			if t = strings.TrimSpace(t); t != "" {
				tags = append(tags, t)
			}
		}
	}
	f := domain.TransactionFilter{
		UserID:    userIDFromContext(c),
		Year:      c.Query("year"),
		Month:     c.Query("month"),
		Flow:      c.Query("flow"),
		AccountID: c.Query("account_id"),
		Tags:      tags,
		DateFrom:  c.Query("date_from"),
		DateTo:    c.Query("date_to"),
		Limit:     limit,
	}
	txs, err := ctrl.svc.List(c.Request.Context(), f)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, txs)
}

type createTransactionReq struct {
	Date                string   `json:"date"                  binding:"required"`
	Description         string   `json:"description"           binding:"required"`
	Flow                string   `json:"flow"                  binding:"required"`
	CustomDescription   *string  `json:"custom_description"`
	Amount              int64    `json:"amount"                binding:"required,min=0"`
	Notes               *string  `json:"notes"`
	AccountID           *int64   `json:"account_id"`
	Tags                []string `json:"tags"`
	RememberDescription bool     `json:"remember_description"`
}

// Create godoc
// @Summary      Create a transaction
// @Tags         transactions
// @Accept       json
// @Produce      json
// @Param        body  body  createTransactionReq  true  "Transaction payload"
// @Success      201  {object}  domain.Transaction
// @Failure      400  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Router       /transactions [post]
func (ctrl *TransactionController) Create(c *gin.Context) {
	var req createTransactionReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	date, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "date must be YYYY-MM-DD"})
		return
	}

	userID := userIDFromContext(c)
	t, err := ctrl.svc.Create(c.Request.Context(), domain.CreateTransactionParams{
		Date:                date,
		Description:         req.Description,
		Flow:                req.Flow,
		CustomDescription:   req.CustomDescription,
		Amount:              req.Amount,
		Notes:               req.Notes,
		Source:              "manual",
		AccountID:           req.AccountID,
		Tags:                req.Tags,
		UserID:              &userID,
		RememberDescription: req.RememberDescription,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, t)
}

type updateTransactionReq struct {
	Date                *string   `json:"date"`
	Description         *string   `json:"description"`
	Flow                *string   `json:"flow"`
	CustomDescription   *string   `json:"custom_description"`
	Amount              *int64    `json:"amount"`
	Notes               *string   `json:"notes"`
	Tags                *[]string `json:"tags"`
	RememberDescription *bool     `json:"remember_description"`
}

// Update godoc
// @Summary      Update a transaction
// @Tags         transactions
// @Accept       json
// @Produce      json
// @Param        id    path  int                   true   "Transaction ID"
// @Param        body  body  updateTransactionReq  false  "Fields to update (all optional)"
// @Success      200  {object}  domain.Transaction
// @Failure      400  {object}  map[string]string
// @Failure      404  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Router       /transactions/{id} [put]
func (ctrl *TransactionController) Update(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var req updateTransactionReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var p domain.UpdateTransactionParams
	if req.Date != nil {
		d, err := time.Parse("2006-01-02", *req.Date)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "date must be YYYY-MM-DD"})
			return
		}
		p.Date = &d
	}
	p.Description = req.Description
	p.Flow = req.Flow
	p.CustomDescription = req.CustomDescription
	p.Amount = req.Amount
	p.Notes = req.Notes
	p.Tags = req.Tags
	p.RememberDescription = req.RememberDescription

	userID := userIDFromContext(c)
	t, err := ctrl.svc.Update(c.Request.Context(), id, userID, p)
	if err != nil {
		if err.Error() == "not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		if err.Error() == "no fields to update" {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, t)
}

// Delete godoc
// @Summary      Delete a transaction
// @Tags         transactions
// @Param        id  path  int  true  "Transaction ID"
// @Success      204
// @Failure      400  {object}  map[string]string
// @Failure      404  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Router       /transactions/{id} [delete]
func (ctrl *TransactionController) Delete(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	userID := userIDFromContext(c)
	if err := ctrl.svc.Delete(c.Request.Context(), id, userID); err != nil {
		if err.Error() == "not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

// ListUsedTags returns the top 15 tags by usage frequency for the authenticated user.
func (ctrl *TransactionController) ListUsedTags(c *gin.Context) {
	userID := userIDFromContext(c)
	tags, err := ctrl.svc.ListUsedTags(c.Request.Context(), userID, 15)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, tags)
}

type createTransactionBatchReq struct {
	AccountID    int64                     `json:"account_id"   binding:"required"`
	Transactions []batchTransactionItemReq `json:"transactions" binding:"required,min=1"`
}

type batchTransactionItemReq struct {
	Date              string   `json:"date"               binding:"required"`
	Description       string   `json:"description"        binding:"required"`
	Flow              string   `json:"flow"               binding:"required"`
	Amount            int64    `json:"amount"             binding:"required,min=0"`
	Tags              []string `json:"tags"`
	Notes             *string  `json:"notes"`
	CustomDescription *string  `json:"custom_description"`
}

// CreateBatch godoc
// @Summary      Bulk-create transactions (e.g. from a credit card statement paste)
// @Tags         transactions
// @Accept       json
// @Produce      json
// @Param        body  body  createTransactionBatchReq  true  "Batch payload"
// @Success      200  {object}  map[string]int
// @Failure      400  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Router       /transactions/bulk [post]
func (ctrl *TransactionController) CreateBatch(c *gin.Context) {
	var req createTransactionBatchReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := userIDFromContext(c)
	params := make([]domain.CreateTransactionParams, len(req.Transactions))
	for i, item := range req.Transactions {
		date, err := time.Parse("2006-01-02", item.Date)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("item %d: date must be YYYY-MM-DD", i)})
			return
		}
		params[i] = domain.CreateTransactionParams{
			Date:              date,
			Description:       item.Description,
			Flow:              item.Flow,
			Amount:            item.Amount,
			Tags:              item.Tags,
			Notes:             item.Notes,
			CustomDescription: item.CustomDescription,
			Source:            "tc_import",
		}
	}

	imported, duplicates, err := ctrl.svc.CreateBatch(c.Request.Context(), userID, req.AccountID, params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"imported": imported, "duplicates": duplicates})
}

// TagSpending returns per-tag expense totals for the authenticated user.
// Query params: year (required), month (optional, 0=full year), account_id (optional).
func (ctrl *TransactionController) TagSpending(c *gin.Context) {
	userID := userIDFromContext(c)
	year, err := strconv.Atoi(c.Query("year"))
	if err != nil || year == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "year required"})
		return
	}
	month, _ := strconv.Atoi(c.Query("month"))
	var accountID *int64
	if raw := c.Query("account_id"); raw != "" {
		id, err := strconv.ParseInt(raw, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid account_id"})
			return
		}
		accountID = &id
	}
	result, err := ctrl.svc.TagSpending(c.Request.Context(), userID, year, month, accountID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}
