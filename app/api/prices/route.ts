import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

function buildPricesPrompt(product: {
  name: string;
  brand: string;
  model: string;
  condition: string;
  category: string;
}) {
  return `You are a reselling market expert with deep knowledge of eBay sold listings, StockX, Poshmark, Mercari, and Amazon FBA prices.

Product: "${product.name}"
Brand: "${product.brand}"
Model: "${product.model}"
Category: "${product.category}"
Condition: "${product.condition}"

Based on this product, provide realistic current resell market data.

Thrift stores typically price items $1–$25. Assume the buyer paid $5–$15 unless it's a premium item.

Return ONLY valid JSON — no markdown, no explanation:
{
  "flip_score": 72,
  "verdict": "FLIP IT",
  "max_pay_price": 12,
  "estimated_profit": 38,
  "fees_estimate": 12,
  "reasoning": "2 sentences: why this is or isn't worth flipping, and which platform is best.",
  "platforms": {
    "ebay": { "avg_sold": 62, "low": 35, "high": 95, "sold_30d": 87 },
    "poshmark": { "avg_sold": 55, "low": 30, "high": 80 },
    "mercari": { "avg_sold": 48, "low": 25, "high": 70 },
    "stockx": null,
    "amazon": null
  }
}

Rules:
- flip_score 0–100: 80+ great flip, 60–79 decent, 40–59 marginal, <40 pass
- verdict: "FLIP IT" if score ≥ 60, "PASS" if below
- max_pay_price: highest you'd pay at a thrift store to still profit
- estimated_profit: conservative profit after fees (assume 13% eBay fee + shipping ~$8)
- Set stockx to null if not a sneaker/streetwear brand, amazon to null if not FBA-appropriate
- For clothing/shoes: populate poshmark and mercari. For electronics: populate amazon.
- Use real market knowledge — be accurate, not optimistic`;
}

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in response");
  return JSON.parse(text.slice(start, end + 1));
}

export async function POST(req: NextRequest) {
  try {
    const product = await req.json();

    if (!product?.name) {
      return NextResponse.json({ error: "No product data" }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(buildPricesPrompt(product));
    const parsed = extractJson(result.response.text());

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[prices]", err);
    return NextResponse.json(
      { error: "Price lookup failed" },
      { status: 500 }
    );
  }
}
