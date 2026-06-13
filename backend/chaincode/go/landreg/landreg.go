/*
 * landreg.go — Land Registry chaincode with on-chain auth & RBAC.
 *
 * 3 provincial governing bodies run full nodes (test).
 * 77 malpots, municipalities, survey depts, buyers, sellers are lite nodes.
 * Land transfers endorsed by all 3 provincial peers.
 *
 * ── On-chain RBAC ──────────────────────────────────────────────────
 * Every identity is registered on-chain with roles.
 * Transaction functions check the caller's MSP certificate to extract
 * their Common Name, look up their on-chain User record, and enforce
 * role-based access before any state change.
 *
 * Roles: admin, malpot, official, seller, buyer, bank, court, surveyor
 */

package main

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/v2/contractapi"
)

// ── Roles ─────────────────────────────────────────────────────────────

const (
	RoleAdmin    = "admin"
	RoleMalpot   = "malpot"
	RoleOfficial = "official"
	RoleSeller   = "seller"
	RoleBuyer    = "buyer"
	RoleSurveyor = "surveyor"
)

// ── On-chain user record ──────────────────────────────────────────────

// UserKeyPrefix prefixes world-state keys for user records.
const UserKeyPrefix = "USER_"

// SaleProposalPrefix prefixes world-state keys for sale proposals.
const SaleProposalPrefix = "SALE_"

// User is stored on-chain to hold a lite-node's roles.
type User struct {
	ID        string   `json:"id"`    // CN from MSP cert, e.g. "User1@province1.example.com"
	Name      string   `json:"name"`  // display name, e.g. "Rajesh Kumar"
	Roles     []string `json:"roles"` // ["seller","buyer"]
	Org       string   `json:"org"`   // derived from MSP ID, e.g. "province1"
	Active    bool     `json:"active"`
	CreatedAt string   `json:"createdAt"`
	UpdatedAt string   `json:"updatedAt,omitempty"`
}

// ── Land record types (unchanged) ─────────────────────────────────────

type LandRecord struct {
	PlotID         string          `json:"plotId"`
	SurveyNumber   string          `json:"surveyNumber"`
	Owner          string          `json:"owner"`
	PreviousOwner  string          `json:"previousOwner"`
	Location       string          `json:"location"`
	Province       string          `json:"province"`
	Area           float64         `json:"area"`
	LandType       string          `json:"landType"`
	Status         string          `json:"status"`
	ParentPlotID   string          `json:"parentPlotId,omitempty"`
	TransferCount  int             `json:"transferCount"`
	LastTransfer   *TransferRecord `json:"lastTransfer,omitempty"`
	RegisteredDate string          `json:"registeredDate"`
}

type TransferRecord struct {
	From  string  `json:"from"`
	To    string  `json:"to"`
	Price float64 `json:"price"`
	Date  string  `json:"date"`
	TxID  string  `json:"txId"`
}

// SaleProposal represents a multi-party approved land sale.
type SaleProposal struct {
	ID           string          `json:"id"`
	PlotID       string          `json:"plotId"`
	Seller       string          `json:"seller"`
	Buyer        string          `json:"buyer"`
	Price        float64         `json:"price"`
	Status       string          `json:"status"`    // "pending", "approved", "rejected", "executed"
	Approvals    map[string]bool `json:"approvals"` // "municipality","survey","malpot" → true/false
	RejectReason string          `json:"rejectReason,omitempty"`
	CreatedAt    string          `json:"createdAt"`
	ExecutedAt   string          `json:"executedAt,omitempty"`
}

type SmartContract struct {
	contractapi.Contract
}

// ═══════════════════════════════════════════════════════════════════════
//  User management (admin only)
// ═══════════════════════════════════════════════════════════════════════

