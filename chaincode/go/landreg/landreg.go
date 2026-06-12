/*
 * landreg.go — Land Registry chaincode for Hyperledger Fabric.
 *
 * 3 provincial governing bodies run full nodes (test).
 * Scale to 11 for production.
 * 77 malpots, municipalities, survey depts, buyers, sellers are lite nodes.
 * Land transfers endorsed by all 3 provincial peers.
 */

package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/v2/contractapi"
)

type SmartContract struct {
	contractapi.Contract
}

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
	Mortgage       *MortgageInfo   `json:"mortgage,omitempty"`
	Dispute        *DisputeInfo    `json:"dispute,omitempty"`
	TransferCount  int             `json:"transferCount"`
	LastTransfer   *TransferRecord `json:"lastTransfer,omitempty"`
	RegisteredDate string          `json:"registeredDate"`
}

type MortgageInfo struct {
	Bank      string  `json:"bank"`
	Amount    float64 `json:"amount"`
	StartDate string  `json:"startDate"`
	EndDate   string  `json:"endDate"`
}

type DisputeInfo struct {
	CaseNumber  string `json:"caseNumber"`
	Court       string `json:"court"`
	FilingDate  string `json:"filingDate"`
	Description string `json:"description"`
	Status      string `json:"status"`
}

type TransferRecord struct {
	From  string  `json:"from"`
	To    string  `json:"to"`
	Price float64 `json:"price"`
	Date  string  `json:"date"`
	TxID  string  `json:"txId"`
}

// ── Registration ───────────────────────────────────────────────────

func (s *SmartContract) RegisterLand(
	ctx contractapi.TransactionContextInterface,
	plotID, surveyNumber, owner, location, province string,
	area float64, landType string,
) error {
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
		RegisteredDate: time.Now().UTC().Format(time.RFC3339),
	}
	return s.putLand(ctx, &record)
}

// ── Split ──────────────────────────────────────────────────────────

func (s *SmartContract) SplitLand(
	ctx contractapi.TransactionContextInterface,
	parentPlotID string,
	childPlotsJSON string,
) error {
	parent, err := s.getLand(ctx, parentPlotID)
	if err != nil {
		return err
	}
	if parent.Status == "disputed" {
		return fmt.Errorf("cannot split disputed land %s", parentPlotID)
	}
	if parent.Status == "mortgaged" {
		return fmt.Errorf("cannot split mortgaged land %s", parentPlotID)
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
			RegisteredDate: time.Now().UTC().Format(time.RFC3339),
		}
		if err := s.putLand(ctx, &child); err != nil {
			return err
		}
	}
	return nil
}

// ── Transfer ───────────────────────────────────────────────────────

func (s *SmartContract) TransferLand(
	ctx contractapi.TransactionContextInterface,
	plotID, buyer string, price float64,
) error {
	record, err := s.getLand(ctx, plotID)
	if err != nil {
		return err
	}
	if record.Status == "disputed" {
		return fmt.Errorf("land %s under dispute (case %s)", plotID, record.Dispute.CaseNumber)
	}
	if record.Status == "mortgaged" {
		return fmt.Errorf("land %s mortgaged to %s — clear first", plotID, record.Mortgage.Bank)
	}

	txID := ctx.GetStub().GetTxID()
	transfer := TransferRecord{
		From: record.Owner, To: buyer, Price: price,
		Date: time.Now().UTC().Format(time.RFC3339), TxID: txID,
	}
	record.PreviousOwner = record.Owner
	record.Owner = buyer
	record.TransferCount++
	record.LastTransfer = &transfer
	return s.putLand(ctx, record)
}

// ── Mortgage ───────────────────────────────────────────────────────

func (s *SmartContract) SetMortgage(
	ctx contractapi.TransactionContextInterface,
	plotID, bank string, amount float64,
	startDate, endDate string,
) error {
	record, err := s.getLand(ctx, plotID)
	if err != nil {
		return err
	}
	if record.Status == "disputed" {
		return fmt.Errorf("cannot mortgage disputed land %s", plotID)
	}
	if record.Status == "mortgaged" {
		return fmt.Errorf("land %s already mortgaged to %s", plotID, record.Mortgage.Bank)
	}
	record.Status = "mortgaged"
	record.Mortgage = &MortgageInfo{Bank: bank, Amount: amount, StartDate: startDate, EndDate: endDate}
	return s.putLand(ctx, record)
}

