/*
 * landreg.go — Private Land Registry Chaincode
 *
 * 1 organization (LandReg), 3 peers, OutOf(2) endorsement.
 * Admin users are internal Fabric identities (OU=admin).
 * Customers are external web users — their identity is passed
 * as a function parameter from the backend.
 */

package main

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/v2/contractapi"
)

const (
	ListingKeyPrefix = "LISTING_"
	OfferKeyPrefix   = "OFFER_"
	TxKeyPrefix      = "TX_"
)

type LandRecord struct {
	ID            string          `json:"id"`
	Owner         string          `json:"owner"`
	Location      string          `json:"location"`
	Area          float64         `json:"area"`
	Status        string          `json:"status"` // "active", "listed", "sold"
	Price         float64         `json:"price,omitempty"`
	PreviousOwner string          `json:"previousOwner,omitempty"`
	TransferCount int             `json:"transferCount"`
	LastTransfer  *TransferRecord `json:"lastTransfer,omitempty"`
	RegisteredAt  string          `json:"registeredAt"`
}

type TransferRecord struct {
	From  string  `json:"from"`
	To    string  `json:"to"`
	Price float64 `json:"price"`
	Date  string  `json:"date"`
	TxID  string  `json:"txId"`
}

type SaleListing struct {
	ID        string  `json:"id"`
	LandID    string  `json:"landId"`
	Seller    string  `json:"seller"`
	Price     float64 `json:"price"`
	Status    string  `json:"status"`
	CreatedAt string  `json:"createdAt"`
}

type BuyerOffer struct {
	ID           string  `json:"id"`
	ListingID    string  `json:"listingId"`
	LandID       string  `json:"landId"`
	Buyer        string  `json:"buyer"`
	OfferedPrice float64 `json:"offeredPrice"`
	Status       string  `json:"status"`
	CreatedAt    string  `json:"createdAt"`
}

type Transaction struct {
	ID          string  `json:"id"`
	LandID      string  `json:"landId"`
	Seller      string  `json:"seller"`
	Buyer       string  `json:"buyer"`
	Price       float64 `json:"price"`
	Status      string  `json:"status"` // "pending_buyer_confirm", "pending_admin", "completed", "rejected"
	CreatedAt   string  `json:"createdAt"`
	CompletedAt string  `json:"completedAt,omitempty"`
}

type SmartContract struct {
	contractapi.Contract
}

// ══════════════════════════════════════════════════════════════════════
//  Admin functions (identity from cert OU)
// ══════════════════════════════════════════════════════════════════════

func (s *SmartContract) RegisterLand(
	ctx contractapi.TransactionContextInterface,
	id, owner, location string, area float64,
) error {
	if !s.isAdmin(ctx) {
		return fmt.Errorf("only admin can register land")
	}
	exists, err := s.landExists(ctx, id)
	if err != nil {
		return err
	}
	if exists {
		return fmt.Errorf("land %s already exists", id)
	}
	return s.putLand(ctx, &LandRecord{
		ID: id, Owner: owner, Location: location, Area: area,
		Status: "active", RegisteredAt: now(),
	})
}

func (s *SmartContract) AdminApproveTransaction(
	ctx contractapi.TransactionContextInterface, txID string,
) error {
	if !s.isAdmin(ctx) {
		return fmt.Errorf("only admin can approve transactions")
	}
	tx, err := s.getTransaction(ctx, txID)
	if err != nil {
		return err
	}
	if tx.Status != "pending_admin" {
		return fmt.Errorf("transaction %s is %s — must be pending_admin", txID, tx.Status)
	}

	listing, _ := s.getListing(ctx, tx.LandID)
	listing.Status = "completed"
	_ = s.putListing(ctx, listing)

	record, err := s.getLand(ctx, tx.LandID)
	if err != nil {
		return err
	}
	txIDOnChain := ctx.GetStub().GetTxID()
	record.PreviousOwner = record.Owner
	record.Owner = tx.Buyer
	record.TransferCount++
	record.LastTransfer = &TransferRecord{
		From: record.PreviousOwner, To: tx.Buyer,
		Price: tx.Price, Date: now(), TxID: txIDOnChain,
	}
	record.Status = "active"
	record.Price = 0
	if err := s.putLand(ctx, record); err != nil {
		return err
	}

	tx.Status = "completed"
	tx.CompletedAt = now()
	return s.putTransaction(ctx, tx)
}

