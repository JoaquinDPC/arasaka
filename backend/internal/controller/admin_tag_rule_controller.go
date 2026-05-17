package controller

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"arasaka/internal/service"
)

type AdminTagRuleController struct {
	svc *service.AdminTagRuleService
}

func NewAdminTagRuleController(svc *service.AdminTagRuleService) *AdminTagRuleController {
	return &AdminTagRuleController{svc: svc}
}

func (ctrl *AdminTagRuleController) ListRules(c *gin.Context) {
	rules, err := ctrl.svc.ListRules(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, rules)
}

type createRuleReq struct {
	Pattern string   `json:"pattern" binding:"required"`
	Tags    []string `json:"tags"    binding:"required,min=1"`
}

func (ctrl *AdminTagRuleController) CreateRule(c *gin.Context) {
	var req createRuleReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	rule, err := ctrl.svc.CreateRule(c.Request.Context(), req.Pattern, req.Tags)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, rule)
}

func (ctrl *AdminTagRuleController) DeleteRule(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	if err := ctrl.svc.DeleteRule(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

func (ctrl *AdminTagRuleController) PopularUnmatched(c *gin.Context) {
	limit := 20
	if l := c.Query("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 {
			limit = n
		}
	}
	entries, err := ctrl.svc.PopularUnmatched(c.Request.Context(), userIDFromContext(c), limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, entries)
}