func (s *SmartContract) ClearMortgage(
	ctx contractapi.TransactionContextInterface, plotID string,
) error {
	record, err := s.getLand(ctx, plotID)
	if err != nil {
		return err
	}
	if record.Status != "mortgaged" {
		return fmt.Errorf("land %s is not mortgaged", plotID)
	}
	record.Status = "active"
	record.Mortgage = nil
	return s.putLand(ctx, record)
}

// ── Dispute ────────────────────────────────────────────────────────

func (s *SmartContract) FileDispute(
	ctx contractapi.TransactionContextInterface,
	plotID, caseNumber, court, description string,
) error {
	record, err := s.getLand(ctx, plotID)
	if err != nil {
		return err
	}
	if record.Status == "disputed" {
		return fmt.Errorf("land %s already disputed (case %s)", plotID, record.Dispute.CaseNumber)
	}
	record.Status = "disputed"
	record.Dispute = &DisputeInfo{
		CaseNumber: caseNumber, Court: court,
		FilingDate:  time.Now().UTC().Format(time.RFC3339),
		Description: description, Status: "pending",
	}
	return s.putLand(ctx, record)
}

func (s *SmartContract) ResolveDispute(
	ctx contractapi.TransactionContextInterface, plotID string,
) error {
	record, err := s.getLand(ctx, plotID)
	if err != nil {
		return err
	}
	if record.Status != "disputed" {
		return fmt.Errorf("land %s is not disputed", plotID)
	}
	record.Status = "active"
	record.Dispute.Status = "resolved"
	return s.putLand(ctx, record)
}

// ── Queries ────────────────────────────────────────────────────────

func (s *SmartContract) QueryLand(ctx contractapi.TransactionContextInterface, plotID string) (string, error) {
	r, err := s.getLand(ctx, plotID)
	if err != nil {
		return "", err
	}
	b, err := json.Marshal(r)
	return string(b), err
}

func (s *SmartContract) GetLandByOwner(ctx contractapi.TransactionContextInterface, owner string) (string, error) {
	records, err := s.filterLand(ctx, func(r *LandRecord) bool { return r.Owner == owner })
	if err != nil {
		return "", err
	}
	b, _ := json.Marshal(records)
	return string(b), nil
}

func (s *SmartContract) GetLandByStatus(ctx contractapi.TransactionContextInterface, status string) (string, error) {
	records, err := s.filterLand(ctx, func(r *LandRecord) bool { return r.Status == status })
	if err != nil {
		return "", err
	}
	b, _ := json.Marshal(records)
	return string(b), nil
}

func (s *SmartContract) GetLandByProvince(ctx contractapi.TransactionContextInterface, province string) (string, error) {
	records, err := s.filterLand(ctx, func(r *LandRecord) bool { return r.Province == province })
	if err != nil {
		return "", err
	}
	b, _ := json.Marshal(records)
	return string(b), nil
}

func (s *SmartContract) GetChildrenOf(ctx contractapi.TransactionContextInterface, parentPlotID string) (string, error) {
	records, err := s.filterLand(ctx, func(r *LandRecord) bool { return r.ParentPlotID == parentPlotID })
	if err != nil {
		return "", err
	}
	b, _ := json.Marshal(records)
	return string(b), nil
}

func (s *SmartContract) GetAllLand(ctx contractapi.TransactionContextInterface) (string, error) {
	records, err := s.filterLand(ctx, func(r *LandRecord) bool { return true })
	if err != nil {
		return "", err
	}
	b, _ := json.Marshal(records)
	return string(b), nil
}

// ── Helpers ────────────────────────────────────────────────────────

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

func main() {
	cc, err := contractapi.NewChaincode(&SmartContract{})
	if err != nil {
		fmt.Printf("Error: %s", err)
		return
	}
	if err := cc.Start(); err != nil {
		fmt.Printf("Error: %s", err)
	}
}
