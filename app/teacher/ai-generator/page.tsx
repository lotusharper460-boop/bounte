'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Send, Bot, User, Sparkles } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function AIMessagePage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hello! I am your Eduvora Communications AI. Do you need help drafting a fee reminder, a newsletter to parents, or a student announcement today?' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom of the chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input };
    const newChatHistory = [...messages, userMessage];
    
    setMessages(newChatHistory);
    setInput('');
    setIsTyping(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newChatHistory }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setMessages([...newChatHistory, { role: 'assistant', content: data.reply }]);
    } catch (error) {
      console.error("Chat Error:", error);
      alert("Failed to send message to AI.");
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1426] text-white font-sans selection:bg-yellow-400 selection:text-black flex flex-col">
      
      {/* HEADER */}
      <header className="border-b border-white/10 bg-[#0B1426]/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/teacher/dashboard" className="text-slate-400 hover:text-yellow-400 transition-colors">
              <ArrowLeft size={24} />
            </Link>
            <div>
              <p className="text-[10px] font-black tracking-[0.2em] text-yellow-400 uppercase">Communications</p>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles size={18} className="text-yellow-400" /> AI Message Drafter
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* CHAT AREA */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-8 flex flex-col gap-6 overflow-y-auto">
        {messages.map((msg, index) => (
          <div key={index} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-yellow-400 text-[#0B1426]' : 'bg-white/10 text-yellow-400'}`}>
              {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
            </div>
            
            <div className={`max-w-[80%] p-5 rounded-2xl text-sm leading-relaxed ${
              msg.role === 'user' 
                ? 'bg-yellow-400 text-[#0B1426] rounded-tr-none font-medium' 
                : 'bg-white/5 border border-white/10 text-slate-300 rounded-tl-none whitespace-pre-wrap'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-white/10 text-yellow-400 flex items-center justify-center shrink-0">
              <Bot size={20} />
            </div>
            <div className="bg-white/5 border border-white/10 p-5 rounded-2xl rounded-tl-none flex items-center gap-2">
              <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce [animation-delay:0.2s]" />
              <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* INPUT AREA */}
      <div className="border-t border-white/10 bg-[#0B1426] p-6 sticky bottom-0">
        <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto relative">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="E.g., Draft a polite SMS reminding parents that 3rd term fees are due next week..."
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-6 pr-16 text-white focus:border-yellow-400 focus:outline-none transition-colors"
            disabled={isTyping}
          />
          <button 
            type="submit" 
            disabled={isTyping || !input.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-yellow-400 text-[#0B1426] rounded-xl flex items-center justify-center hover:bg-yellow-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  )
}