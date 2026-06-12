package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/ndhack/backend/fabric"
	"github.com/ndhack/backend/models"
)

// LandHandler serves the land registry API.
type LandHandler struct {
	pool    *fabric.Pool
	defOrg  string
	defUser string
}

// NewLandHandler creates a LandHandler.
func NewLandHandler(pool *fabric.Pool, defOrg, defUser string) *LandHandler {
	return &LandHandler{pool: pool, defOrg: defOrg, defUser: defUser}
}

// ── Identity resolution ─────────────────────────────────────────────
//
// The client can pass X-Identity: org/user (e.g. "province1/User1").
// Falls back to the default configured identity.

func (h *LandHandler) resolveIdentity(c *gin.Context) (*fabric.Client, error) {
	org := h.defOrg
	user := h.defUser
	if hdr := c.GetHeader("X-Identity"); hdr != "" {
		org, user, _ = strings.Cut(hdr, "/")
		if org == "" || user == "" {
			return nil, fmt.Errorf("invalid X-Identity header: %s", hdr)
		}
	}
	if org == "" || user == "" {
		return nil, fmt.Errorf("no identity configured")
	}
	return h.pool.Get(org, user)
}

// ── GET handlers ────────────────────────────────────────────────────

func (h *LandHandler) GetAllLand(c *gin.Context) {
	cli, err := h.resolveIdentity(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Error: err.Error()})
		return
	}
	raw, err := cli.Evaluate("GetAllLand")
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Error: err.Error()})
		return
	}
	sendJSON(c, raw)
}

func (h *LandHandler) QueryLand(c *gin.Context) {
	plotID := c.Query("id")
	owner := c.Query("owner")
	status := c.Query("status")
	province := c.Query("province")
	parent := c.Query("parent")

	cli, err := h.resolveIdentity(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Error: err.Error()})
		return
	}

	var raw []byte

	switch {
	case plotID != "":
		raw, err = cli.Evaluate("QueryLand", plotID)
	case owner != "":
		raw, err = cli.Evaluate("GetLandByOwner", owner)
	case status != "":
		raw, err = cli.Evaluate("GetLandByStatus", status)
	case province != "":
		raw, err = cli.Evaluate("GetLandByProvince", province)
	case parent != "":
		raw, err = cli.Evaluate("GetChildrenOf", parent)
	default:
		raw, err = cli.Evaluate("GetAllLand")
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Error: err.Error()})
		return
	}
	sendJSON(c, raw)
}

// sendJSON ensures the response is never nil (Gin sends "null" for nil bytes).
func sendJSON(c *gin.Context, raw []byte) {
	if raw == nil {
		c.Data(http.StatusOK, "application/json", []byte("[]"))
		return
	}
	c.Data(http.StatusOK, "application/json", raw)
}

// ── POST handler ────────────────────────────────────────────────────

func (h *LandHandler) PostAction(c *gin.Context) {
	var req models.ActionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Error: "invalid JSON: " + err.Error()})
		return
	}

	cli, err := h.resolveIdentity(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Error: err.Error()})
		return
	}

	switch req.Action {
	case "register":
		h.handleRegister(cli, c, &req)
	case "transfer":
		h.handleTransfer(cli, c, &req)
	case "split":
		h.handleSplit(cli, c, &req)
	case "mortgage":
		h.handleMortgage(cli, c, &req)
	case "clear-mortgage":
		h.handleClearMortgage(cli, c, &req)
	case "dispute":
		h.handleDispute(cli, c, &req)
	case "resolve-dispute":
		h.handleResolveDispute(cli, c, &req)
	default:
		c.JSON(http.StatusBadRequest, models.APIResponse{Error: "unknown action: " + req.Action})
	}
}

func (h *LandHandler) handleRegister(cli *fabric.Client, c *gin.Context, req *models.ActionRequest) {
	if req.PlotID == "" || req.Owner == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{Error: "plotId + owner required"})
		return
	}
	landType := req.LandType
	if landType == "" {
		landType = "residential"
	}
	_, err := cli.Submit("RegisterLand",
		req.PlotID,
		req.SurveyNumber,
		req.Owner,
		req.Location,
		req.Province,
		strconv.FormatFloat(req.Area, 'f', -1, 64),
		landType,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Error: err.Error()})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true})
}

func (h *LandHandler) handleTransfer(cli *fabric.Client, c *gin.Context, req *models.ActionRequest) {
	if req.PlotID == "" || req.Buyer == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{Error: "plotId + buyer required"})
		return
	}
	_, err := cli.Submit("TransferLand", req.PlotID, req.Buyer, strconv.FormatFloat(req.Price, 'f', -1, 64))
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Error: err.Error()})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true})
}

func (h *LandHandler) handleSplit(cli *fabric.Client, c *gin.Context, req *models.ActionRequest) {
	if req.PlotID == "" || len(req.Children) == 0 {
		c.JSON(http.StatusBadRequest, models.APIResponse{Error: "plotId + children required"})
		return
	}
	childrenJSON, err := json.Marshal(req.Children)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Error: "invalid children: " + err.Error()})
		return
	}
	_, err = cli.Submit("SplitLand", req.PlotID, string(childrenJSON))
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Error: err.Error()})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true})
}

func (h *LandHandler) handleMortgage(cli *fabric.Client, c *gin.Context, req *models.ActionRequest) {
	if req.PlotID == "" || req.Bank == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{Error: "plotId + bank required"})
		return
	}
	_, err := cli.Submit("SetMortgage",
		req.PlotID,
		req.Bank,
		strconv.FormatFloat(req.Amount, 'f', -1, 64),
		req.StartDate,
		req.EndDate,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Error: err.Error()})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true})
}

func (h *LandHandler) handleClearMortgage(cli *fabric.Client, c *gin.Context, req *models.ActionRequest) {
	if req.PlotID == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{Error: "plotId required"})
		return
	}
	_, err := cli.Submit("ClearMortgage", req.PlotID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Error: err.Error()})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true})
}

func (h *LandHandler) handleDispute(cli *fabric.Client, c *gin.Context, req *models.ActionRequest) {
	if req.PlotID == "" || req.CaseNumber == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{Error: "plotId + caseNumber required"})
		return
	}
	_, err := cli.Submit("FileDispute",
		req.PlotID,
		req.CaseNumber,
		req.Court,
		req.Description,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Error: err.Error()})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true})
}

func (h *LandHandler) handleResolveDispute(cli *fabric.Client, c *gin.Context, req *models.ActionRequest) {
	if req.PlotID == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{Error: "plotId required"})
		return
	}
	_, err := cli.Submit("ResolveDispute", req.PlotID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Error: err.Error()})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true})
}
