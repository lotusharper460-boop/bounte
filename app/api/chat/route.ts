import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "Missing GROQ_API_KEY configuration." }, { status: 400 });
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: 'POST',
      headers: { 
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile", 
        messages: [
          {
            role: "system",
            content: "You are the Eduvora AI Communications Assistant. Your job is to help school proprietors and teachers in Nigeria draft highly professional, polite, and clear messages, emails, or SMS broadcasts for parents and students. Keep your responses focused, helpful, and culturally appropriate for the Nigerian educational system."
          },
          // We spread the existing chat history here so the AI remembers the conversation
          ...messages
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Groq API Error:", data);
      return NextResponse.json({ error: data.error?.message || "Groq API rejected the request." }, { status: 502 });
    }

    const aiMessage = data.choices?.[0]?.message?.content;
    
    if (!aiMessage) {
      throw new Error("AI returned an empty response.");
    }

    return NextResponse.json({ reply: aiMessage });

  } catch (error: any) {
    console.error("🔥 Chatbot Error:", error);
    return NextResponse.json({ error: "Chat failed to process." }, { status: 500 });
  }
}