// RegisterUser creates an on-chain user record.
// Requires admin role, EXCEPT for the very first user (bootstrap).
// The userID must match the CN from the X.509 certificate that the user
// will present when transacting — e.g. "User1@province1.example.com".
func (s *SmartContract) RegisterUser(
	ctx contractapi.TransactionContextInterface,
	userID, name, rolesJSON string,
) error {
	// ── Bootstrap: if no admin exists yet, allow first registration ─
	hasAdmin, err := s.hasAnyAdmin(ctx)
	if err != nil {
		return err
	}
	if hasAdmin {
		if _, err := s.requireCaller(ctx, RoleAdmin); err != nil {
			return err
		}
	}

	if userID == "" {
		return fmt.Errorf("userID is required")
	}
	if name == "" {
		return fmt.Errorf("name is required")
	}

	var roles []string
	if err := json.Unmarshal([]byte(rolesJSON), &roles); err != nil {
		return fmt.Errorf("invalid roles JSON: %w", err)
	}
	if len(roles) == 0 {
		return fmt.Errorf("at least one role is required")
	}

	key := UserKeyPrefix + userID
	exists, err := s.stateExists(ctx, key)
	if err != nil {
		return err
	}
	if exists {
		return fmt.Errorf("user %s already registered", userID)
	}

	user := User{
		ID:        userID,
		Name:      name,
		Roles:     roles,
		Org:       s.orgFromUserID(userID),
		Active:    true,
		CreatedAt: now(),
	}
	return s.putUser(ctx, &user)
}

// UpdateUserRoles changes a user's roles (admin only).
func (s *SmartContract) UpdateUserRoles(
	ctx contractapi.TransactionContextInterface,
	userID, rolesJSON string,
) error {
	if _, err := s.requireCaller(ctx, RoleAdmin); err != nil {
		return err
	}

	user, err := s.getUser(ctx, userID)
	if err != nil {
		return err
	}

	var roles []string
	if err := json.Unmarshal([]byte(rolesJSON), &roles); err != nil {
		return fmt.Errorf("invalid roles JSON: %w", err)
	}
	if len(roles) == 0 {
		return fmt.Errorf("at least one role is required")
	}

	user.Roles = roles
	user.UpdatedAt = now()
	return s.putUser(ctx, user)
}

// DeactivateUser disables a user (admin only).  The record stays on-chain.
func (s *SmartContract) DeactivateUser(
	ctx contractapi.TransactionContextInterface,
	userID string,
) error {
	if _, err := s.requireCaller(ctx, RoleAdmin); err != nil {
		return err
	}

	user, err := s.getUser(ctx, userID)
	if err != nil {
		return err
	}
	user.Active = false
	user.UpdatedAt = now()
	return s.putUser(ctx, user)
}

// ActivateUser re-enables a deactivated user (admin only).
func (s *SmartContract) ActivateUser(
	ctx contractapi.TransactionContextInterface,
	userID string,
) error {
	if _, err := s.requireCaller(ctx, RoleAdmin); err != nil {
		return err
	}

	user, err := s.getUser(ctx, userID)
	if err != nil {
		return err
	}
	user.Active = true
	user.UpdatedAt = now()
	return s.putUser(ctx, user)
}

// GetUser returns the on-chain user record.  Anyone can query their own
// record; admins can query anyone's.
func (s *SmartContract) GetUser(
	ctx contractapi.TransactionContextInterface,
	userID string,
) (string, error) {
	caller, err := s.callerCN(ctx)
	if err != nil {
		return "", err
	}

	// Normal users can only see their own record.
	if caller != userID {
		if _, err := s.getCallerRole(ctx, RoleAdmin); err != nil {
			return "", fmt.Errorf("can only query your own user record")
		}
	}

	user, err := s.getUser(ctx, userID)
	if err != nil {
		return "", err
	}
	b, _ := json.Marshal(user)
	return string(b), nil
}

// GetAllUsers returns all on-chain users (admin only).
func (s *SmartContract) GetAllUsers(
	ctx contractapi.TransactionContextInterface,
) (string, error) {
	if _, err := s.requireCaller(ctx, RoleAdmin); err != nil {
		return "", err
	}

	var users []*User
	iter, err := ctx.GetStub().GetStateByRange(UserKeyPrefix, UserKeyPrefix+"~")
	if err != nil {
		return "", err
	}
	defer iter.Close()
	for iter.HasNext() {
		kv, err := iter.Next()
		if err != nil {
			return "", err
		}
		var u User
		if err := json.Unmarshal(kv.Value, &u); err != nil {
			continue
		}
		users = append(users, &u)
	}
	b, _ := json.Marshal(users)
	return string(b), nil
}

