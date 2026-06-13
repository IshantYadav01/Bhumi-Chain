package main

import (
	"crypto/x509"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/hyperledger/fabric-chaincode-go/v2/pkg/cid"
	"github.com/hyperledger/fabric-chaincode-go/v2/shim"
	"github.com/hyperledger/fabric-contract-api-go/v2/contractapi"
	"github.com/hyperledger/fabric-protos-go-apiv2/ledger/queryresult"
	pb "github.com/hyperledger/fabric-protos-go-apiv2/peer"
	"google.golang.org/protobuf/types/known/timestamppb"
)

// stubState is a simple in-memory key-value store.
type stubState struct {
	data map[string][]byte
	iter *rangeIter
}

type rangeIter struct {
	data map[string][]byte
	keys []string
	idx  int
}

func (i *rangeIter) HasNext() bool { return i.idx < len(i.keys) }
func (i *rangeIter) Next() (*queryresult.KV, error) {
	if !i.HasNext() {
		return nil, fmt.Errorf("no more items")
	}
	k := i.keys[i.idx]
	i.idx++
	return &queryresult.KV{Key: k, Value: i.data[k]}, nil
}
func (i *rangeIter) Close() error                         { return nil }
func (i *rangeIter) GetBookmarkAndClose() (string, error) { return "", nil }

func newStubState() *stubState {
	return &stubState{data: make(map[string][]byte)}
}

func (s *stubState) GetState(key string) ([]byte, error) {
	if v, ok := s.data[key]; ok {
		return v, nil
	}
	return nil, nil
}

func (s *stubState) PutState(key string, value []byte) error {
	s.data[key] = value
	return nil
}

func (s *stubState) GetStateByRange(startKey, endKey string) (shim.StateQueryIteratorInterface, error) {
	var keys []string
	for k := range s.data {
		if k >= startKey && k < endKey {
			keys = append(keys, k)
		}
	}
	for i := 0; i < len(keys); i++ {
		for j := i + 1; j < len(keys); j++ {
			if keys[i] > keys[j] {
				keys[i], keys[j] = keys[j], keys[i]
			}
		}
	}
	s.iter = &rangeIter{data: s.data, keys: keys}
	return s.iter, nil
}

func (s *stubState) GetTxID() string { return "mock-txid" }

// Remaining ChaincodeStubInterface stubs.
func (s *stubState) PutStateWithValidation(key string, value []byte, ep []byte) error {
	return s.PutState(key, value)
}
func (s *stubState) DelState(key string) error { return nil }
func (s *stubState) GetPrivateDataByRange(collection, startKey, endKey string) (shim.StateQueryIteratorInterface, error) {
	return nil, nil
}
func (s *stubState) GetTxTimestamp() (*timestamppb.Timestamp, error) { return nil, nil }
func (s *stubState) GetChannelID() string                            { return "mychannel" }
func (s *stubState) GetArgs() [][]byte                               { return nil }
func (s *stubState) GetStringArgs() []string                         { return nil }
func (s *stubState) GetFunctionAndParameters() (string, []string)    { return "", nil }
func (s *stubState) GetArgsSlice() ([]byte, error)                   { return nil, nil }
func (s *stubState) GetBinding() ([]byte, error)                     { return nil, nil }
func (s *stubState) GetDecorations() map[string][]byte               { return nil }
func (s *stubState) GetSignedProposal() (*pb.SignedProposal, error)  { return nil, nil }
func (s *stubState) GetCreator() ([]byte, error)                     { return nil, nil }
func (s *stubState) GetTransient() (map[string][]byte, error)        { return nil, nil }
func (s *stubState) SetEvent(name string, payload []byte) error      { return nil }
func (s *stubState) InvokeChaincode(chaincodeName string, args [][]byte, channel string) *pb.Response {
	return &pb.Response{}
}
func (s *stubState) SetStateValidationParameter(key string, ep []byte) error { return nil }
func (s *stubState) GetStateValidationParameter(key string) ([]byte, error)  { return nil, nil }
func (s *stubState) PurgePrivateData(collection string, key string) error    { return nil }
func (s *stubState) SetPrivateDataValidationParameter(collection, key string, ep []byte) error {
	return nil
}
func (s *stubState) GetPrivateDataValidationParameter(collection, key string) ([]byte, error) {
	return nil, nil
}
func (s *stubState) GetPrivateData(collection string, key string) ([]byte, error)     { return nil, nil }
func (s *stubState) PutPrivateData(collection string, key string, value []byte) error { return nil }
func (s *stubState) DelPrivateData(collection string, key string) error               { return nil }
func (s *stubState) GetPrivateDataHash(collection, key string) ([]byte, error)        { return nil, nil }
func (s *stubState) GetPrivateDataByPartialCompositeKey(collection, objectType string, keys []string) (shim.StateQueryIteratorInterface, error) {
	return nil, nil
}
func (s *stubState) GetPrivateDataQueryResult(collection, query string) (shim.StateQueryIteratorInterface, error) {
	return nil, nil
}
func (s *stubState) GetStateByRangeWithPagination(startKey, endKey string, pageSize int32, bookmark string) (shim.StateQueryIteratorInterface, *pb.QueryResponseMetadata, error) {
	return nil, nil, nil
}
func (s *stubState) GetStateByPartialCompositeKey(objectType string, keys []string) (shim.StateQueryIteratorInterface, error) {
	return nil, nil
}
func (s *stubState) GetStateByPartialCompositeKeyWithPagination(objectType string, keys []string, pageSize int32, bookmark string) (shim.StateQueryIteratorInterface, *pb.QueryResponseMetadata, error) {
	return nil, nil, nil
}
func (s *stubState) CreateCompositeKey(objectType string, attributes []string) (string, error) {
	return "", nil
}
func (s *stubState) SplitCompositeKey(compositeKey string) (string, []string, error) {
	return "", nil, nil
}
func (s *stubState) GetQueryResult(query string) (shim.StateQueryIteratorInterface, error) {
	return nil, nil
}
func (s *stubState) GetQueryResultWithPagination(query string, pageSize int32, bookmark string) (shim.StateQueryIteratorInterface, *pb.QueryResponseMetadata, error) {
	return nil, nil, nil
}
func (s *stubState) GetHistoryForKey(key string) (shim.HistoryQueryIteratorInterface, error) {
	return nil, nil
}

