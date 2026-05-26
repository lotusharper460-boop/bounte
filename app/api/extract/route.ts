import { NextResponse } from 'next/server';
import mammoth from 'mammoth';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const apiKey = process.env.GROQ_API_KEY;

    if (!file || !apiKey) {
      return NextResponse.json({ error: "Missing file or GROQ_API_KEY configuration." }, { status: 400 });
    }

    // 1. Convert Word document to raw text
    const arrayBuffer = await file.arrayBuffer();
    const { value: extractedText } = await mammoth.extractRawText({ buffer: Buffer.from(arrayBuffer) });

    if (!extractedText.trim()) {
      return NextResponse.json({ error: "The document appears to be empty." }, { status: 400 });
    }

    // 2. Execute Groq API Call with the active Llama 3.3 model
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: 'POST',
      headers: { 
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({
        // Using the updated model name to avoid deprecation errors
        model: "llama-3.3-70b-versatile", 
        messages: [
          {
            role: "system",
            content: "You are an educational data extraction engine. Always return valid JSON matching this structure: {\"questions\": [{\"questionText\": \"\", \"options\": [], \"correctIndex\": 0}]}"
          },
          {
            role: "user",
            content: "Extract all multiple choice questions from the following text: " + extractedText
          }
        ],
        // Force Groq to return pure JSON without markdown backticks
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();

    // 3. Handle potential API failures (e.g., rate limits or model errors)
    if (!response.ok) {
      console.error("❌ Groq API Error:", data);
      return NextResponse.json({ error: data.error?.message || "Groq API rejected the request." }, { status: 502 });
    }

    const aiText = data.choices?.[0]?.message?.content;
    if (!aiText) {
      throw new Error("AI returned an empty response.");
    }

    // 4. Parse and return the structured JSON directly to the frontend
    return NextResponse.json(JSON.parse(aiText));

  } catch (error: any) {
    console.error("🔥 Groq Extraction Final Error:", error);
    return NextResponse.json({ error: "Extraction failed. Please check server logs." }, { status: 500 });
  }
}