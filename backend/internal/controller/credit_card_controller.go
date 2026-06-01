package controller

import (
	"io"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"arasaka/internal/crypto"
	"arasaka/internal/service"
)

type CreditCardController struct {
	svc        *service.CreditCardService
	accountSvc *service.AccountService
	masterKey  []byte
}

func NewCreditCardController(svc *service.CreditCardService, accountSvc *service.AccountService, masterKey []byte) *CreditCardController {
	return &CreditCardController{svc: svc, accountSvc: accountSvc, masterKey: masterKey}
}

func (ctrl *CreditCardController) ListBills(c *gin.Context) {
	userID := userIDFromContext(c)
	aid, err := strconv.ParseInt(c.Query("account_id"), 10, 64)
	if err != nil || aid == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "account_id required"})
		return
	}
	bills, err := ctrl.svc.ListBills(c.Request.Context(), userID, aid)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, bills)
}

func (ctrl *CreditCardController) GetBill(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	userID := userIDFromContext(c)
	bill, err := ctrl.svc.GetBill(c.Request.Context(), id, userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, bill)
}

func (ctrl *CreditCardController) LinkPayments(c *gin.Context) {
	userID := userIDFromContext(c)
	aid, err := strconv.ParseInt(c.Query("account_id"), 10, 64)
	if err != nil || aid == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "account_id required"})
		return
	}
	acct, err := ctrl.accountSvc.GetByID(c.Request.Context(), aid, userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "account not found"})
		return
	}
	if err := ctrl.svc.LinkPayments(c.Request.Context(), userID, acct.ID, acct.BankID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (ctrl *CreditCardController) ImportPDF(c *gin.Context) {
	fh, _, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file required"})
		return
	}
	defer fh.Close()

	data, err := io.ReadAll(fh)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "read file: " + err.Error()})
		return
	}

	password := c.PostForm("password")
	userID := userIDFromContext(c)
	var accountID int64
	if aidStr := c.PostForm("account_id"); aidStr != "" {
		if aid, parseErr := strconv.ParseInt(aidStr, 10, 64); parseErr == nil {
			accountID = aid
		}
	}

	// If no password supplied but an account_id is provided, try the stored password.
	if password == "" && accountID != 0 {
		if acct, acctErr := ctrl.accountSvc.GetByID(c.Request.Context(), accountID, userID); acctErr == nil {
			if acct.Settings.PDFPassword != "" {
				if plain, decErr := crypto.Decrypt(acct.Settings.PDFPassword, ctrl.masterKey); decErr == nil {
					password = plain
				}
			}
		}
	}

	imported, duplicates, err := ctrl.svc.ImportPDF(c.Request.Context(), userID, data, password, accountID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"imported":   imported,
		"duplicates": duplicates,
	})
}
