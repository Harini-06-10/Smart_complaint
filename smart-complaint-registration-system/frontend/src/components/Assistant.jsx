import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

const START = {
  from: 'bot',
  text: 'Hi! I am the Civic Assistant. Ask me to track a complaint (e.g. "track CMP-2026-000012"), how to report a problem, or how long a fix takes.',
  suggestions: ['How do I report a pothole?', 'How long will it take?', 'How do points work?'],
};

/** Renders **bold** from the bot safely (no HTML injection). */
function Rich({ text }) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>));
}

/** v3: floating chatbot available on every page. */
export default function Assistant() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([START]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [msgs, open]);

  const ask = async (q) => {
    const message = (q ?? text).trim();
    if (!message || busy) return;
    setText('');
    setMsgs((m) => [...m, { from: 'me', text: message }]);
    setBusy(true);
    try {
      const { data } = await api.post('/assistant', { message });
      setMsgs((m) => [...m, { from: 'bot', text: data.reply, links: data.links, suggestions: data.suggestions }]);
    } catch {
      setMsgs((m) => [...m, { from: 'bot', text: 'I cannot reach the server right now. Please try again.' }]);
    } finally { setBusy(false); }
  };

  return (
    <div className="bot">
      {open && (
        <section className="bot-panel" aria-label="Civic Assistant chat">
          <header>
            <strong>Civic Assistant</strong>
            <button onClick={() => setOpen(false)} aria-label="Close chat">✕</button>
          </header>
          <ul className="bot-msgs">
            {msgs.map((m, i) => (
              <li key={i} className={`bot-msg bot-${m.from}`}>
                <p><Rich text={m.text} /></p>
                {m.links?.map((l) => <Link key={l.to} to={l.to} onClick={() => setOpen(false)}>{l.label} →</Link>)}
                {m.suggestions && (
                  <div className="bot-sugg">
                    {m.suggestions.map((s) => <button key={s} onClick={() => ask(s)}>{s}</button>)}
                  </div>
                )}
              </li>
            ))}
            {busy && <li className="bot-msg bot-bot"><p className="muted">Typing…</p></li>}
            <li ref={endRef} />
          </ul>
          <form onSubmit={(e) => { e.preventDefault(); ask(); }}>
            <label htmlFor="bot-input" className="sr-only">Ask a question</label>
            <input id="bot-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask anything…" maxLength={300} autoComplete="off" />
            <button className="btn btn-accent btn-sm" disabled={busy || !text.trim()}>Send</button>
          </form>
        </section>
      )}
      <button className="bot-fab" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Open Civic Assistant">
        {open ? '✕' : '💬'}
      </button>
    </div>
  );
}
