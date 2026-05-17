package controller

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"arasaka/internal/service"
)

type InferenceController struct {
	svc *service.TagInferenceService
}

func NewInferenceController(svc *service.TagInferenceService) *InferenceController {
	return &InferenceController{svc: svc}
}

type inferReq struct {
	Description string `json:"description" binding:"required"`
	AccountID   int64  `json:"account_id"  binding:"required"`
}

func (ctrl *InferenceController) Infer(c *gin.Context) {
	var req inferReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	result, err := ctrl.svc.InferTags(c.Request.Context(), userIDFromContext(c), req.AccountID, req.Description)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}
