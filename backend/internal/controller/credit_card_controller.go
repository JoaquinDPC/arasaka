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

func (ctrl *CreditCardController) ListStatements(c *gin.Context) {
	userID := userIDFromContext(c)
	stmts, err := ctrl.svc.ListStatements(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, stmts)
}

func (ctrl *CreditCardController) GetStatement(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	userID := userIDFromContext(c)
	stmt, err := ctrl.svc.GetStatement(c.Request.Context(), id, userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, stmt)
}

func (ctrl *CreditCardController) LinkPayments(c *gin.Context) {
	if err := ctrl.svc.LinkPayments(c.Request.Context()); err != nil {
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

	// If no password supplied but an account_id is provided, try the stored password.
	if password == "" {
		if aidStr := c.PostForm("account_id"); aidStr != "" {
			if aid, err := strconv.ParseInt(aidStr, 10, 64); err == nil {
				if acct, err := ctrl.accountSvc.GetByID(c.Request.Context(), aid, userID); err == nil {
					if acct.Settings.PDFPassword != "" {
						if plain, err := crypto.Decrypt(acct.Settings.PDFPassword, ctrl.masterKey); err == nil {
							password = plain
						}
					}
				}
			}
		}
	}

	imported, duplicates, err := ctrl.svc.ImportPDF(c.Request.Context(), userID, data, password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"imported":   imported,
		"duplicates": duplicates,
	})
}
