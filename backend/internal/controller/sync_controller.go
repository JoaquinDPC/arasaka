package controller

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"arasaka/internal/service"
)

type SyncController struct {
	svc *service.SyncService
}

func NewSyncController(svc *service.SyncService) *SyncController {
	return &SyncController{svc: svc}
}

func (c *SyncController) Sync(ctx *gin.Context) {
	var body struct {
		BankID string `json:"bank_id"`
	}
	_ = ctx.ShouldBindJSON(&body)

	result, err := c.svc.Sync(ctx.Request.Context(), body.BankID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "sync complete", "result": result})
}

