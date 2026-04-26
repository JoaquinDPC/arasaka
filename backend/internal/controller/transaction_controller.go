package controller

import (
	"net/http"
	"strconv"
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
// @Param        category  query   string  false  "Filter by category"
// @Param        flow      query   string  false  "Filter by flow (income|expense|investment)"
// @Success      200  {array}   domain.Transaction
// @Failure      500  {object}  map[string]string
// @Router       /transactions [get]
func (ctrl *TransactionController) List(c *gin.Context) {
	limit, _ := strconv.Atoi(c.Query("limit"))
	f := domain.TransactionFilter{
		Year:      c.Query("year"),
		Month:     c.Query("month"),
		Category:  c.Query("category"),
		Flow:      c.Query("flow"),
		AccountID: c.Query("account_id"),
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
	Date        string   `json:"date"        binding:"required"`
	Description string   `json:"description" binding:"required"`
	Category    string   `json:"category"    binding:"required"`
	Flow        string   `json:"flow"        binding:"required"`
	Subtype     *string  `json:"subtype"`
	Asset       *string  `json:"asset"`
	KeyUser     *string  `json:"key_user"`
	Quantity    *float64 `json:"quantity"`
	Amount      int64    `json:"amount"      binding:"required,min=0"`
	Notes       *string  `json:"notes"`
	AccountID   *int64   `json:"account_id"`
	Tags        []string `json:"tags"`
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

	t, err := ctrl.svc.Create(c.Request.Context(), domain.CreateTransactionParams{
		Date:        date,
		Description: req.Description,
		Category:    req.Category,
		Flow:        req.Flow,
		Subtype:     req.Subtype,
		Asset:       req.Asset,
		KeyUser:     req.KeyUser,
		Quantity:    req.Quantity,
		Amount:      req.Amount,
		Notes:       req.Notes,
		Source:      "manual",
		AccountID:   req.AccountID,
		Tags:        req.Tags,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, t)
}

type updateTransactionReq struct {
	Date        *string   `json:"date"`
	Description *string   `json:"description"`
	Category    *string   `json:"category"`
	Flow        *string   `json:"flow"`
	Subtype     *string   `json:"subtype"`
	Asset       *string   `json:"asset"`
	KeyUser     *string   `json:"key_user"`
	Quantity    *float64  `json:"quantity"`
	Amount      *int64    `json:"amount"`
	Notes       *string   `json:"notes"`
	Tags        *[]string `json:"tags"`
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
	p.Category = req.Category
	p.Flow = req.Flow
	p.Subtype = req.Subtype
	p.Asset = req.Asset
	p.KeyUser = req.KeyUser
	p.Quantity = req.Quantity
	p.Amount = req.Amount
	p.Notes = req.Notes
	p.Tags = req.Tags

	t, err := ctrl.svc.Update(c.Request.Context(), id, p)
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

	if err := ctrl.svc.Delete(c.Request.Context(), id); err != nil {
		if err.Error() == "not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}
