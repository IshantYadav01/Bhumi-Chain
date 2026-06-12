/*
 * SPDX-License-Identifier: Apache-2.0
 *
 * basic.go — Simple asset-management chaincode for Hyperledger Fabric.
 *
 * Operations:
 *   InitLedger  – seed the ledger with initial assets
 *   CreateAsset – add a new asset
 *   ReadAsset   – read an asset by ID
 *   UpdateAsset – update an asset's value
 *   DeleteAsset – remove an asset
 *   GetAllAssets – query all assets
 *   AssetExists – check if an asset exists
 *   TransferAsset – change asset ownership
 */

package main

import (
	"encoding/json"
	"fmt"

	"github.com/hyperledger/fabric-contract-api-go/v2/contractapi"
)

// SmartContract provides functions for managing assets.
type SmartContract struct {
	contractapi.Contract
}

// Asset describes a basic on-ledger asset.
type Asset struct {
	ID    string `json:"id"`
	Owner string `json:"owner"`
	Value int    `json:"value"`
	Color string `json:"color"`
	Size  int    `json:"size"`
}

// InitLedger seeds the ledger with sample assets.
func (s *SmartContract) InitLedger(ctx contractapi.TransactionContextInterface) error {
	assets := []Asset{
		{ID: "asset1", Owner: "Alice", Value: 100, Color: "blue", Size: 5},
		{ID: "asset2", Owner: "Bob", Value: 200, Color: "red", Size: 10},
		{ID: "asset3", Owner: "Charlie", Value: 300, Color: "green", Size: 15},
		{ID: "asset4", Owner: "Diana", Value: 400, Color: "yellow", Size: 20},
	}

	for _, asset := range assets {
		assetJSON, err := json.Marshal(asset)
		if err != nil {
			return err
		}
		if err := ctx.GetStub().PutState(asset.ID, assetJSON); err != nil {
			return fmt.Errorf("failed to put asset %s: %w", asset.ID, err)
		}
	}
	return nil
}

// CreateAsset issues a new asset on the ledger.
func (s *SmartContract) CreateAsset(ctx contractapi.TransactionContextInterface, id, owner string, value int, color string, size int) error {
	exists, err := s.AssetExists(ctx, id)
	if err != nil {
		return err
	}
	if exists {
		return fmt.Errorf("asset %s already exists", id)
	}

	asset := Asset{
		ID:    id,
		Owner: owner,
		Value: value,
		Color: color,
		Size:  size,
	}
	assetJSON, err := json.Marshal(asset)
	if err != nil {
		return err
	}
	return ctx.GetStub().PutState(id, assetJSON)
}

// ReadAsset returns the asset stored on the ledger.
func (s *SmartContract) ReadAsset(ctx contractapi.TransactionContextInterface, id string) (*Asset, error) {
	assetJSON, err := ctx.GetStub().GetState(id)
	if err != nil {
		return nil, fmt.Errorf("failed to read asset %s: %w", id, err)
	}
	if assetJSON == nil {
		return nil, fmt.Errorf("asset %s does not exist", id)
	}

	var asset Asset
	if err := json.Unmarshal(assetJSON, &asset); err != nil {
		return nil, err
	}
	return &asset, nil
}

// UpdateAsset modifies an existing asset's value, color, and size.
func (s *SmartContract) UpdateAsset(ctx contractapi.TransactionContextInterface, id, color string, value, size int) error {
	asset, err := s.ReadAsset(ctx, id)
	if err != nil {
		return err
	}
	asset.Value = value
	asset.Color = color
	asset.Size = size

	assetJSON, err := json.Marshal(asset)
	if err != nil {
		return err
	}
	return ctx.GetStub().PutState(id, assetJSON)
}

// DeleteAsset removes an asset from the ledger.
func (s *SmartContract) DeleteAsset(ctx contractapi.TransactionContextInterface, id string) error {
	exists, err := s.AssetExists(ctx, id)
	if err != nil {
		return err
	}
	if !exists {
		return fmt.Errorf("asset %s does not exist", id)
	}
	return ctx.GetStub().DelState(id)
}

// TransferAsset changes the owner of an asset.
func (s *SmartContract) TransferAsset(ctx contractapi.TransactionContextInterface, id, newOwner string) error {
	asset, err := s.ReadAsset(ctx, id)
	if err != nil {
		return err
	}
	asset.Owner = newOwner

	assetJSON, err := json.Marshal(asset)
	if err != nil {
		return err
	}
	return ctx.GetStub().PutState(id, assetJSON)
}

// AssetExists returns true when an asset with the given ID exists.
func (s *SmartContract) AssetExists(ctx contractapi.TransactionContextInterface, id string) (bool, error) {
	assetJSON, err := ctx.GetStub().GetState(id)
	if err != nil {
		return false, fmt.Errorf("failed to read asset %s: %w", id, err)
	}
	return assetJSON != nil, nil
}

// GetAllAssets returns all assets on the ledger.
func (s *SmartContract) GetAllAssets(ctx contractapi.TransactionContextInterface) ([]*Asset, error) {
	resultsIterator, err := ctx.GetStub().GetStateByRange("", "")
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var assets []*Asset
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}
		var asset Asset
		if err := json.Unmarshal(queryResponse.Value, &asset); err != nil {
			return nil, err
		}
		assets = append(assets, &asset)
	}
	return assets, nil
}

func main() {
	chaincode, err := contractapi.NewChaincode(&SmartContract{})
	if err != nil {
		fmt.Printf("Error creating chaincode: %s", err.Error())
		return
	}
	if err := chaincode.Start(); err != nil {
		fmt.Printf("Error starting chaincode: %s", err.Error())
	}
}
