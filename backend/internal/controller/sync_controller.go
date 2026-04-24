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
	result, err := c.svc.Sync(ctx.Request.Context())
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "sync complete", "result": result})
}
