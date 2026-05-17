package controller

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"arasaka/internal/crypto"
	"arasaka/internal/domain"
	"arasaka/internal/middleware"
	"arasaka/internal/service"
)

// AccountController handles HTTP requests for the /accounts resource.
type AccountController struct {
	svc       *service.AccountService
	masterKey []byte
}

func NewAccountController(svc *service.AccountService, masterKey []byte) *AccountController {
	return &AccountController{svc: svc, masterKey: masterKey}
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
	BankID               domain.BankID `json:"bank_id"                binding:"required"`
	Name                 string        `json:"name"                   binding:"required"`
	Type                 string        `json:"type"`
	Currency             string        `json:"currency"`
	AppTagInference      *bool         `json:"app_tag_inference"`
	PersonalTagInference *bool         `json:"personal_tag_inference"`
	MonthlySalary        *int64        `json:"monthly_salary"`
	PDFPassword          string        `json:"pdf_password"`
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

	settings := domain.AccountSettings{AppTagInference: true, PersonalTagInference: true}
	if req.AppTagInference != nil {
		settings.AppTagInference = *req.AppTagInference
	}
	if req.PersonalTagInference != nil {
		settings.PersonalTagInference = *req.PersonalTagInference
	}
	if req.MonthlySalary != nil {
		settings.MonthlySalary = *req.MonthlySalary
	}
	if req.PDFPassword != "" {
		enc, err := crypto.Encrypt(req.PDFPassword, ctrl.masterKey)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "encrypt password: " + err.Error()})
			return
		}
		settings.PDFPassword = enc
	}

	a, err := ctrl.svc.Create(c.Request.Context(), domain.CreateAccountParams{
		UserID:   c.GetInt64(middleware.UserIDKey),
		BankID:   req.BankID,
		Name:     req.Name,
		Type:     req.Type,
		Currency: req.Currency,
		Settings: settings,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, a)
}

type updateAccountReq struct {
	BankID               *domain.BankID `json:"bank_id"`
	Name                 *string        `json:"name"`
	Type                 *string        `json:"type"`
	AppTagInference      *bool          `json:"app_tag_inference"`
	PersonalTagInference *bool          `json:"personal_tag_inference"`
	MonthlySalary        *int64         `json:"monthly_salary"`
	PDFPassword          *string        `json:"pdf_password"`
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

	userID := c.GetInt64(middleware.UserIDKey)
	p := domain.UpdateAccountParams{
		BankID: req.BankID,
		Name:   req.Name,
		Type:   req.Type,
	}

	// Build settings update by reading existing and overlaying request changes.
	hasSettingsChange := req.AppTagInference != nil || req.PersonalTagInference != nil ||
		req.MonthlySalary != nil || (req.PDFPassword != nil && *req.PDFPassword != "")
	if hasSettingsChange {
		existing, err := ctrl.svc.GetByID(c.Request.Context(), id, userID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		settings := existing.Settings
		if req.AppTagInference != nil {
			settings.AppTagInference = *req.AppTagInference
		}
		if req.PersonalTagInference != nil {
			settings.PersonalTagInference = *req.PersonalTagInference
		}
		if req.MonthlySalary != nil {
			settings.MonthlySalary = *req.MonthlySalary
		}
		if req.PDFPassword != nil && *req.PDFPassword != "" {
			enc, err := crypto.Encrypt(*req.PDFPassword, ctrl.masterKey)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "encrypt password: " + err.Error()})
				return
			}
			settings.PDFPassword = enc
		}
		p.Settings = &settings
	}

	a, err := ctrl.svc.Update(c.Request.Context(), id, p)
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