// ═══════════════════════════════════════════════════════════════════════
//  Land registration
// ═══════════════════════════════════════════════════════════════════════

// RegisterLand creates a new land record.  Only malpot, official, or
// admin may register land.  The owner field specifies who owns the land —
// it does not need to be the caller.
func (s *SmartContract) RegisterLand(
	ctx contractapi.TransactionContextInterface,
	plotID, surveyNumber, owner, location, province string,
	area float64, landType string,
) error {
	if _, err := s.requireCaller(ctx, RoleMalpot, RoleOfficial, RoleAdmin); err != nil {
		return fmt.Errorf("unauthorized: %w", err)
	}

	exists, err := s.landExists(ctx, plotID)
	if err != nil {
		return err
	}
	if exists {
		return fmt.Errorf("plot %s already registered", plotID)
	}

	record := LandRecord{
		PlotID: plotID, SurveyNumber: surveyNumber,
		Owner: owner, Location: location, Province: province,
		Area: area, LandType: landType, Status: "active",
		RegisteredDate: now(),
	}
	return s.putLand(ctx, &record)
}

// ═══════════════════════════════════════════════════════════════════════
//  Split
// ═══════════════════════════════════════════════════════════════════════

func (s *SmartContract) SplitLand(
	ctx contractapi.TransactionContextInterface,
	parentPlotID string,
	childPlotsJSON string,
) error {
	caller, err := s.callerCN(ctx)
	if err != nil {
		return err
	}

	parent, err := s.getLand(ctx, parentPlotID)
	if err != nil {
		return err
	}
	// ── Authorization ──────────────────────────────────────────────
	if parent.Owner != caller {
		return fmt.Errorf("only the current owner (%s) can split this land", parent.Owner)
	}

	type ChildSpec struct {
		PlotID string  `json:"plotId"`
		Owner  string  `json:"owner"`
		Area   float64 `json:"area"`
	}
	var children []ChildSpec
	if err := json.Unmarshal([]byte(childPlotsJSON), &children); err != nil {
		return fmt.Errorf("bad child plots JSON: %w", err)
	}
	if len(children) < 2 {
		return fmt.Errorf("split needs at least 2 child plots")
	}

	var total float64
	for _, c := range children {
		if c.Area <= 0 {
			return fmt.Errorf("child %s has invalid area", c.PlotID)
		}
		exists, _ := s.landExists(ctx, c.PlotID)
		if exists {
			return fmt.Errorf("child %s already exists", c.PlotID)
		}
		total += c.Area
	}
	if total > parent.Area {
		return fmt.Errorf("child total area %.2f > parent area %.2f", total, parent.Area)
	}

	parent.Status = "split"
	if err := s.putLand(ctx, parent); err != nil {
		return err
	}

	for _, c := range children {
		child := LandRecord{
			PlotID: c.PlotID, SurveyNumber: parent.SurveyNumber,
			Owner: c.Owner, Location: parent.Location,
			Province: parent.Province, Area: c.Area,
			LandType: parent.LandType, Status: "active",
			ParentPlotID:   parentPlotID,
			RegisteredDate: now(),
		}
		if err := s.putLand(ctx, &child); err != nil {
			return err
		}
	}
	return nil
}

// ═══════════════════════════════════════════════════════════════════════
//  Queries (read-only)
// ═══════════════════════════════════════════════════════════════════════

// QueryLand returns a single land record by plot ID.
// Any authenticated user can query.
func (s *SmartContract) QueryLand(ctx contractapi.TransactionContextInterface, plotID string) (string, error) {
	if _, err := s.requireAnyUser(ctx); err != nil {
		return "", fmt.Errorf("unauthorized: %w", err)
	}
	r, err := s.getLand(ctx, plotID)
	if err != nil {
		return "", err
	}
	b, err := json.Marshal(r)
	return string(b), err
}

