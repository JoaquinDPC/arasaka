package controller

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"arasaka/internal/middleware"
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
		AccountID int64 `json:"account_id" binding:"required"`
	}
	if err := ctx.ShouldBindJSON(&body); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "account_id required"})
		return
	}

	userID := ctx.GetInt64(middleware.UserIDKey)
	result, err := c.svc.Sync(ctx.Request.Context(), userID, body.AccountID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "sync complete", "result": result})
}
