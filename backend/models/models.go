package models

// ── Request types ────────────────────────────────────────────────────

type RegisterRequest struct {
	PlotID       string  `json:"plotId" binding:"required"`
	SurveyNumber string  `json:"surveyNumber"`
	Owner        string  `json:"owner" binding:"required"`
	Location     string  `json:"location"`
	Province     string  `json:"province"`
	Area         float64 `json:"area"`
	LandType     string  `json:"landType"`
}

type TransferRequest struct {
	PlotID string  `json:"plotId" binding:"required"`
	Buyer  string  `json:"buyer" binding:"required"`
	Price  float64 `json:"price"`
}

type SplitRequest struct {
	PlotID   string      `json:"plotId" binding:"required"`
	Children []ChildSpec `json:"children" binding:"required"`
}

type ChildSpec struct {
	PlotID string  `json:"plotId"`
	Owner  string  `json:"owner"`
	Area   float64 `json:"area"`
}

// Unified POST body — action field dispatched by handler.
type ActionRequest struct {
	Action string `json:"action" binding:"required"`

	// Register
	PlotID       string  `json:"plotId"`
	SurveyNumber string  `json:"surveyNumber"`
	Owner        string  `json:"owner"`
	Location     string  `json:"location"`
	Province     string  `json:"province"`
	Area         float64 `json:"area"`
	LandType     string  `json:"landType"`

	// Transfer
	Buyer string  `json:"buyer"`
	Price float64 `json:"price"`

	// Split
	Children []ChildSpec `json:"children"`

	// Sale proposals
	Description string `json:"description"`

	// User management
	UserID    string `json:"userId"`
	UserName  string `json:"name"`
	UserRoles string `json:"roles"` // JSON array string, e.g. '["seller","buyer"]'
}

// ── Response envelope ────────────────────────────────────────────────

type APIResponse struct {
	Success bool        `json:"success,omitempty"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}