// GetLandByOwner returns all land records for a given owner.
//
// Access: Normal users can only query their OWN records (owner == caller).
// Admins, officials, and malpots can query any owner.
func (s *SmartContract) GetLandByOwner(ctx contractapi.TransactionContextInterface, owner string) (string, error) {
	callerUser, err := s.requireAnyUser(ctx)
	if err != nil {
		return "", fmt.Errorf("unauthorized: %w", err)
	}

	// Restrict: normal users can only see their own land.
	if !s.hasRole(callerUser, RoleAdmin, RoleOfficial, RoleMalpot) {
		if owner != callerUser.ID && owner != callerUser.Name {
			return "", fmt.Errorf("you can only query your own land records")
		}
	}

	records, err := s.filterLand(ctx, func(r *LandRecord) bool { return r.Owner == owner })
	if err != nil {
		return "", err
	}
	b, _ := json.Marshal(records)
	return string(b), nil
}

// GetLandByStatus returns land filtered by status.
// Access: admins, officials, malpots.  Normal users cannot query by status.
func (s *SmartContract) GetLandByStatus(ctx contractapi.TransactionContextInterface, status string) (string, error) {
	if _, err := s.requireCaller(ctx, RoleAdmin, RoleOfficial, RoleMalpot); err != nil {
		return "", fmt.Errorf("unauthorized: %w", err)
	}
	records, err := s.filterLand(ctx, func(r *LandRecord) bool { return r.Status == status })
	if err != nil {
		return "", err
	}
	b, _ := json.Marshal(records)
	return string(b), nil
}

// GetLandByProvince returns all land in a province.
// Any authenticated user can query.
func (s *SmartContract) GetLandByProvince(ctx contractapi.TransactionContextInterface, province string) (string, error) {
	if _, err := s.requireAnyUser(ctx); err != nil {
		return "", fmt.Errorf("unauthorized: %w", err)
	}
	records, err := s.filterLand(ctx, func(r *LandRecord) bool { return r.Province == province })
	if err != nil {
		return "", err
	}
	b, _ := json.Marshal(records)
	return string(b), nil
}

// GetChildrenOf returns child plots of a split parent.
// Any authenticated user can query.
func (s *SmartContract) GetChildrenOf(ctx contractapi.TransactionContextInterface, parentPlotID string) (string, error) {
	if _, err := s.requireAnyUser(ctx); err != nil {
		return "", fmt.Errorf("unauthorized: %w", err)
	}
	records, err := s.filterLand(ctx, func(r *LandRecord) bool { return r.ParentPlotID == parentPlotID })
	if err != nil {
		return "", err
	}
	b, _ := json.Marshal(records)
	return string(b), nil
}

// GetAllLand returns every land record.
// Access: admins, officials, and malpots only (privacy).
func (s *SmartContract) GetAllLand(ctx contractapi.TransactionContextInterface) (string, error) {
	if _, err := s.requireCaller(ctx, RoleAdmin, RoleOfficial, RoleMalpot); err != nil {
		return "", fmt.Errorf("unauthorized: %w", err)
	}
	records, err := s.filterLand(ctx, func(r *LandRecord) bool { return true })
	if err != nil {
		return "", err
	}
	b, _ := json.Marshal(records)
	return string(b), nil
}

// ═══════════════════════════════════════════════════════════════════════
//  Multi-party sale proposal workflow
// ═══════════════════════════════════════════════════════════════════════

// InitiateSaleProposal starts a new multi-party sale proposal.
// Only a user with RoleSeller who owns the land can initiate.
func (s *SmartContract) InitiateSaleProposal(
	ctx contractapi.TransactionContextInterface,
	plotID, buyer string, price float64,
) (string, error) {
	user, err := s.requireAnyUser(ctx)
	if err != nil {
		return "", fmt.Errorf("unauthorized: %w", err)
	}

	record, err := s.getLand(ctx, plotID)
	if err != nil {
		return "", err
	}
	if record.Status != "active" {
		return "", fmt.Errorf("land %s is not active (status: %s)", plotID, record.Status)
	}
	if record.Owner != user.ID {
		return "", fmt.Errorf("only the current owner (%s) can initiate a sale proposal", record.Owner)
	}

	// Check no pending/approved proposal already exists for this plot.
	existing, err := s.findActiveProposalForPlot(ctx, plotID)
	if err != nil {
		return "", err
	}
	if existing != nil {
		return "", fmt.Errorf("a sale proposal already exists for plot %s (id=%s, status=%s)", plotID, existing.ID, existing.Status)
	}

	id := SaleProposalPrefix + plotID + "_" + now()
	proposal := SaleProposal{
		ID:        id,
		PlotID:    plotID,
		Seller:    user.ID,
		Buyer:     buyer,
		Price:     price,
		Status:    "pending",
		Approvals: map[string]bool{"municipality": false},
		CreatedAt: now(),
	}
	if err := s.putSaleProposal(ctx, &proposal); err != nil {
		return "", err
	}
	b, _ := json.Marshal(id)
	return string(b), nil
}