// ══════════════════════════════════════════════════════════════════════
//  Customer functions (identity passed as `caller` param)
// ══════════════════════════════════════════════════════════════════════

func (s *SmartContract) ListForSale(
	ctx contractapi.TransactionContextInterface,
	caller, landID string, price float64,
) error {
	if caller == "" {
		return fmt.Errorf("caller identity required")
	}
	record, err := s.getLand(ctx, landID)
	if err != nil {
		return err
	}
	if record.Owner != caller {
		return fmt.Errorf("only the owner can list land for sale")
	}
	if price <= 0 {
		return fmt.Errorf("price must be positive")
	}
	record.Status = "listed"
	record.Price = price
	if err := s.putLand(ctx, record); err != nil {
		return err
	}
	return s.putListing(ctx, &SaleListing{
		ID: ListingKeyPrefix + landID, LandID: landID,
		Seller: caller, Price: price, Status: "active", CreatedAt: now(),
	})
}

func (s *SmartContract) CancelListing(
	ctx contractapi.TransactionContextInterface, caller, landID string,
) error {
	if caller == "" {
		return fmt.Errorf("caller identity required")
	}
	record, err := s.getLand(ctx, landID)
	if err != nil {
		return err
	}
	if record.Owner != caller {
		return fmt.Errorf("only the owner can cancel a listing")
	}
	listing, err := s.getListing(ctx, landID)
	if err != nil {
		return err
	}
	if listing.Status != "active" {
		return fmt.Errorf("listing is not active")
	}
	record.Status = "active"
	record.Price = 0
	if err := s.putLand(ctx, record); err != nil {
		return err
	}
	listing.Status = "cancelled"
	return s.putListing(ctx, listing)
}

func (s *SmartContract) MakeOffer(
	ctx contractapi.TransactionContextInterface,
	caller, landID string, offeredPrice float64,
) (string, error) {
	if caller == "" {
		return "", fmt.Errorf("caller identity required")
	}
	record, err := s.getLand(ctx, landID)
	if err != nil {
		return "", err
	}
	if record.Status != "listed" {
		return "", fmt.Errorf("land %s is not listed", landID)
	}
	if record.Owner == caller {
		return "", fmt.Errorf("cannot offer on your own land")
	}
	if offeredPrice <= 0 {
		return "", fmt.Errorf("price must be positive")
	}
	existing, _ := s.findOffers(ctx, landID, caller)
	for _, o := range existing {
		if o.Status == "pending" {
			return "", fmt.Errorf("you already have a pending offer")
		}
	}
	offer := &BuyerOffer{
		ID: OfferKeyPrefix + landID + "_" + caller, ListingID: ListingKeyPrefix + landID,
		LandID: landID, Buyer: caller, OfferedPrice: offeredPrice,
		Status: "pending", CreatedAt: now(),
	}
	if err := s.putOffer(ctx, offer); err != nil {
		return "", err
	}
	return offer.ID, nil
}

func (s *SmartContract) AcceptOffer(
	ctx contractapi.TransactionContextInterface, caller, offerID string,
) error {
	if caller == "" {
		return fmt.Errorf("caller identity required")
	}
	offer, err := s.getOfferByID(ctx, offerID)
	if err != nil {
		return err
	}
	if offer.Status != "pending" {
		return fmt.Errorf("offer %s is %s", offerID, offer.Status)
	}
	record, err := s.getLand(ctx, offer.LandID)
	if err != nil {
		return err
	}
	if record.Owner != caller {
		return fmt.Errorf("only the owner can accept offers")
	}
	offer.Status = "accepted"
	if err := s.putOffer(ctx, offer); err != nil {
		return err
	}
	allOffers, _ := s.findAllOffersForLand(ctx, offer.LandID)
	for _, o := range allOffers {
		if o.ID != offerID && o.Status == "pending" {
			o.Status = "rejected"
			_ = s.putOffer(ctx, o)
		}
	}
	listing, _ := s.getListing(ctx, offer.LandID)
	listing.Status = "pending"
	_ = s.putListing(ctx, listing)
	return s.putTransaction(ctx, &Transaction{
		ID: TxKeyPrefix + offer.LandID, LandID: offer.LandID,
		Seller: caller, Buyer: offer.Buyer,
		Price: offer.OfferedPrice, Status: "pending_buyer_confirm", CreatedAt: now(),
	})
}

