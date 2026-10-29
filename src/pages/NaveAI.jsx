import { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Send, Plus, Bot, MessageSquare, Paperclip, X as XIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

const STORAGE_KEY = 'nave-ai-history';

const AGENT_ICONS = {
  '0be4b5ea-3ae4-418f-b75e-b03cfbc041be': '🎬',
  'c75373cc-18d4-4bab-b932-96605bacf5af': '💬',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890': '✍️',
};
const DEFAULT_ICON = '🤖';

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

  const [agents, setAgents] = useState([]);
  const [sessions, setSessions] = useState(() => loadHistory());
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [currentAgent, setCurrentAgent] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [homeInput, setHomeInput] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const [dragging, setDragging] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetch('/api/nave-ai/agents')
      .then(r => r.json())
      .then(data => setAgents(Array.isArray(data) ? data.filter(a => a.id in AGENT_ICONS) : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function startNewChat(agent) {
    const id = Date.now().toString();
    const opening = { role: 'assistant', content: agent.description || `שלום! אני ${agent.name}. במה אוכל לעזור?` };
    const newSession = { id, title: 'שיחה חדשה', agentId: agent.id, agentName: agent.name, messages: [opening], createdAt: Date.now() };
    const next = [newSession, ...sessions];
    setSessions(next);
    saveHistory(next);
    setCurrentSessionId(id);
    setCurrentAgent(agent);
    setMessages([opening]);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function openSession(s) {
    setCurrentSessionId(s.id);
    setCurrentAgent(agents.find(a => a.id === s.agentId) || { id: s.agentId, name: s.agentName || 'NaveAI' });
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

  const NAVE_AI_AGENT_ID = 'c75373cc-18d4-4bab-b932-96605bacf5af';

  async function startWithMessage(text) {
    if (!text.trim()) return;
    const agent = agents.find(a => a.id === NAVE_AI_AGENT_ID) || agents[0];
    if (!agent) return;

    const id = Date.now().toString();
    const opening = { role: 'assistant', content: agent.description || `שלום! אני ${agent.name}. במה אוכל לעזור?` };
    const userMsg = { role: 'user', content: text.trim() };
    const initMessages = [opening, userMsg];
    const newSession = { id, title: text.trim().slice(0, 30), agentId: agent.id, agentName: agent.name, messages: initMessages, createdAt: Date.now() };
    const next = [newSession, ...sessions];
    setSessions(next);
    saveHistory(next);
    setCurrentSessionId(id);
    setCurrentAgent(agent);
    setMessages([...initMessages, { role: 'assistant', content: '' }]);
    setHomeInput('');
    setLoading(true);

    let accumulated = '';
    try {
      const res = await fetch('/api/nave-ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: initMessages, imageAttachments: [], lastUserText: text.trim(), agentId: agent.id, userId: user?.id ?? null }),
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
              setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: accumulated }; return u; });
            }
          } catch {}
        }
      }
    } catch {
      accumulated = 'שגיאת רשת. נסה שוב.';
      setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: accumulated }; return u; });
    } finally {
      setLoading(false);
      const final = [...initMessages, { role: 'assistant', content: accumulated }];
      setSessions(prev => { const n = prev.map(s => s.id === id ? { ...s, messages: final } : s); saveHistory(n); return n; });
    }
  }

  async function sendMessage(text, imageAttachments = []) {
    if (!currentSessionId || !currentAgent) return;
    const displayContent = text || imageAttachments.map(a => `[תמונה: ${a.name}]`).join(' ');
    const userMsg = { role: 'user', content: displayContent };
    const nextMessages = [...messages, userMsg];
    setMessages([...nextMessages, { role: 'assistant', content: '' }]);
    setLoading(true);
    updateSessionMessages(currentSessionId, nextMessages);

    let accumulated = '';
    try {
      const res = await fetch('/api/nave-ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages,
          imageAttachments,
          lastUserText: text,
          agentId: currentAgent.id,
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

  function handleFiles(newFiles) {
    setAttachments(prev => [...prev, ...Array.from(newFiles)]);
  }

  function removeAttachment(idx) {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  async function toBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleSubmit(e) {
    e?.preventDefault();
    if ((!input.trim() && attachments.length === 0) || loading) return;
    const text = input.trim();
    const pendingAttachments = [...attachments];
    setAttachments([]);
    setInput('');

    // Build content array for vision support
    const imageAttachments = [];
    const otherNames = [];
    for (const file of pendingAttachments) {
      if (file.type.startsWith('image/')) {
        const data = await toBase64(file);
        imageAttachments.push({ type: 'image', mediaType: file.type, data, name: file.name });
      } else {
        otherNames.push(file.name);
      }
    }

    let finalText = text;
    if (otherNames.length > 0) {
      finalText += (finalText ? '\n\n' : '') + `[קבצים מצורפים: ${otherNames.join(', ')}]`;
    }

    sendMessage(finalText, imageAttachments);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
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
            onClick={() => { setCurrentSessionId(null); setCurrentAgent(null); setMessages([]); setMobileHistoryOpen(false); }}
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
              onClick={() => { openSession(s); setMobileHistoryOpen(false); }}
              className="w-full text-right rounded-lg px-3 py-2 text-xs truncate transition-colors hover:bg-white/10 flex items-center gap-2"
              style={{
                color: s.id === currentSessionId ? 'white' : 'rgba(255,255,255,0.5)',
                background: s.id === currentSessionId ? 'rgba(255,255,255,0.08)' : 'transparent',
              }}
            >
              <span className="flex-none">{AGENT_ICONS[s.agentId] || DEFAULT_ICON}</span>
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
            <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}>
              {agents.map((agent, i) => (
                <button
                  key={agent.id}
                  onClick={() => startNewChat(agent)}
                  className="flex items-center gap-4 px-5 py-4 text-right transition-colors hover:bg-white/06 w-full group"
                  style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.07)' : 'none' }}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-none text-lg" style={{ background: 'rgba(255,255,255,0.07)' }}>
                    {AGENT_ICONS[agent.id] || DEFAULT_ICON}
                  </div>
                  <div className="flex-1 min-w-0 text-right">
                    <div className="font-semibold text-sm" style={{ color: 'white' }}>{agent.name}</div>
                    {agent.description && (
                      <div className="text-xs mt-0.5 leading-snug" style={{ color: 'rgba(255,255,255,0.38)' }}>{agent.description}</div>
                    )}
                  </div>
                </button>
              ))}
              {agents.length === 0 && (
                <div className="px-5 py-4 text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>טוען סוכנים...</div>
              )}
            </div>

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
            <div className="flex-none px-4 pb-5 pt-3">
              <div className="max-w-2xl mx-auto">
                <button type="button" onClick={() => setMobileHistoryOpen(true)}
                  className="md:hidden mb-2 flex-none rounded-xl px-3 py-2 transition-colors hover:bg-white/10"
                  style={{ color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <MessageSquare size={16} />
                </button>

                {/* Input box */}
                <div
                  onDrop={handleDrop}
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  style={{
                    border: `1px solid ${dragging ? 'rgb(var(--accent))' : 'rgba(var(--accent), 0.55)'}`,
                    borderRadius: 28,
                    background: 'rgba(255,255,255,0.05)',
                    padding: '14px 18px 12px',
                    transition: 'border-color 0.15s',
                  }}
                >
                  {/* File chips */}
                  {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3 max-h-24 overflow-y-auto">
                      {attachments.map((file, i) => (
                        <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs"
                          style={{ background: 'rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.65)', border: '1px solid rgba(255,255,255,0.1)' }}>
                          <Paperclip size={10} className="flex-none" />
                          <span className="max-w-[140px] truncate">{file.name}</span>
                          <button onClick={() => removeAttachment(i)}
                            className="flex-none hover:opacity-70 transition-opacity" style={{ color: 'rgba(255,255,255,0.4)' }}>
                            <XIcon size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Textarea */}
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => {
                      setInput(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="מה תרצו לשאול?"
                    disabled={loading}
                    rows={2}
                    dir="rtl"
                    className="w-full outline-none"
                    style={{
                      color: 'white',
                      fontSize: '17px',
                      lineHeight: 1.6,
                      resize: 'none',
                      overflow: 'hidden',
                      minHeight: '52px',
                      maxHeight: '140px',
                      display: 'block',
                      background: 'transparent',
                      border: 'none',
                      boxShadow: 'none',
                      WebkitAppearance: 'none',
                    }}
                  />

                  {/* Bottom action row */}
                  <div className="flex items-center justify-between mt-3">
                    {/* Paperclip — ימין */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center justify-center transition-opacity hover:opacity-70 focus:outline-none focus-visible:ring-2"
                      style={{ color: 'rgba(255,255,255,0.38)', width: 36, height: 36 }}
                      title="הוסף קובץ"
                    >
                      <Paperclip size={18} />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={e => { const files = Array.from(e.target.files); e.target.value = ''; setAttachments(prev => [...prev, ...files]); }}
                    />

                    {/* Send — שמאל */}
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={(!input.trim() && attachments.length === 0) || loading}
                      className="flex items-center justify-center rounded-full transition-all focus:outline-none focus-visible:ring-2 disabled:opacity-35"
                      style={{
                        width: 48, height: 48,
                        background: 'rgba(255,255,255,0.1)',
                        color: 'rgba(255,255,255,0.65)',
                      }}
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </div>

                {/* Disclaimer */}
                <p className="text-center mt-3.5" style={{ color: 'rgba(255,255,255,0.22)', fontSize: '13px' }}>
                  הסוכן עשוי לטעות. מומלץ לבדוק מידע חשוב.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
