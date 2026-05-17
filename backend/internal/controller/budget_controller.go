package controller

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"arasaka/internal/domain"
	"arasaka/internal/service"
)

// BudgetController handles HTTP requests for tag budgets and user tags.
type BudgetController struct {
	svc *service.BudgetService
}

func NewBudgetController(svc *service.BudgetService) *BudgetController {
	return &BudgetController{svc: svc}
}

// ListTags returns the user's personal tag names (formerly sourced from the budgets table).
func (ctrl *BudgetController) ListTags(c *gin.Context) {
	tags, err := ctrl.svc.ListUserTags(c.Request.Context(), userIDFromContext(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, tags)
}

type savePersonalTagReq struct {
	Tag string `json:"tag" binding:"required"`
}

// SavePersonalTag adds a tag to the user's personal tag vocabulary.
func (ctrl *BudgetController) SavePersonalTag(c *gin.Context) {
	var req savePersonalTagReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := ctrl.svc.SaveUserTag(c.Request.Context(), userIDFromContext(c), req.Tag); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"tag": req.Tag})
}

// ListPersonalTags returns the user's curated personal tag vocabulary with icon overrides.
func (ctrl *BudgetController) ListPersonalTags(c *gin.Context) {
	tags, err := ctrl.svc.ListUserTagsWithIcons(c.Request.Context(), userIDFromContext(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, tags)
}

type setTagIconReq struct {
	Icon string `json:"icon"`
}

// SetTagIcon sets or clears the icon override for one of the user's personal tags.
func (ctrl *BudgetController) SetTagIcon(c *gin.Context) {
	tag := c.Param("tag")
	if tag == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tag required"})
		return
	}
	var req setTagIconReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := ctrl.svc.SetTagIcon(c.Request.Context(), userIDFromContext(c), tag, req.Icon); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

// DeletePersonalTag removes a tag from the user's personal vocabulary.
func (ctrl *BudgetController) DeletePersonalTag(c *gin.Context) {
	tag := c.Param("tag")
	if tag == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tag required"})
		return
	}
	if err := ctrl.svc.DeleteUserTag(c.Request.Context(), userIDFromContext(c), tag); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

// ListTagBudgets returns per-tag spending limits for the authenticated user.
func (ctrl *BudgetController) ListTagBudgets(c *gin.Context) {
	year, err := strconv.Atoi(c.Query("year"))
	if err != nil || year == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "year required"})
		return
	}
	budgets, err := ctrl.svc.ListTagBudgets(c.Request.Context(), userIDFromContext(c), year)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, budgets)
}

type upsertTagBudgetReq struct {
	Tag    string `json:"tag"    binding:"required"`
	Year   int    `json:"year"   binding:"required"`
	Month  int    `json:"month"`
	Amount int64  `json:"amount" binding:"min=0"`
}

// UpsertTagBudget creates or updates a per-tag spending limit.
func (ctrl *BudgetController) UpsertTagBudget(c *gin.Context) {
	var req upsertTagBudgetReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	err := ctrl.svc.UpsertTagBudget(c.Request.Context(), domain.TagBudget{
		UserID: userIDFromContext(c),
		Tag:    req.Tag,
		Year:   req.Year,
		Month:  req.Month,
		Amount: req.Amount,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}