func (s *SmartContract) ConfirmTransaction(
	ctx contractapi.TransactionContextInterface, caller, txID string,
) error {
	if caller == "" {
		return fmt.Errorf("caller identity required")
	}
	tx, err := s.getTransaction(ctx, txID)
	if err != nil {
		return err
	}
	if tx.Buyer != caller {
		return fmt.Errorf("only the buyer can confirm")
	}
	if tx.Status != "pending_buyer_confirm" {
		return fmt.Errorf("cannot confirm in %s state", tx.Status)
	}
	tx.Status = "pending_admin"
	return s.putTransaction(ctx, tx)
}

func (s *SmartContract) RejectTransaction(
	ctx contractapi.TransactionContextInterface, caller, txID string,
) error {
	if caller == "" {
		return fmt.Errorf("caller identity required")
	}
	tx, err := s.getTransaction(ctx, txID)
	if err != nil {
		return err
	}
	if tx.Seller != caller && tx.Buyer != caller {
		return fmt.Errorf("only seller or buyer can reject")
	}
	if tx.Status == "completed" {
		return fmt.Errorf("cannot reject completed transaction")
	}
	tx.Status = "rejected"
	listing, _ := s.getListing(ctx, tx.LandID)
	listing.Status = "active"
	_ = s.putListing(ctx, listing)
	record, _ := s.getLand(ctx, tx.LandID)
	record.Status = "listed"
	_ = s.putLand(ctx, record)
	return s.putTransaction(ctx, tx)
}

// ══════════════════════════════════════════════════════════════════════
//  Queries
// ══════════════════════════════════════════════════════════════════════

func (s *SmartContract) GetAllLand(ctx contractapi.TransactionContextInterface) (string, error) {
	if !s.isAdmin(ctx) {
		return "", fmt.Errorf("only admin can view all land records")
	}
	records, err := s.filterLand(ctx, func(r *LandRecord) bool { return true })
	if err != nil {
		return "", err
	}
	b, _ := json.Marshal(records)
	return string(b), nil
}

func (s *SmartContract) QueryLand(ctx contractapi.TransactionContextInterface, id string) (string, error) {
	r, err := s.getLand(ctx, id)
	if err != nil {
		return "", err
	}
	b, _ := json.Marshal(r)
	return string(b), nil
}

func (s *SmartContract) GetMyLands(ctx contractapi.TransactionContextInterface, caller string) (string, error) {
	if caller == "" {
		return "", fmt.Errorf("caller identity required")
	}
	records, err := s.filterLand(ctx, func(r *LandRecord) bool { return r.Owner == caller })
	if err != nil {
		return "", err
	}
	b, _ := json.Marshal(records)
	return string(b), nil
}

func (s *SmartContract) GetListings(ctx contractapi.TransactionContextInterface) (string, error) {
	listings, err := s.filterListings(ctx, func(l *SaleListing) bool { return l.Status == "active" })
	if err != nil {
		return "", err
	}
	b, _ := json.Marshal(listings)
	return string(b), nil
}

func (s *SmartContract) GetMyOffers(ctx contractapi.TransactionContextInterface, caller string) (string, error) {
	if caller == "" {
		return "", fmt.Errorf("caller identity required")
	}
	offers, err := s.filterOffers(ctx, func(o *BuyerOffer) bool { return o.Buyer == caller })
	if err != nil {
		return "", err
	}
	b, _ := json.Marshal(offers)
	return string(b), nil
}

