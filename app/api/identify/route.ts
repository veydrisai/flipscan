import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const VISION_PROMPT = `You are a product identification expert for FlipScan, a thrift store reselling app.
Analyze this image and identify the product.

Return ONLY a valid JSON object — no markdown, no explanation:
{
  "identified": true,
  "name": "Full product name (brand + model if known)",
  "brand": "Brand name or empty string",
  "model": "Model number or name if visible, else empty string",
  "category": "one of: electronics|clothing|shoes|handbags|toys|books|music|collectibles|sports|home|other",
  "condition": "one of: like_new|good|fair|poor",
  "confidence": 85,
  "description": "One sentence describing what you see and why it may have resell value"
}

If you cannot clearly identify a specific product, return:
{"identified": false}

Be specific — "Nike Air Max 90" not just "shoe". Estimate condition from visible wear.`;

function TEXT_PROMPT(query: string) {
  return `You are a product identification expert for FlipScan, a thrift store reselling app.
The user typed the name of a thrift store item: "${query}"

Return product details as if you identified it.

Return ONLY a valid JSON object — no markdown, no explanation:
{
  "identified": true,
  "name": "Full product name (brand + model if inferrable)",
  "brand": "Brand name or empty string",
  "model": "Model number or name if known, else empty string",
  "category": "one of: electronics|clothing|shoes|handbags|toys|books|music|collectibles|sports|home|other",
  "condition": "good",
  "confidence": 75,
  "description": "One sentence describing this item and why it may have resell value"
}

If the query is too vague to identify anything useful, return:
{"identified": false}

Be specific — infer the most likely product from the description.`;
}

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in response");
  return JSON.parse(text.slice(start, end + 1));
}

export async function POST(req: NextRequest) {
  try {
    const { image, text } = await req.json();

    if (!image && !text) {
      return NextResponse.json({ error: "No image or text provided" }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    let result;

    if (text) {
      result = await model.generateContent(TEXT_PROMPT(text));
    } else {
      result = await model.generateContent([
        { inlineData: { data: image, mimeType: "image/jpeg" } },
        VISION_PROMPT,
      ]);
    }

    const parsed = extractJson(result.response.text());
    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[identify]", message);
    return NextResponse.json(
      { identified: false, error: message },
      { status: 500 }
    );
  }
}
