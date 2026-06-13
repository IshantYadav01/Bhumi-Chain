package handlers

import (
	"encoding/json"
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
	// Prefer JWT-derived identity set by middleware.
	org, _ := c.Get("msp_org")
	user, _ := c.Get("msp_user")

	orgStr, _ := org.(string)
	userStr, _ := user.(string)

	if orgStr != "" && userStr != "" {
		return h.pool.Get(orgStr, userStr)
	}

	// Fallback: X-Identity header (legacy).
	if hdr := c.GetHeader("X-Identity"); hdr != "" {
		var o, u string
		o, u, _ = strings.Cut(hdr, "/")
		if o != "" && u != "" {
			return h.pool.Get(o, u)
		}
	}

	// Ultimate fallback: default identity.
	return h.pool.Get(h.defOrg, h.defUser)
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
	userID := c.Query("userId")

	cli, err := h.resolveIdentity(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Error: err.Error()})
		return
	}

	var raw []byte

	switch {
	case userID != "":
		raw, err = cli.Evaluate("GetUser", userID)
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
	case c.Query("saleId") != "":
		raw, err = cli.Evaluate("GetSaleProposal", c.Query("saleId"))
	case c.Query("pendingApprovals") != "":
		raw, err = cli.Evaluate("GetPendingApprovals")
	case c.Query("mySales") != "":
		raw, err = cli.Evaluate("GetMySaleProposals")
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
	case "register-user":
		h.handleRegisterUser(cli, c, &req)
	case "get-user":
		h.handleGetUser(cli, c, &req)
	case "update-user":
		h.handleUpdateUser(cli, c, &req)
	case "deactivate-user":
		h.handleDeactivateUser(cli, c, &req)
	case "activate-user":
		h.handleActivateUser(cli, c, &req)
	case "get-all-users":
		h.handleGetAllUsers(cli, c, &req)
	case "initiate-sale":
		h.handleInitiateSale(cli, c, &req)
	case "approve-sale":
		h.handleApproveSale(cli, c, &req)
	case "reject-sale":
		h.handleRejectSale(cli, c, &req)
	case "execute-sale":
		h.handleExecuteSale(cli, c, &req)
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

// ── User management handlers ──────────────────────────────────────

func (h *LandHandler) handleRegisterUser(cli *fabric.Client, c *gin.Context, req *models.ActionRequest) {
	if req.UserID == "" || req.UserName == "" || req.UserRoles == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{Error: "userId, name, roles required"})
		return
	}
	_, err := cli.Submit("RegisterUser", req.UserID, req.UserName, req.UserRoles)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Error: err.Error()})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true})
}

func (h *LandHandler) handleGetUser(cli *fabric.Client, c *gin.Context, req *models.ActionRequest) {
	userID := c.Query("userId")
	if userID == "" {
		userID = req.UserID
	}
	if userID == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{Error: "userId required"})
		return
	}
	raw, err := cli.Evaluate("GetUser", userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Error: err.Error()})
		return
	}
	c.Data(http.StatusOK, "application/json", raw)
}

func (h *LandHandler) handleUpdateUser(cli *fabric.Client, c *gin.Context, req *models.ActionRequest) {
	if req.UserID == "" || req.UserRoles == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{Error: "userId, roles required"})
		return
	}
	_, err := cli.Submit("UpdateUserRoles", req.UserID, req.UserRoles)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Error: err.Error()})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true})
}

func (h *LandHandler) handleDeactivateUser(cli *fabric.Client, c *gin.Context, req *models.ActionRequest) {
	if req.UserID == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{Error: "userId required"})
		return
	}
	_, err := cli.Submit("DeactivateUser", req.UserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Error: err.Error()})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true})
}

func (h *LandHandler) handleGetAllUsers(cli *fabric.Client, c *gin.Context, req *models.ActionRequest) {
	raw, err := cli.Evaluate("GetAllUsers")
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Error: err.Error()})
		return
	}
	c.Data(http.StatusOK, "application/json", raw)
}

func (h *LandHandler) handleActivateUser(cli *fabric.Client, c *gin.Context, req *models.ActionRequest) {
	if req.UserID == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{Error: "userId required"})
		return
	}
	_, err := cli.Submit("ActivateUser", req.UserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Error: err.Error()})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true})
}

// ── Sale proposal handlers ─────────────────────────────────────────

func (h *LandHandler) handleInitiateSale(cli *fabric.Client, c *gin.Context, req *models.ActionRequest) {
	if req.PlotID == "" || req.Buyer == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{Error: "plotId + buyer required"})
		return
	}
	raw, err := cli.Submit("InitiateSaleProposal", req.PlotID, req.Buyer, strconv.FormatFloat(req.Price, 'f', -1, 64))
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Error: err.Error()})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: string(raw)})
}

func (h *LandHandler) handleApproveSale(cli *fabric.Client, c *gin.Context, req *models.ActionRequest) {
	if req.PlotID == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{Error: "plotId (proposal ID) required"})
		return
	}
	_, err := cli.Submit("ApproveSaleProposal", req.PlotID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Error: err.Error()})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true})
}

func (h *LandHandler) handleRejectSale(cli *fabric.Client, c *gin.Context, req *models.ActionRequest) {
	if req.PlotID == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{Error: "plotId (proposal ID) + description (reason) required"})
		return
	}
	_, err := cli.Submit("RejectSaleProposal", req.PlotID, req.Description)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Error: err.Error()})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true})
}

func (h *LandHandler) handleExecuteSale(cli *fabric.Client, c *gin.Context, req *models.ActionRequest) {
	if req.PlotID == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{Error: "plotId (proposal ID) required"})
		return
	}
	_, err := cli.Submit("ExecuteSaleProposal", req.PlotID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Error: err.Error()})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true})
}