func (s *SmartContract) GetOffersForLand(ctx contractapi.TransactionContextInterface, caller, landID string) (string, error) {
	if caller == "" {
		return "", fmt.Errorf("caller identity required")
	}
	record, err := s.getLand(ctx, landID)
	if err != nil {
		return "", err
	}
	if record.Owner != caller {
		return "", fmt.Errorf("only the owner can view offers")
	}
	offers, err := s.findAllOffersForLand(ctx, landID)
	if err != nil {
		return "", err
	}
	b, _ := json.Marshal(offers)
	return string(b), nil
}

func (s *SmartContract) GetPendingTransactions(ctx contractapi.TransactionContextInterface) (string, error) {
	if !s.isAdmin(ctx) {
		return "", fmt.Errorf("only admin can view pending transactions")
	}
	txs, err := s.filterTransactions(ctx, func(t *Transaction) bool { return t.Status == "pending_admin" })
	if err != nil {
		return "", err
	}
	b, _ := json.Marshal(txs)
	return string(b), nil
}

func (s *SmartContract) GetMyTransactions(ctx contractapi.TransactionContextInterface, caller string) (string, error) {
	if caller == "" {
		return "", fmt.Errorf("caller identity required")
	}
	txs, err := s.filterTransactions(ctx, func(t *Transaction) bool { return t.Seller == caller || t.Buyer == caller })
	if err != nil {
		return "", err
	}
	b, _ := json.Marshal(txs)
	return string(b), nil
}

// ══════════════════════════════════════════════════════════════════════
//  Auth helpers
// ══════════════════════════════════════════════════════════════════════

func (s *SmartContract) isAdmin(ctx contractapi.TransactionContextInterface) bool {
	cert, err := ctx.GetClientIdentity().GetX509Certificate()
	if err != nil {
		return false
	}
	for _, ou := range cert.Subject.OrganizationalUnit {
		if ou == "admin" {
			return true
		}
	}
	return false
}

// ══════════════════════════════════════════════════════════════════════
//  State helpers
// ══════════════════════════════════════════════════════════════════════

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
		return nil, fmt.Errorf("land %s not found", id)
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
	return ctx.GetStub().PutState(r.ID, d)
}