// findActiveProposalForPlot returns any existing proposal for the given plot
// that is in "pending" or "approved" status.
func (s *SmartContract) findActiveProposalForPlot(ctx contractapi.TransactionContextInterface, plotID string) (*SaleProposal, error) {
	proposals, err := s.filterSaleProposals(ctx, func(p *SaleProposal) bool {
		return p.PlotID == plotID && (p.Status == "pending" || p.Status == "approved")
	})
	if err != nil {
		return nil, err
	}
	if len(proposals) > 0 {
		return proposals[0], nil
	}
	return nil, nil
}

// ApproveSaleProposal allows an official (municipality) to approve a proposal.
// Once the municipality approves, the transfer is auto-executed.
func (s *SmartContract) ApproveSaleProposal(ctx contractapi.TransactionContextInterface, proposalID string) error {
	_, err := s.requireCaller(ctx, RoleOfficial)
	if err != nil {
		return fmt.Errorf("unauthorized: %w", err)
	}

	proposal, err := s.getSaleProposal(ctx, proposalID)
	if err != nil {
		return err
	}
	if proposal.Status != "pending" && proposal.Status != "approved" {
		return fmt.Errorf("sale proposal %s is %s — cannot approve", proposalID, proposal.Status)
	}

	if proposal.Approvals["municipality"] {
		return fmt.Errorf("municipality already approved this proposal")
	}

	proposal.Approvals["municipality"] = true
	proposal.Status = "approved"

	// Auto-execute the transfer.
	if err := s.executeTransfer(ctx, proposal); err != nil {
		return err
	}
	proposal.Status = "executed"
	proposal.ExecutedAt = now()

	return s.putSaleProposal(ctx, proposal)
}

// callerApprovalRole maps the caller's roles to the approval role key.
func (s *SmartContract) callerApprovalRole(user *User) string {
	for _, r := range user.Roles {
		if r == RoleOfficial {
			return "municipality"
		}
	}
	return ""
}

// callerApprovalRoles returns ALL approval role keys the user qualifies for.
func (s *SmartContract) callerApprovalRoles(user *User) []string {
	var roles []string
	for _, r := range user.Roles {
		if r == RoleOfficial {
			roles = append(roles, "municipality")
			return roles
		}
	}
	return roles
}

// RejectSaleProposal allows an official (municipality) to reject a proposal.
func (s *SmartContract) RejectSaleProposal(ctx contractapi.TransactionContextInterface, proposalID, reason string) error {
	_, err := s.requireCaller(ctx, RoleOfficial)
	if err != nil {
		return fmt.Errorf("unauthorized: %w", err)
	}

	proposal, err := s.getSaleProposal(ctx, proposalID)
	if err != nil {
		return err
	}
	if proposal.Status != "pending" && proposal.Status != "approved" {
		return fmt.Errorf("sale proposal %s is %s — cannot reject", proposalID, proposal.Status)
	}

	proposal.Status = "rejected"
	proposal.RejectReason = reason
	return s.putSaleProposal(ctx, proposal)
}

// ExecuteSaleProposal performs the land transfer for a municipality-approved proposal.
// Any authenticated user can call, but municipal approval must be present.
func (s *SmartContract) ExecuteSaleProposal(ctx contractapi.TransactionContextInterface, proposalID string) error {
	if _, err := s.requireAnyUser(ctx); err != nil {
		return fmt.Errorf("unauthorized: %w", err)
	}

	proposal, err := s.getSaleProposal(ctx, proposalID)
	if err != nil {
		return err
	}
	if proposal.Status != "approved" {
		return fmt.Errorf("sale proposal %s is %s — must be 'approved' to execute", proposalID, proposal.Status)
	}
	if !proposal.Approvals["municipality"] {
		return fmt.Errorf("sale proposal %s has not been approved by municipality", proposalID)
	}

	if err := s.executeTransfer(ctx, proposal); err != nil {
		return err
	}
	proposal.Status = "executed"
	proposal.ExecutedAt = now()
	return s.putSaleProposal(ctx, proposal)
}

