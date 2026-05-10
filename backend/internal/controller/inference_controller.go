package controller

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"arasaka/internal/domain"
	"arasaka/internal/service"
)

type InferenceController struct {
	svc      *service.TagInferenceService
	userRepo domain.UserRepository
}

func NewInferenceController(svc *service.TagInferenceService, userRepo domain.UserRepository) *InferenceController {
	return &InferenceController{svc: svc, userRepo: userRepo}
}

type inferReq struct {
	Description string `json:"description" binding:"required"`
}

func (ctrl *InferenceController) Infer(c *gin.Context) {
	var req inferReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	result, err := ctrl.svc.InferTags(c.Request.Context(), userIDFromContext(c), req.Description)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

type updateSettingsReq struct {
	InferenceEnabled bool `json:"inference_enabled"`
	PersonalEnabled  bool `json:"personal_enabled"`
	AppEnabled       bool `json:"app_enabled"`
}

func (ctrl *InferenceController) UpdateSettings(c *gin.Context) {
	var req updateSettingsReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	userID := userIDFromContext(c)
	s := domain.UserSettings{
		InferenceEnabled: req.InferenceEnabled,
		PersonalEnabled:  req.PersonalEnabled,
		AppEnabled:       req.AppEnabled,
	}
	if err := ctrl.userRepo.UpdateSettings(c.Request.Context(), userID, s); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, s)
}
