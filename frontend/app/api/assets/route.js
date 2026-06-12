import { NextResponse } from "next/server";
import {
  getAllAssets,
  createAsset,
  updateAsset,
  deleteAsset,
  transferAsset,
  initLedger,
} from "@/lib/fabric";

// GET /api/assets — list all assets
export async function GET() {
  try {
    const assets = await getAllAssets();
    return NextResponse.json(assets);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/assets — create, update, delete, transfer, or init
export async function POST(request) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "create": {
        const { id, owner, value, color, size } = body;
        if (!id || !owner) {
          return NextResponse.json(
            { error: "id and owner are required" },
            { status: 400 }
          );
        }
        const result = createAsset(id, owner, value || 0, color || "", size || 0);
        return NextResponse.json(result);
      }

      case "update": {
        const { id, color, value, size } = body;
        if (!id) {
          return NextResponse.json(
            { error: "id is required" },
            { status: 400 }
          );
        }
        const result = updateAsset(id, color || "", value || 0, size || 0);
        return NextResponse.json(result);
      }

      case "delete": {
        const { id } = body;
        if (!id) {
          return NextResponse.json(
            { error: "id is required" },
            { status: 400 }
          );
        }
        const result = deleteAsset(id);
        return NextResponse.json(result);
      }

      case "transfer": {
        const { id, newOwner } = body;
        if (!id || !newOwner) {
          return NextResponse.json(
            { error: "id and newOwner are required" },
            { status: 400 }
          );
        }
        const result = transferAsset(id, newOwner);
        return NextResponse.json(result);
      }

      case "init": {
        const result = initLedger();
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json(
          { error: `unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