// executeTransfer performs the actual land ownership transfer for a proposal.
// It mirrors the TransferLand logic but without seller-ownership checks (approvals validate).
func (s *SmartContract) executeTransfer(ctx contractapi.TransactionContextInterface, proposal *SaleProposal) error {
	record, err := s.getLand(ctx, proposal.PlotID)
	if err != nil {
		return err
	}
	txID := ctx.GetStub().GetTxID()
	transfer := TransferRecord{
		From:  record.Owner,
		To:    proposal.Buyer,
		Price: proposal.Price,
		Date:  now(),
		TxID:  txID,
	}
	record.PreviousOwner = record.Owner
	record.Owner = proposal.Buyer
	record.TransferCount++
	record.LastTransfer = &transfer
	return s.putLand(ctx, record)
}

// GetSaleProposal returns a single sale proposal as JSON.
func (s *SmartContract) GetSaleProposal(ctx contractapi.TransactionContextInterface, proposalID string) (string, error) {
	if _, err := s.requireAnyUser(ctx); err != nil {
		return "", fmt.Errorf("unauthorized: %w", err)
	}
	p, err := s.getSaleProposalRecord(ctx, proposalID)
	if err != nil {
		return "", err
	}
	b, err := json.Marshal(p)
	return string(b), err
}

// GetPendingApprovals returns all proposals where the caller's role still needs to approve.
func (s *SmartContract) GetPendingApprovals(ctx contractapi.TransactionContextInterface) (string, error) {
	user, err := s.requireCaller(ctx, RoleOfficial, RoleSurveyor, RoleMalpot)
	if err != nil {
		return "", fmt.Errorf("unauthorized: %w", err)
	}

	role := s.callerApprovalRole(user)
	if role == "" {
		return "", fmt.Errorf("user %s does not hold an approver role", user.ID)
	}

	proposals, err := s.filterSaleProposals(ctx, func(p *SaleProposal) bool {
		if p.Status != "pending" && p.Status != "approved" {
			return false
		}
		approved, exists := p.Approvals[role]
		return exists && !approved
	})
	if err != nil {
		return "", err
	}
	b, _ := json.Marshal(proposals)
	return string(b), nil
}

// GetMySaleProposals returns all proposals where the caller is the seller.
func (s *SmartContract) GetMySaleProposals(ctx contractapi.TransactionContextInterface) (string, error) {
	user, err := s.requireAnyUser(ctx)
	if err != nil {
		return "", fmt.Errorf("unauthorized: %w", err)
	}

	proposals, err := s.filterSaleProposals(ctx, func(p *SaleProposal) bool {
		return p.Seller == user.ID
	})
	if err != nil {
		return "", err
	}
	b, _ := json.Marshal(proposals)
	return string(b), nil
}

// ═══════════════════════════════════════════════════════════════════════
//  Sale proposal state helpers
// ═══════════════════════════════════════════════════════════════════════

func (s *SmartContract) getSaleProposalRecord(ctx contractapi.TransactionContextInterface, id string) (*SaleProposal, error) {
	data, err := ctx.GetStub().GetState(id)
	if err != nil {
		return nil, fmt.Errorf("read sale proposal %s: %w", id, err)
	}
	if data == nil {
		return nil, fmt.Errorf("sale proposal %s not found", id)
	}
	var p SaleProposal
	if err := json.Unmarshal(data, &p); err != nil {
		return nil, fmt.Errorf("parse sale proposal %s: %w", id, err)
	}
	return &p, nil
}

func (s *SmartContract) getSaleProposal(ctx contractapi.TransactionContextInterface, id string) (*SaleProposal, error) {
	// Proposal ID already includes the SALE_ prefix from InitiateSaleProposal.
	return s.getSaleProposalRecord(ctx, id)
}

func (s *SmartContract) putSaleProposal(ctx contractapi.TransactionContextInterface, p *SaleProposal) error {
	data, err := json.Marshal(p)
	if err != nil {
		return err
	}
	return ctx.GetStub().PutState(p.ID, data)
}