// mockCtx wraps a stub and a basic client identity.
type mockCtx struct {
	contractapi.TransactionContext
	stub shim.ChaincodeStubInterface
}

func (m *mockCtx) GetStub() shim.ChaincodeStubInterface { return m.stub }

// fakeClientIdentity implements cid.ClientIdentity for a non-admin customer.
type fakeClientIdentity struct{}

func (f *fakeClientIdentity) GetID() (string, error)    { return "test-identity", nil }
func (f *fakeClientIdentity) GetMSPID() (string, error) { return "LandregMSP", nil }
func (f *fakeClientIdentity) GetAttributeValue(attrName string) (string, bool, error) {
	return "", false, nil
}
func (f *fakeClientIdentity) AssertAttributeValue(attrName, attrValue string) error { return nil }
func (f *fakeClientIdentity) GetX509Certificate() (*x509.Certificate, error) {
	return &x509.Certificate{}, nil
}

// We don't define GetClientIdentity on mockCtx — instead we override it in the test
// by making a more specific testCtx.

// testCtx embeds mockCtx and overrides GetClientIdentity.
type testCtx struct {
	contractapi.TransactionContext
	stub     shim.ChaincodeStubInterface
	clientID *fakeClientIdentity
}

func (m *testCtx) GetStub() shim.ChaincodeStubInterface { return m.stub }
func (m *testCtx) GetClientIdentity() cid.ClientIdentity {
	return m.clientID
}

func putJSON(s shim.ChaincodeStubInterface, key string, v any) {
	d, _ := json.Marshal(v)
	_ = s.PutState(key, d)
}

