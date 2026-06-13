package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/ndhack/backend/fabric"
	"github.com/ndhack/backend/models"
)

type LandHandler struct {
	pool   *fabric.Pool
	defOrg string
}

func NewLandHandler(pool *fabric.Pool, defOrg string) *LandHandler {
	return &LandHandler{pool: pool, defOrg: defOrg}
}

func (h *LandHandler) getClient(c *gin.Context) (*fabric.Client, string) {
	nid, _ := c.Get("msp_nid")
	callerID, _ := nid.(string)
	client, err := h.pool.Get(h.defOrg, "Admin")
	if err != nil {
		return nil, callerID
	}
	return client, callerID
}

// ── GET ─────────────────────────────────────────────────────────────

func (h *LandHandler) QueryLand(c *gin.Context) {
	cli, callerID := h.getClient(c)
	if cli == nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Error: "backend not ready"})
		return
	}

	plotID := c.Query("id")
	action := c.Query("action")
	var raw []byte
	var err error

	switch {
	case action == "my-lands":
		raw, err = cli.Evaluate("GetMyLands", callerID)
	case action == "listings":
		raw, err = cli.Evaluate("GetListings")
	case action == "my-offers":
		raw, err = cli.Evaluate("GetMyOffers", callerID)
	case action == "my-transactions":
		raw, err = cli.Evaluate("GetMyTransactions", callerID)
	case action == "pending-transactions":
		raw, err = cli.Evaluate("GetPendingTransactions")
	case c.Query("landId") != "":
		raw, err = cli.Evaluate("GetOffersForLand", callerID, c.Query("landId"))
	case plotID != "":
		raw, err = cli.Evaluate("QueryLand", plotID)
	default:
		raw, err = cli.Evaluate("GetAllLand")
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Error: err.Error()})
		return
	}
	sendJSON(c, raw)
}

func sendJSON(c *gin.Context, raw []byte) {
	if raw == nil {
		c.Data(http.StatusOK, "application/json", []byte("[]"))
		return
	}
	c.Data(http.StatusOK, "application/json", raw)
}

// ── POST ────────────────────────────────────────────────────────────

func (h *LandHandler) PostAction(c *gin.Context) {
	var req models.ActionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Error: "invalid JSON: " + err.Error()})
		return
	}

	cli, callerID := h.getClient(c)
	if cli == nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Error: "backend not ready"})
		return
	}

	switch req.Action {
	case "register":
		h.handleRegister(cli, c, &req)
	case "list-for-sale":
		h.handleListForSale(cli, callerID, c, &req)
	case "cancel-listing":
		h.handleCancelListing(cli, callerID, c, &req)
	case "make-offer":
		h.handleMakeOffer(cli, callerID, c, &req)
	case "accept-offer":
		h.handleAcceptOffer(cli, callerID, c, &req)
	case "confirm-transaction":
		h.handleConfirmTransaction(cli, callerID, c, &req)
	case "reject-transaction":
		h.handleRejectTransaction(cli, callerID, c, &req)
	case "admin-approve":
		h.handleAdminApprove(cli, c, &req)
	default:
		c.JSON(http.StatusBadRequest, models.APIResponse{Error: "unknown action: " + req.Action})
	}
}

// ── Admin ───────────────────────────────────────────────────────────

func (h *LandHandler) handleRegister(cli *fabric.Client, c *gin.Context, req *models.ActionRequest) {
	if req.PlotID == "" || req.Owner == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{Error: "plotId + owner required"})
		return
	}
	_, err := cli.Submit("RegisterLand", req.PlotID, req.Owner, req.Location,
		strconv.FormatFloat(req.Area, 'f', -1, 64))
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Error: err.Error()})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true})
}

func (h *LandHandler) handleAdminApprove(cli *fabric.Client, c *gin.Context, req *models.ActionRequest) {
	if req.TxID == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{Error: "txId required"})
		return
	}
	_, err := cli.Submit("AdminApproveTransaction", req.TxID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Error: err.Error()})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true})
}

// ── Customer ────────────────────────────────────────────────────────

func (h *LandHandler) handleListForSale(cli *fabric.Client, cid string, c *gin.Context, req *models.ActionRequest) {
	if req.LandID == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{Error: "landId required"})
		return
	}
	_, err := cli.Submit("ListForSale", cid, req.LandID,
		strconv.FormatFloat(req.Price, 'f', -1, 64))
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Error: err.Error()})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true})
}

func (h *LandHandler) handleCancelListing(cli *fabric.Client, cid string, c *gin.Context, req *models.ActionRequest) {
	if req.LandID == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{Error: "landId required"})
		return
	}
	_, err := cli.Submit("CancelListing", cid, req.LandID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Error: err.Error()})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true})
}

func (h *LandHandler) handleMakeOffer(cli *fabric.Client, cid string, c *gin.Context, req *models.ActionRequest) {
	if req.LandID == "" || req.OfferedPrice <= 0 {
		c.JSON(http.StatusBadRequest, models.APIResponse{Error: "landId + offeredPrice required"})
		return
	}
	raw, err := cli.Submit("MakeOffer", cid, req.LandID,
		strconv.FormatFloat(req.OfferedPrice, 'f', -1, 64))
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Error: err.Error()})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: strings.Trim(string(raw), "\"")})
}

func (h *LandHandler) handleAcceptOffer(cli *fabric.Client, cid string, c *gin.Context, req *models.ActionRequest) {
	if req.OfferID == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{Error: "offerId required"})
		return
	}
	_, err := cli.Submit("AcceptOffer", cid, req.OfferID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Error: err.Error()})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true})
}

func (h *LandHandler) handleConfirmTransaction(cli *fabric.Client, cid string, c *gin.Context, req *models.ActionRequest) {
	if req.TxID == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{Error: "txId required"})
		return
	}
	_, err := cli.Submit("ConfirmTransaction", cid, req.TxID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Error: err.Error()})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true})
}

func (h *LandHandler) handleRejectTransaction(cli *fabric.Client, cid string, c *gin.Context, req *models.ActionRequest) {
	if req.TxID == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{Error: "txId required"})
		return
	}
	_, err := cli.Submit("RejectTransaction", cid, req.TxID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Error: err.Error()})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true})
}