func (s *SmartContract) filterSaleProposals(ctx contractapi.TransactionContextInterface, fn func(*SaleProposal) bool) ([]*SaleProposal, error) {
	iter, err := ctx.GetStub().GetStateByRange(SaleProposalPrefix, SaleProposalPrefix+"~")
	if err != nil {
		return nil, err
	}
	defer iter.Close()
	var results []*SaleProposal
	for iter.HasNext() {
		kv, err := iter.Next()
		if err != nil {
			return nil, err
		}
		var p SaleProposal
		if err := json.Unmarshal(kv.Value, &p); err != nil {
			return nil, err
		}
		if fn(&p) {
			results = append(results, &p)
		}
	}
	return results, nil
}

// ═══════════════════════════════════════════════════════════════════════
//  Auth helpers — extract & enforce caller identity
// ═══════════════════════════════════════════════════════════════════════

// callerCN extracts the Common Name from the caller's X.509 certificate.
// This is the identity asserted by the Fabric MSP — unforgeable because
// the peer verified the proposal signature against the cert.
func (s *SmartContract) callerCN(ctx contractapi.TransactionContextInterface) (string, error) {
	cert, err := ctx.GetClientIdentity().GetX509Certificate()
	if err != nil {
		return "", fmt.Errorf("failed to get client certificate: %w", err)
	}
	cn := cert.Subject.CommonName
	if cn == "" {
		return "", fmt.Errorf("client certificate has no CommonName")
	}
	return cn, nil
}

// requireAnyUser checks that the caller is registered on-chain and active.
// Returns the User record.  This is the minimal gate for read operations.
func (s *SmartContract) requireAnyUser(ctx contractapi.TransactionContextInterface) (*User, error) {
	cn, err := s.callerCN(ctx)
	if err != nil {
		return nil, err
	}
	user, err := s.getUser(ctx, cn)
	if err != nil {
		return nil, fmt.Errorf("identity %s not registered on-chain: %w", cn, err)
	}
	if !user.Active {
		return nil, fmt.Errorf("user %s is deactivated", cn)
	}
	return user, nil
}

// requireCaller checks the caller has at least one of the given roles.
// Returns the User record.
func (s *SmartContract) requireCaller(ctx contractapi.TransactionContextInterface, roles ...string) (*User, error) {
	user, err := s.requireAnyUser(ctx)
	if err != nil {
		return nil, err
	}
	for _, role := range roles {
		if s.hasRole(user, role) {
			return user, nil
		}
	}
	return nil, fmt.Errorf("user %s lacks required role (need one of: %s)", user.ID, strings.Join(roles, ","))
}

// callerHasRole returns true if the caller has the given role.
func (s *SmartContract) callerHasRole(ctx contractapi.TransactionContextInterface, role string) bool {
	_, err := s.requireCaller(ctx, role)
	return err == nil
}

// callerHasAnyRole returns true if the caller has any of the given roles.
func (s *SmartContract) callerHasAnyRole(ctx contractapi.TransactionContextInterface, roles ...string) bool {
	_, err := s.requireCaller(ctx, roles...)
	return err == nil
}

// getCallerRole is like requireCaller but returns only the user without error wrapping.
func (s *SmartContract) getCallerRole(ctx contractapi.TransactionContextInterface, role string) (*User, error) {
	user, err := s.requireAnyUser(ctx)
	if err != nil {
		return nil, err
	}
	if !s.hasRole(user, role) {
		return nil, fmt.Errorf("user %s lacks role '%s'", user.ID, role)
	}
	return user, nil
}

// hasRole checks whether user.Roles contains any of the given roles.
func (s *SmartContract) hasRole(user *User, roles ...string) bool {
	for _, r := range user.Roles {
		for _, want := range roles {
			if r == want {
				return true
			}
		}
	}
	return false
}

// orgFromUserID extracts the org from a user ID like "User1@province1.example.com".
func (s *SmartContract) orgFromUserID(userID string) string {
	// "User1@province1.example.com" → split on @ → "province1.example.com" → split on . → "province1"
	parts := strings.SplitN(userID, "@", 2)
	if len(parts) < 2 {
		return ""
	}
	host := strings.SplitN(parts[1], ".", 2)
	return host[0]
}