func TestMakeOffer_MultipleBuyers(t *testing.T) {
	stub := newStubState()
	ctx := &testCtx{stub: stub, clientID: &fakeClientIdentity{}}

	putJSON(stub, "multi-test", &LandRecord{
		ID: "multi-test", Owner: "NID-001", Location: "Test", Area: 500,
		Status: "listed", Price: 100000, RegisteredAt: "2024-01-01T00:00:00Z",
	})
	putJSON(stub, ListingKeyPrefix+"multi-test", &SaleListing{
		ID: ListingKeyPrefix + "multi-test", LandID: "multi-test",
		Seller: "NID-001", Price: 100000, Status: "active", CreatedAt: "2024-01-01T00:00:00Z",
	})

	sc := &SmartContract{}

	// Test 1: Buyer A (NID-002) makes offer → must succeed
	offerA, err := sc.MakeOffer(ctx, "NID-002", "multi-test", 95000)
	if err != nil {
		t.Fatalf("FAIL: Buyer A (NID-002) offer: %v", err)
	}
	t.Logf("PASS: Buyer A offer created: %s", offerA)
	if offerA != "OFFER_multi-test_NID-002" {
		t.Errorf("unexpected offer ID: %s", offerA)
	}

	// Test 2: Buyer B (NID-003) makes offer on same land → must succeed (THE FIX)
	offerB, err := sc.MakeOffer(ctx, "NID-003", "multi-test", 90000)
	if err != nil {
		t.Fatalf("FAIL: Buyer B (NID-003) offer — BUG NOT FIXED: %v", err)
	}
	t.Logf("PASS: Buyer B offer created: %s", offerB)

	// Test 3: Buyer A tries a SECOND offer → must be blocked
	_, err = sc.MakeOffer(ctx, "NID-002", "multi-test", 97000)
	if err == nil {
		t.Fatal("FAIL: Buyer A duplicate offer should have been BLOCKED but was allowed")
	}
	t.Logf("PASS: Buyer A duplicate correctly blocked: %v", err)

	// Test 4: Verify exactly 2 pending offers in state
	offers, err := sc.findAllOffersForLand(ctx, "multi-test")
	if err != nil {
		t.Fatalf("FAIL: findAllOffersForLand: %v", err)
	}
	if got := len(offers); got != 2 {
		t.Errorf("FAIL: expected 2 offers, got %d", got)
	}
	for _, o := range offers {
		if o.Status != "pending" {
			t.Errorf("FAIL: offer %s has status %q, want %q", o.ID, o.Status, "pending")
		}
	}
	t.Logf("PASS: 2 pending offers verified for multi-test")
}

func TestUpdateOffer(t *testing.T) {
	stub := newStubState()
	ctx := &testCtx{stub: stub, clientID: &fakeClientIdentity{}}

	putJSON(stub, "multi-upd", &LandRecord{
		ID: "multi-upd", Owner: "NID-001", Location: "Test", Area: 500,
		Status: "listed", Price: 100000, RegisteredAt: "2024-01-01T00:00:00Z",
	})
	putJSON(stub, ListingKeyPrefix+"multi-upd", &SaleListing{
		ID: ListingKeyPrefix + "multi-upd", LandID: "multi-upd",
		Seller: "NID-001", Price: 100000, Status: "active", CreatedAt: "2024-01-01T00:00:00Z",
	})

	sc := &SmartContract{}

	// Place initial offer
	offerID, err := sc.MakeOffer(ctx, "NID-002", "multi-upd", 95000)
	if err != nil {
		t.Fatalf("FAIL: initial MakeOffer: %v", err)
	}
	t.Logf("PASS: initial offer: %s", offerID)

	// Update the offer price
	updatedID, err := sc.UpdateOffer(ctx, "NID-002", "multi-upd", 92000)
	if err != nil {
		t.Fatalf("FAIL: UpdateOffer: %v", err)
	}
	t.Logf("PASS: updated offer: %s", updatedID)

	// Verify the price was updated
	offer, err := sc.getOfferByID(ctx, updatedID)
	if err != nil {
		t.Fatalf("FAIL: getOfferByID: %v", err)
	}
	if offer.OfferedPrice != 92000 {
		t.Errorf("FAIL: expected price 92000, got %.0f", offer.OfferedPrice)
	}
	if offer.Status != "pending" {
		t.Errorf("FAIL: expected pending, got %s", offer.Status)
	}
	t.Logf("PASS: price updated to %.0f, status still pending", offer.OfferedPrice)

	// Try updating with negative price — should fail
	_, err = sc.UpdateOffer(ctx, "NID-002", "multi-upd", -1)
	if err == nil {
		t.Fatal("FAIL: negative price should be rejected")
	}
	t.Logf("PASS: negative price rejected: %v", err)

	// Try updating someone else's offer — should fail
	_, err = sc.UpdateOffer(ctx, "NID-003", "multi-upd", 50000)
	if err == nil {
		t.Fatal("FAIL: should not update non-existent offer")
	}
	t.Logf("PASS: non-existent offer rejected: %v", err)

	// After accepting the offer, update should fail
	offer.Status = "accepted"
	_ = sc.putOffer(ctx, offer)
	_, err = sc.UpdateOffer(ctx, "NID-002", "multi-upd", 100000)
	if err == nil {
		t.Fatal("FAIL: should not update accepted offer")
	}
	t.Logf("PASS: accepted offer cannot be updated: %v", err)
}
