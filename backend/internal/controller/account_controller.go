package controller

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"arasaka/internal/domain"
	"arasaka/internal/middleware"
	"arasaka/internal/service"
)

// AccountController handles HTTP requests for the /accounts resource.
type AccountController struct {
	svc *service.AccountService
}

func NewAccountController(svc *service.AccountService) *AccountController {
	return &AccountController{svc: svc}
}

func (ctrl *AccountController) List(c *gin.Context) {
	userID := c.GetInt64(middleware.UserIDKey)
	accounts, err := ctrl.svc.List(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, accounts)
}

type createAccountReq struct {
	BankID   domain.BankID `json:"bank_id" binding:"required"`
	Name     string        `json:"name"    binding:"required"`
	Type     string        `json:"type"`
	Currency string        `json:"currency"`
}

func (ctrl *AccountController) Create(c *gin.Context) {
	var req createAccountReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if !req.BankID.Valid() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid bank_id"})
		return
	}
	a, err := ctrl.svc.Create(c.Request.Context(), domain.CreateAccountParams{
		UserID:   c.GetInt64(middleware.UserIDKey),
		BankID:   req.BankID,
		Name:     req.Name,
		Type:     req.Type,
		Currency: req.Currency,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, a)
}

type updateAccountReq struct {
	BankID *domain.BankID `json:"bank_id"`
	Name   *string        `json:"name"`
	Type   *string        `json:"type"`
}

func (ctrl *AccountController) Update(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var req updateAccountReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.BankID != nil && !req.BankID.Valid() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid bank_id"})
		return
	}
	a, err := ctrl.svc.Update(c.Request.Context(), id, domain.UpdateAccountParams{
		BankID: req.BankID,
		Name:     req.Name,
		Type:     req.Type,
	})
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
	c.JSON(http.StatusOK, a)
}

func (ctrl *AccountController) Delete(c *gin.Context) {
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