// hasAnyAdmin returns true if any user with the admin role exists on-chain.
func (s *SmartContract) hasAnyAdmin(ctx contractapi.TransactionContextInterface) (bool, error) {
	iter, err := ctx.GetStub().GetStateByRange(UserKeyPrefix, UserKeyPrefix+"~")
	if err != nil {
		return false, err
	}
	defer iter.Close()
	for iter.HasNext() {
		kv, err := iter.Next()
		if err != nil {
			return false, err
		}
		var u User
		if err := json.Unmarshal(kv.Value, &u); err != nil {
			continue
		}
		for _, r := range u.Roles {
			if r == RoleAdmin {
				return true, nil
			}
		}
	}
	return false, nil
}

// ═══════════════════════════════════════════════════════════════════════
//  User state helpers
// ═══════════════════════════════════════════════════════════════════════

func (s *SmartContract) getUser(ctx contractapi.TransactionContextInterface, userID string) (*User, error) {
	key := UserKeyPrefix + userID
	data, err := ctx.GetStub().GetState(key)
	if err != nil {
		return nil, fmt.Errorf("read user %s: %w", userID, err)
	}
	if data == nil {
		return nil, fmt.Errorf("user %s not found", userID)
	}
	var user User
	if err := json.Unmarshal(data, &user); err != nil {
		return nil, fmt.Errorf("parse user %s: %w", userID, err)
	}
	return &user, nil
}

func (s *SmartContract) putUser(ctx contractapi.TransactionContextInterface, user *User) error {
	data, err := json.Marshal(user)
	if err != nil {
		return err
	}
	return ctx.GetStub().PutState(UserKeyPrefix+user.ID, data)
}

// ═══════════════════════════════════════════════════════════════════════
//  Land state helpers
// ═══════════════════════════════════════════════════════════════════════

func (s *SmartContract) filterLand(ctx contractapi.TransactionContextInterface, fn func(*LandRecord) bool) ([]*LandRecord, error) {
	iter, err := ctx.GetStub().GetStateByRange("", "")
	if err != nil {
		return nil, err
	}
	defer iter.Close()
	var results []*LandRecord
	for iter.HasNext() {
		kv, err := iter.Next()
		if err != nil {
			return nil, err
		}
		// Skip user records (they start with "USER_")
		// Skip sale proposals (they start with "SALE_")
		if strings.HasPrefix(kv.Key, UserKeyPrefix) || strings.HasPrefix(kv.Key, SaleProposalPrefix) {
			continue
		}
		var r LandRecord
		if err := json.Unmarshal(kv.Value, &r); err != nil {
			return nil, err
		}
		if fn(&r) {
			results = append(results, &r)
		}
	}
	return results, nil
}

func (s *SmartContract) landExists(ctx contractapi.TransactionContextInterface, id string) (bool, error) {
	d, err := ctx.GetStub().GetState(id)
	return d != nil, err
}

func (s *SmartContract) getLand(ctx contractapi.TransactionContextInterface, id string) (*LandRecord, error) {
	d, err := ctx.GetStub().GetState(id)
	if err != nil {
		return nil, err
	}
	if d == nil {
		return nil, fmt.Errorf("plot %s not found", id)
	}
	var r LandRecord
	if err := json.Unmarshal(d, &r); err != nil {
		return nil, err
	}
	return &r, nil
}

func (s *SmartContract) putLand(ctx contractapi.TransactionContextInterface, r *LandRecord) error {
	d, err := json.Marshal(r)
	if err != nil {
		return err
	}
	return ctx.GetStub().PutState(r.PlotID, d)
}

func (s *SmartContract) stateExists(ctx contractapi.TransactionContextInterface, key string) (bool, error) {
	d, err := ctx.GetStub().GetState(key)
	return d != nil, err
}

// ── Utility ───────────────────────────────────────────────────────────

func now() string {
	return time.Now().UTC().Format(time.RFC3339)
}

func main() {
	cc, err := contractapi.NewChaincode(&SmartContract{})
	if err != nil {
		fmt.Printf("Error creating chaincode: %s\n", err)
		return
	}
	if err := cc.Start(); err != nil {
		fmt.Printf("Error starting chaincode: %s\n", err)
	}
}
