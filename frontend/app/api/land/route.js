import { NextResponse } from "next/server";
import {
  getAllLand,
  queryLand,
  getLandByOwner,
  getLandByStatus,
  getLandByProvince,
  getChildrenOf,
  registerLand,
  transferLand,
  splitLand,
  setMortgage,
  clearMortgage,
  fileDispute,
  resolveDispute,
} from "@/lib/fabric";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const owner = searchParams.get("owner");
    const status = searchParams.get("status");
    const province = searchParams.get("province");
    const parent = searchParams.get("parent");

    if (id) return NextResponse.json(await queryLand(id));
    if (owner) return NextResponse.json(await getLandByOwner(owner));
    if (status) return NextResponse.json(await getLandByStatus(status));
    if (province) return NextResponse.json(await getLandByProvince(province));
    if (parent) return NextResponse.json(await getChildrenOf(parent));
    return NextResponse.json(await getAllLand());
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { action, ...body } = await request.json();
    switch (action) {
      case "register": {
        const {
          plotId,
          surveyNumber,
          owner,
          location,
          province,
          area,
          landType,
        } = body;
        if (!plotId || !owner)
          return NextResponse.json(
            { error: "plotId + owner required" },
            { status: 400 },
          );
        return NextResponse.json(
          registerLand(
            plotId,
            surveyNumber || "",
            owner,
            location || "",
            province || "",
            area || 0,
            landType || "residential",
          ),
        );
      }
      case "transfer": {
        const { plotId, buyer, price } = body;
        if (!plotId || !buyer)
          return NextResponse.json(
            { error: "plotId + buyer required" },
            { status: 400 },
          );
        return NextResponse.json(transferLand(plotId, buyer, price || 0));
      }
      case "split": {
        const { plotId, children } = body;
        if (!plotId || !children)
          return NextResponse.json(
            { error: "plotId + children required" },
            { status: 400 },
          );
        return NextResponse.json(splitLand(plotId, JSON.stringify(children)));
      }
      case "mortgage": {
        const { plotId, bank, amount, startDate, endDate } = body;
        if (!plotId || !bank)
          return NextResponse.json(
            { error: "plotId + bank required" },
            { status: 400 },
          );
        return NextResponse.json(
          setMortgage(
            plotId,
            bank,
            amount || 0,
            startDate || "",
            endDate || "",
          ),
        );
      }
      case "clear-mortgage": {
        if (!body.plotId)
          return NextResponse.json(
            { error: "plotId required" },
            { status: 400 },
          );
        return NextResponse.json(clearMortgage(body.plotId));
      }
      case "dispute": {
        const { plotId, caseNumber, court, description } = body;
        if (!plotId || !caseNumber)
          return NextResponse.json(
            { error: "plotId + caseNumber required" },
            { status: 400 },
          );
        return NextResponse.json(
          fileDispute(plotId, caseNumber, court || "", description || ""),
        );
      }
      case "resolve-dispute": {
        if (!body.plotId)
          return NextResponse.json(
            { error: "plotId required" },
            { status: 400 },
          );
        return NextResponse.json(resolveDispute(body.plotId));
      }
      default:
        return NextResponse.json(
          { error: "unknown action: " + action },
          { status: 400 },
        );
    }
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
