'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Brain, Trash2, Sparkles } from '@/components/icons/lucide';
import { getAssistantResponse, type AssistantMessage } from '@/lib/ai/medical-assistant';

export default function AssistantChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const sendMessage = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const userMsg: AssistantMessage = {
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Simulate slight delay for natural feel
    setTimeout(() => {
      const { content, topic } = getAssistantResponse(trimmed);
      const assistantMsg: AssistantMessage = {
        role: 'assistant',
        content,
        topic,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMsg]);
      setIsTyping(false);
    }, 200 + Math.random() * 300);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  // Simple markdown-ish rendering for the assistant
  const renderContent = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];

    lines.forEach((line, i) => {
      if (line.startsWith('**') && line.endsWith('**')) {
        // Bold heading line
        elements.push(
          <p key={i} className="font-bold text-sm mt-2 mb-1" style={{ color: 'var(--text-primary)' }}>
            {line.replace(/\*\*/g, '')}
          </p>
        );
      } else if (line.startsWith('| ')) {
        // Table row — render as-is in monospace
        elements.push(
          <p key={i} className="font-mono text-[10px] leading-tight" style={{ color: 'var(--text-secondary)' }}>
            {line}
          </p>
        );
      } else if (line.startsWith('- ')) {
        // Bullet point
        elements.push(
          <p key={i} className="text-xs pl-3 py-0.5" style={{ color: 'var(--text-secondary)' }}>
            {renderInline(line)}
          </p>
        );
      } else if (line.match(/^\d+\.\s/)) {
        // Numbered list
        elements.push(
          <p key={i} className="text-xs pl-3 py-0.5" style={{ color: 'var(--text-secondary)' }}>
            {renderInline(line)}
          </p>
        );
      } else if (line === '---') {
        elements.push(<hr key={i} className="my-2" style={{ borderColor: 'var(--border-light)' }} />);
      } else if (line.trim() === '') {
        elements.push(<div key={i} className="h-1" />);
      } else {
        elements.push(
          <p key={i} className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {renderInline(line)}
          </p>
        );
      }
    });

    return elements;
  };

  // Inline bold/italic rendering
  const renderInline = (text: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let keyIndex = 0;

    while (remaining.length > 0) {
      // Bold
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      // Italic
      const italicMatch = remaining.match(/\*([^*]+?)\*/);

      const match = boldMatch && italicMatch
        ? (remaining.indexOf(boldMatch[0]) <= remaining.indexOf(italicMatch[0]) ? boldMatch : italicMatch)
        : boldMatch || italicMatch;

      if (match && match.index !== undefined) {
        if (match.index > 0) {
          parts.push(remaining.slice(0, match.index));
        }
        if (match[0].startsWith('**')) {
          parts.push(<strong key={keyIndex++} style={{ color: 'var(--text-primary)' }}>{match[1]}</strong>);
        } else {
          parts.push(<em key={keyIndex++} style={{ color: 'var(--text-muted)' }}>{match[1]}</em>);
        }
        remaining = remaining.slice(match.index + match[0].length);
      } else {
        parts.push(remaining);
        break;
      }
    }

    return parts;
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed z-50 flex items-center justify-center transition-all duration-300"
        style={{
          bottom: '24px',
          right: '24px',
          width: isOpen ? '44px' : '56px',
          height: isOpen ? '44px' : '56px',
          borderRadius: '50%',
          background: isOpen ? 'var(--text-muted)' : 'var(--accent-primary)',
          boxShadow: isOpen
            ? '0 4px 12px rgba(0,0,0,0.2)'
            : '0 4px 20px rgba(13,148,136,0.4), 0 0 40px rgba(13,148,136,0.15)',
          border: 'none',
          cursor: 'pointer',
          color: 'white',
        }}
        title="Clinical Assistant"
      >
        {isOpen ? (
          <X className="w-5 h-5" />
        ) : (
          <MessageCircle className="w-6 h-6" />
        )}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div
          className="fixed z-50 flex flex-col overflow-hidden animate-fadeInUp"
          style={{
            bottom: '80px',
            right: '24px',
            width: '420px',
            height: 'min(600px, calc(100vh - 120px))',
            borderRadius: '16px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.25), 0 0 40px rgba(13,148,136,0.08)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{
            background: 'linear-gradient(135deg, rgba(13,148,136,0.12), rgba(13,148,136,0.08))',
            borderBottom: '1px solid var(--border-light)',
          }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{
                background: 'var(--accent-primary)',
                boxShadow: '0 2px 8px rgba(13,148,136,0.3)',
              }}>
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Assistant
                </p>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  WHO/IMCI Clinical Guidance &middot; Offline
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  title="Clear chat"
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(229,46,66,0.1)'; e.currentTarget.style.color = '#F87171'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--overlay-subtle)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ scrollbarWidth: 'thin' }}>
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{
                  background: 'rgba(13,148,136,0.12)',
                  border: '1px solid rgba(13,148,136,0.15)',
                }}>
                  <Sparkles className="w-7 h-7" style={{ color: 'var(--accent-primary)' }} />
                </div>
                <p className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  Clinical Assistant
                </p>
                <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                  Ask me about treatment protocols, drug dosing, emergency management, or clinical guidelines.
                </p>
                <div className="grid grid-cols-2 gap-2 w-full">
                  {[
                    'Malaria treatment',
                    'DKA protocol',
                    'Pneumonia in children',
                    'Pre-eclampsia MgSO4',
                  ].map(q => (
                    <button
                      key={q}
                      onClick={() => {
                        setInput(q);
                        setTimeout(() => {
                          const userMsg: AssistantMessage = {
                            role: 'user',
                            content: q,
                            timestamp: new Date().toISOString(),
                          };
                          setMessages(prev => [...prev, userMsg]);
                          setIsTyping(true);
                          setTimeout(() => {
                            const { content, topic } = getAssistantResponse(q);
                            setMessages(prev => [...prev, {
                              role: 'assistant',
                              content,
                              topic,
                              timestamp: new Date().toISOString(),
                            }]);
                            setIsTyping(false);
                          }, 300);
                          setInput('');
                        }, 50);
                      }}
                      className="text-[11px] px-3 py-2 rounded-lg text-left transition-colors"
                      style={{
                        background: 'var(--overlay-subtle)',
                        border: '1px solid var(--border-light)',
                        color: 'var(--text-secondary)',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.color = 'var(--accent-primary)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[90%] rounded-xl px-3.5 py-2.5"
                  style={{
                    background: msg.role === 'user'
                      ? 'var(--accent-primary)'
                      : 'var(--overlay-subtle)',
                    border: msg.role === 'assistant' ? '1px solid var(--border-light)' : 'none',
                    color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                  }}
                >
                  {msg.role === 'user' ? (
                    <p className="text-sm">{msg.content}</p>
                  ) : (
                    <div>
                      {msg.topic && (
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Brain className="w-3 h-3" style={{ color: 'var(--accent-primary)' }} />
                          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent-primary)' }}>
                            {msg.topic}
                          </span>
                        </div>
                      )}
                      <div className="space-y-0">{renderContent(msg.content)}</div>
                    </div>
                  )}
                  <p className="text-[9px] mt-1.5" style={{ opacity: 0.5, textAlign: msg.role === 'user' ? 'right' : 'left' }}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start">
                <div className="rounded-xl px-4 py-3" style={{ background: 'var(--overlay-subtle)', border: '1px solid var(--border-light)' }}>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--accent-primary)', animationDelay: '0ms' }} />
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--accent-primary)', animationDelay: '150ms' }} />
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--accent-primary)', animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 flex-shrink-0" style={{ borderTop: '1px solid var(--border-light)' }}>
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a clinical question..."
                className="flex-1 text-sm rounded-xl px-4 py-2.5"
                style={{
                  background: 'var(--overlay-subtle)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-light)'; }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isTyping}
                className="flex items-center justify-center rounded-xl transition-all"
                style={{
                  width: '40px',
                  height: '40px',
                  background: input.trim() && !isTyping ? 'var(--accent-primary)' : 'var(--overlay-subtle)',
                  border: input.trim() && !isTyping ? 'none' : '1px solid var(--border-light)',
                  color: input.trim() && !isTyping ? 'white' : 'var(--text-muted)',
                  cursor: input.trim() && !isTyping ? 'pointer' : 'default',
                  flexShrink: 0,
                }}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[9px] text-center mt-2" style={{ color: 'var(--text-muted)' }}>
              Offline &middot; WHO/IMCI guidelines &middot; Not a substitute for clinical judgment
            </p>
          </div>
        </div>
      )}
    </>
  );
}