func (s *SmartContract) filterLand(ctx contractapi.TransactionContextInterface, fn func(*LandRecord) bool) ([]*LandRecord, error) {
	iter, err := ctx.GetStub().GetStateByRange("", "")
	if err != nil {
		return nil, err
	}
	defer iter.Close()
	results := []*LandRecord{}
	for iter.HasNext() {
		kv, err := iter.Next()
		if err != nil {
			return nil, err
		}
		if strings.HasPrefix(kv.Key, ListingKeyPrefix) || strings.HasPrefix(kv.Key, OfferKeyPrefix) || strings.HasPrefix(kv.Key, TxKeyPrefix) {
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

func (s *SmartContract) getListing(ctx contractapi.TransactionContextInterface, landID string) (*SaleListing, error) {
	d, err := ctx.GetStub().GetState(ListingKeyPrefix + landID)
	if err != nil {
		return nil, err
	}
	if d == nil {
		return nil, fmt.Errorf("listing for land %s not found", landID)
	}
	var l SaleListing
	if err := json.Unmarshal(d, &l); err != nil {
		return nil, err
	}
	return &l, nil
}

func (s *SmartContract) putListing(ctx contractapi.TransactionContextInterface, l *SaleListing) error {
	d, _ := json.Marshal(l)
	return ctx.GetStub().PutState(l.ID, d)
}

func (s *SmartContract) filterListings(ctx contractapi.TransactionContextInterface, fn func(*SaleListing) bool) ([]*SaleListing, error) {
	iter, err := ctx.GetStub().GetStateByRange(ListingKeyPrefix, ListingKeyPrefix+"~")
	if err != nil {
		return nil, err
	}
	defer iter.Close()
	results := []*SaleListing{}
	for iter.HasNext() {
		kv, err := iter.Next()
		if err != nil {
			return nil, err
		}
		var l SaleListing
		if err := json.Unmarshal(kv.Value, &l); err != nil {
			return nil, err
		}
		if fn(&l) {
			results = append(results, &l)
		}
	}
	return results, nil
}

func (s *SmartContract) getOfferByID(ctx contractapi.TransactionContextInterface, id string) (*BuyerOffer, error) {
	d, err := ctx.GetStub().GetState(id)
	if err != nil {
		return nil, err
	}
	if d == nil {
		return nil, fmt.Errorf("offer %s not found", id)
	}
	var o BuyerOffer
	if err := json.Unmarshal(d, &o); err != nil {
		return nil, err
	}
	return &o, nil
}

func (s *SmartContract) putOffer(ctx contractapi.TransactionContextInterface, o *BuyerOffer) error {
	d, _ := json.Marshal(o)
	return ctx.GetStub().PutState(o.ID, d)
}

func (s *SmartContract) findOffers(ctx contractapi.TransactionContextInterface, landID, buyer string) ([]*BuyerOffer, error) {
	prefix := OfferKeyPrefix + landID + "_"
	iter, err := ctx.GetStub().GetStateByRange(prefix, prefix+"~")
	if err != nil {
		return nil, err
	}
	defer iter.Close()
	results := []*BuyerOffer{}
	for iter.HasNext() {
		kv, err := iter.Next()
		if err != nil {
			return nil, err
		}
		var o BuyerOffer
		if err := json.Unmarshal(kv.Value, &o); err != nil {
			return nil, err
		}
		results = append(results, &o)
	}
	return results, nil
}

func (s *SmartContract) findAllOffersForLand(ctx contractapi.TransactionContextInterface, landID string) ([]*BuyerOffer, error) {
	return s.findOffers(ctx, landID, "")
}

func (s *SmartContract) filterOffers(ctx contractapi.TransactionContextInterface, fn func(*BuyerOffer) bool) ([]*BuyerOffer, error) {
	iter, err := ctx.GetStub().GetStateByRange(OfferKeyPrefix, OfferKeyPrefix+"~")
	if err != nil {
		return nil, err
	}
	defer iter.Close()
	results := []*BuyerOffer{}
	for iter.HasNext() {
		kv, err := iter.Next()
		if err != nil {
			return nil, err
		}
		var o BuyerOffer
		if err := json.Unmarshal(kv.Value, &o); err != nil {
			return nil, err
		}
		if fn(&o) {
			results = append(results, &o)
		}
	}
	return results, nil
}

func (s *SmartContract) getTransaction(ctx contractapi.TransactionContextInterface, id string) (*Transaction, error) {
	d, err := ctx.GetStub().GetState(id)
	if err != nil {
		return nil, err
	}
	if d == nil {
		return nil, fmt.Errorf("transaction %s not found", id)
	}
	var tx Transaction
	if err := json.Unmarshal(d, &tx); err != nil {
		return nil, err
	}
	return &tx, nil
}

func (s *SmartContract) putTransaction(ctx contractapi.TransactionContextInterface, tx *Transaction) error {
	d, _ := json.Marshal(tx)
	return ctx.GetStub().PutState(tx.ID, d)
}

func (s *SmartContract) filterTransactions(ctx contractapi.TransactionContextInterface, fn func(*Transaction) bool) ([]*Transaction, error) {
	iter, err := ctx.GetStub().GetStateByRange(TxKeyPrefix, TxKeyPrefix+"~")
	if err != nil {
		return nil, err
	}
	defer iter.Close()
	results := []*Transaction{}
	for iter.HasNext() {
		kv, err := iter.Next()
		if err != nil {
			return nil, err
		}
		var tx Transaction
		if err := json.Unmarshal(kv.Value, &tx); err != nil {
			return nil, err
		}
		if fn(&tx) {
			results = append(results, &tx)
		}
	}
	return results, nil
}

func now() string { return time.Now().UTC().Format(time.RFC3339) }

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
