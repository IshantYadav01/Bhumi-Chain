package models

type ActionRequest struct {
	Action string `json:"action" binding:"required"`

	// Register
	PlotID   string  `json:"plotId"`
	Owner    string  `json:"owner"`
	Area     float64 `json:"area"`
	Location string  `json:"location"`

	// List / offer
	LandID       string  `json:"landId"`
	Price        float64 `json:"price"`
	OfferID      string  `json:"offerId"`
	OfferedPrice float64 `json:"offeredPrice"`

	// Transaction
	TxID string `json:"txId"`

	// Auth
	NID      string `json:"nid"`
	Password string `json:"password"`
	Name     string `json:"name"`
	Role     string `json:"role"`
}

type APIResponse struct {
	Success bool        `json:"success,omitempty"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}
