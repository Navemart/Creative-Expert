import { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Send, Plus, Bot, MessageSquare } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

const STORAGE_KEY = 'nave-ai-history';
const AGENT = { id: '0be4b5ea-3ae4-418f-b75e-b03cfbc041be', name: 'מאבחן התוכן' };
const OPENING_MESSAGE = 'יאללה בוא נצא לדרך, תדביק פה את הסקיצה המבולגנת שלך, הסקריפט המלוטש שלך או כל דבר שרשמת בצד ואתה רוצה לבחון אותו יחד איתי!';

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveHistory(h) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(h.slice(-50))); } catch {}
}

const markdownComponents = {
  h1: ({ children }) => <h1 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.75rem', marginTop: '1.25rem', color: 'white', letterSpacing: '-0.01em' }}>{children}</h1>,
  h2: ({ children }) => <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.6rem', marginTop: '1.5rem', color: 'white', paddingBottom: '0.4rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>{children}</h2>,
  h3: ({ children }) => <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem', marginTop: '1rem', color: 'rgba(255,255,255,0.95)' }}>{children}</h3>,
  p: ({ children }) => <p style={{ marginBottom: '0.9rem', lineHeight: 1.85, fontSize: '1rem' }}>{children}</p>,
  strong: ({ children }) => <strong style={{ fontWeight: 700, color: 'white' }}>{children}</strong>,
  em: ({ children }) => <em style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.75)' }}>{children}</em>,
  ul: ({ children }) => <ul style={{ paddingRight: '1.4rem', marginBottom: '0.9rem', listStyleType: 'disc', fontSize: '1rem' }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ paddingRight: '1.4rem', marginBottom: '0.9rem', listStyleType: 'decimal', fontSize: '1rem' }}>{children}</ol>,
  li: ({ children }) => <li style={{ marginBottom: '0.45rem', lineHeight: 1.8 }}>{children}</li>,
  hr: () => <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.12)', margin: '1.5rem 0' }} />,
  table: ({ children }) => (
    <div style={{ overflowX: 'auto', marginBottom: '1.25rem', marginTop: '0.5rem', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem', direction: 'rtl' }}>{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead style={{ background: 'rgba(255,255,255,0.1)' }}>{children}</thead>,
  th: ({ children }) => <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, fontSize: '0.9rem', color: 'white', borderBottom: '1px solid rgba(255,255,255,0.15)', whiteSpace: 'nowrap' }}>{children}</th>,
  td: ({ children }) => <td style={{ padding: '11px 14px', textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.07)', verticalAlign: 'top', lineHeight: 1.7, fontSize: '0.95rem' }}>{children}</td>,
  code: ({ children }) => <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 7px', borderRadius: 5, fontSize: '0.88em' }}>{children}</code>,
  blockquote: ({ children }) => <blockquote style={{ borderRight: '3px solid rgba(255,255,255,0.3)', paddingRight: '1rem', margin: '1rem 0', color: 'rgba(255,255,255,0.7)', fontStyle: 'italic' }}>{children}</blockquote>,
};

function ChatMessage({ msg }) {
  const isUser = msg.role === 'user';
  const normalizedContent = msg.content;
  return (
    <div className={`flex mb-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className="max-w-[88%] px-5 py-4"
        style={isUser
          ? { background: 'rgba(255,255,255,0.12)', color: 'white', borderRadius: '18px 4px 18px 18px' }
          : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.88)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px 18px 18px 18px' }
        }
      >
        {isUser
          ? <span style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>{msg.content}</span>
          : <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={markdownComponents}>{normalizedContent}</ReactMarkdown>
        }
      </div>
    </div>
  );
}

export default function NaveAI() {
  const { user } = useUser();
  const firstName = user?.firstName || 'שלך';

  const [sessions, setSessions] = useState(() => loadHistory());
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function startNewChat() {
    const id = Date.now().toString();
    const opening = { role: 'assistant', content: OPENING_MESSAGE };
    const newSession = { id, title: 'שיחה חדשה', messages: [opening], createdAt: Date.now() };
    const next = [newSession, ...sessions];
    setSessions(next);
    saveHistory(next);
    setCurrentSessionId(id);
    setMessages([opening]);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function openSession(id) {
    const s = sessions.find(s => s.id === id);
    if (!s) return;
    setCurrentSessionId(id);
    setMessages(s.messages);
  }

  function updateSessionMessages(id, msgs) {
    setSessions(prev => {
      const firstUser = msgs.find(m => m.role === 'user')?.content?.slice(0, 30);
      const title = firstUser || 'שיחה חדשה';
      const next = prev.map(s => s.id === id ? { ...s, messages: msgs, title } : s);
      saveHistory(next);
      return next;
    });
  }

  async function sendMessage(text) {
    if (!currentSessionId) return;
    const userMsg = { role: 'user', content: text };
    const nextMessages = [...messages, userMsg];
    setMessages([...nextMessages, { role: 'assistant', content: '' }]);
    setInput('');
    setLoading(true);
    updateSessionMessages(currentSessionId, nextMessages);

    let accumulated = '';
    try {
      const res = await fetch('/api/nave-ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages,
          agentId: AGENT.id,
          userId: user?.id ?? null,
        }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') break;
          try {
            const parsed = JSON.parse(raw);
            if (parsed.text) {
              accumulated += parsed.text;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: accumulated };
                return updated;
              });
            }
          } catch {}
        }
      }
    } catch {
      accumulated = 'שגיאת רשת. נסה שוב.';
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: accumulated };
        return updated;
      });
    } finally {
      setLoading(false);
      updateSessionMessages(currentSessionId, [...nextMessages, { role: 'assistant', content: accumulated }]);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    sendMessage(input.trim());
  }

  const inChat = !!currentSessionId;

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Mobile history drawer backdrop ── */}
      {mobileHistoryOpen && (
        <div className="fixed inset-0 z-40 md:hidden" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setMobileHistoryOpen(false)} />
      )}

      {/* ── History sidebar ── */}
      <div
        className={`flex flex-col flex-none border-l overflow-hidden transition-all duration-200
          fixed inset-y-0 right-0 z-50 md:static md:z-auto
          ${mobileHistoryOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}
        style={{ width: 220, borderColor: 'rgba(255,255,255,0.07)', background: 'rgb(var(--bg-chrome))' }}
      >
        <div className="p-3 border-b flex-none" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <button
            onClick={() => { startNewChat(); setMobileHistoryOpen(false); }}
            className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-white/10"
            style={{ color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <Plus size={14} />
            שיחה חדשה
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {sessions.length === 0 && (
            <p className="text-xs text-center mt-6" style={{ color: 'rgba(255,255,255,0.25)' }}>אין שיחות עדיין</p>
          )}
          {sessions.map(s => (
            <button
              key={s.id}
              onClick={() => { openSession(s.id); setMobileHistoryOpen(false); }}
              className="w-full text-right rounded-lg px-3 py-2 text-xs truncate transition-colors hover:bg-white/10 flex items-center gap-2"
              style={{
                color: s.id === currentSessionId ? 'white' : 'rgba(255,255,255,0.5)',
                background: s.id === currentSessionId ? 'rgba(255,255,255,0.08)' : 'transparent',
              }}
            >
              <MessageSquare size={12} className="flex-none opacity-40" />
              <span className="truncate">{s.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!inChat ? (
          /* Home screen */
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center overflow-hidden">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5" style={{ background: 'rgb(var(--accent))' }}>
              <Bot size={28} style={{ color: 'rgb(var(--accent-foreground))' }} />
            </div>
            <h1 className="text-2xl font-bold mb-2" style={{ color: 'white' }}>היי {firstName}, מה קורה?</h1>
            <p className="text-sm mb-8 max-w-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
              NaveAI קורא את הנתונים שלך ועוזר לך להתקדם לפי ה-IP של Creative Expert.
            </p>
            <button
              onClick={startNewChat}
              className="flex items-center gap-3 rounded-xl px-5 py-4 text-right transition-colors hover:bg-white/10 border w-full max-w-sm"
              style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' }}
            >
              <span className="text-xl">🎬</span>
              <div>
                <div className="font-semibold text-sm" style={{ color: 'white' }}>מאבחן התוכן</div>
                <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>תדביק סקריפט — תקבל ציון, אבחון מלא וגרסה מתוקנת.</div>
              </div>
            </button>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-5">
              <div className="max-w-2xl mx-auto">
                {messages.map((m, i) => <ChatMessage key={i} msg={m} />)}
                {loading && (
                  <div className="flex justify-end mb-3">
                    <div className="rounded-2xl px-4 py-3 text-sm" style={{ background: 'rgba(30,30,40,0.7)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <span className="animate-pulse">מקליד...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input */}
            <div className="flex-none px-4 pb-4 pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <div className="max-w-2xl mx-auto">
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <button type="button" onClick={() => setMobileHistoryOpen(true)}
                    className="md:hidden flex-none rounded-xl px-3 py-3 transition-colors hover:bg-white/10"
                    style={{ color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <MessageSquare size={16} />
                  </button>
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder={`שאל את ${AGENT.name}...`}
                    disabled={loading}
                    className="flex-1 rounded-xl px-4 py-3 text-sm outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || loading}
                    className="rounded-xl px-4 py-3 transition-opacity disabled:opacity-40"
                    style={{ background: 'rgb(var(--accent))', color: 'rgb(var(--accent-foreground))' }}
                  >
                    <Send size={16} />
                  </button>
                </form>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
