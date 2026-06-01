package controller

import (
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"arasaka/internal/middleware"
	"arasaka/internal/service"
)

const (
	maxTotalMemory = 64 << 20 // 64 MB total multipart memory
	maxFileSize    = 10 << 20 // 10 MB per file
	maxFiles       = 12
)

// ImportController handles PDF cartola upload and import.
type ImportController struct {
	svc *service.ImportService
}

// NewImportController creates a new ImportController.
func NewImportController(svc *service.ImportService) *ImportController {
	return &ImportController{svc: svc}
}

// ImportPDF handles POST /api/import/pdf.
//
// Expects multipart/form-data with:
//   - account_id  (string, required)
//   - files       (repeated; each part must be a PDF, max 10 MB, up to 20 files)
//
// The logged-in user (from JWT) must own the account; the bank is resolved from
// the account record, never trusted from the client.
func (ctrl *ImportController) ImportPDF(c *gin.Context) {
	userID := c.GetInt64(middleware.UserIDKey)

	if err := c.Request.ParseMultipartForm(maxTotalMemory); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid multipart form: " + err.Error()})
		return
	}

	accountIDStr := c.Request.FormValue("account_id")
	if accountIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "account_id is required"})
		return
	}
	accountID, err := strconv.ParseInt(accountIDStr, 10, 64)
	if err != nil || accountID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid account_id"})
		return
	}

	mf := c.Request.MultipartForm
	if mf == nil || len(mf.File["files"]) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "at least one PDF file is required (field name: files)"})
		return
	}

	fileHeaders := mf.File["files"]
	if len(fileHeaders) > maxFiles {
		c.JSON(http.StatusBadRequest, gin.H{"error": "too many files (max 20)"})
		return
	}

	var named []service.NamedPDF
	for _, fh := range fileHeaders {
		if !isPDF(fh.Filename, fh.Header.Get("Content-Type")) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "file " + fh.Filename + " is not a PDF"})
			return
		}
		if fh.Size > maxFileSize {
			c.JSON(http.StatusBadRequest, gin.H{"error": "file " + fh.Filename + " exceeds 10 MB limit"})
			return
		}

		f, err := fh.Open()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not read file: " + err.Error()})
			return
		}
		data, err := io.ReadAll(f)
		f.Close()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not read file: " + err.Error()})
			return
		}
		named = append(named, service.NamedPDF{Filename: fh.Filename, Data: data})
	}

	result, err := ctrl.svc.ImportPDFs(c.Request.Context(), userID, accountID, named)
	if err != nil {
		msg := err.Error()
		if msg == "forbidden" {
			c.JSON(http.StatusForbidden, gin.H{"error": "account not found or access denied"})
			return
		}
		if strings.HasPrefix(msg, "bank") {
			c.JSON(http.StatusBadRequest, gin.H{"error": msg})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, result)
}

// isPDF returns true when the filename ends in .pdf or the Content-Type is PDF.
func isPDF(filename, contentType string) bool {
	if strings.HasSuffix(strings.ToLower(filename), ".pdf") {
		return true
	}
	return strings.Contains(strings.ToLower(contentType), "pdf")
}
