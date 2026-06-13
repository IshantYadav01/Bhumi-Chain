package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/hyperledger/fabric-protos-go-apiv2/common"
	"google.golang.org/protobuf/proto"

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
	role, _ := c.Get("msp_role")
	callerID, _ := nid.(string)
	mspUser := "Admin"
	if r, ok := role.(string); ok && r != "admin" {
		mspUser = "User1"
	}
	client, err := h.pool.Get(h.defOrg, mspUser)
	if err != nil {
		return nil, callerID
	}
	return client, callerID
}

// submitFresh uses the cached client for Submit — avoids peer connection limits.
func (h *LandHandler) submitFresh(c *gin.Context, fcn string, args ...string) ([]byte, error) {
	cli, _ := h.getClient(c)
	if cli == nil {
		return nil, fmt.Errorf("backend not ready")
	}
	return cli.Submit(fcn, args...)
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
	case action == "explorer":
		raw, err = h.handleBlockExplorer(cli, c)
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

// assertAdmin checks the JWT role before allowing admin actions.
func assertAdmin(c *gin.Context) bool {
	role, _ := c.Get("msp_role")
	if r, ok := role.(string); ok && r == "admin" {
		return true
	}
	c.JSON(http.StatusForbidden, models.APIResponse{Error: "admin access required"})
	return false
}

// ── Admin ───────────────────────────────────────────────────────────

func (h *LandHandler) handleRegister(cli *fabric.Client, c *gin.Context, req *models.ActionRequest) {
	if !assertAdmin(c) {
		return
	}
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
	_, err := h.submitFresh(c, "ListForSale", cid, req.LandID,
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
	_, err := h.submitFresh(c, "CancelListing", cid, req.LandID)
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
	raw, err := h.submitFresh(c, "MakeOffer", cid, req.LandID,
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
	_, err := h.submitFresh(c, "AcceptOffer", cid, req.OfferID)
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
	_, err := h.submitFresh(c, "ConfirmTransaction", cid, req.TxID)
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
	_, err := h.submitFresh(c, "RejectTransaction", cid, req.TxID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Error: err.Error()})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true})
}

// ── Block Explorer ─────────────────────────────────────────────────

// blockInfo is a human-readable block summary.
type blockInfo struct {
	Number       uint64   `json:"number"`
	TxCount      int      `json:"txCount"`
	DataHash     string   `json:"dataHash"`
	PrevHash     string   `json:"prevHash"`
	Transactions []txInfo `json:"transactions,omitempty"`
	Timestamp    string   `json:"timestamp,omitempty"`
}

type txInfo struct {
	TxID      string `json:"txId"`
	Chaincode string `json:"chaincode,omitempty"`
	Action    string `json:"action,omitempty"`
	Creator   string `json:"creator,omitempty"`
}

type explorerData struct {
	Height uint64      `json:"height"`
	Blocks []blockInfo `json:"blocks"`
}

func (h *LandHandler) handleBlockExplorer(cli *fabric.Client, c *gin.Context) ([]byte, error) {
	chainInfoRaw, err := cli.EvaluateQSCC("GetChainInfo", "mychannel")
	if err != nil {
		return nil, fmt.Errorf("chain info: %w", err)
	}
	info := &common.BlockchainInfo{}
	if err := proto.Unmarshal(chainInfoRaw, info); err != nil {
		return nil, fmt.Errorf("unmarshal chain info: %w", err)
	}

	height := info.Height
	limit := 10
	n := c.Query("blocks")
	if n != "" {
		if v, err := strconv.Atoi(n); err == nil && v > 0 && v < 100 {
			limit = v
		}
	}

	start := uint64(0)
	if height > uint64(limit) {
		start = height - uint64(limit)
	}

	var blocks []blockInfo
	for i := start; i < height; i++ {
		blockRaw, err := cli.EvaluateQSCC("GetBlockByNumber", "mychannel", strconv.FormatUint(i, 10))
		if err != nil {
			continue
		}
		block := &common.Block{}
		if err := proto.Unmarshal(blockRaw, block); err != nil {
			continue
		}
		bi := blockInfo{
			Number:   block.Header.Number,
			DataHash: fmt.Sprintf("%x", block.Header.DataHash),
			PrevHash: fmt.Sprintf("%x", block.Header.PreviousHash),
		}
		for _, data := range block.Data.Data {
			env := &common.Envelope{}
			if err := proto.Unmarshal(data, env); err != nil {
				continue
			}
			payload := &common.Payload{}
			if err := proto.Unmarshal(env.Payload, payload); err != nil {
				continue
			}
			chdr := &common.ChannelHeader{}
			if err := proto.Unmarshal(payload.Header.ChannelHeader, chdr); err != nil {
				continue
			}
			bi.TxCount++
			bi.Transactions = append(bi.Transactions, txInfo{TxID: chdr.TxId})
		}
		blocks = append(blocks, bi)
	}

	result := explorerData{Height: height, Blocks: blocks}
	return json.Marshal(result)
}
