import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { Download, ArrowRight, Tag, Edit2 } from 'lucide-react';
import AgentSkills from './AgentSkills.jsx'; // reuse dialog via navigate-back pattern

const ADMIN_ID = import.meta.env.VITE_ADMIN_USER_ID;

export default function AgentSkillDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useUser();
  const isAdmin = user?.id === ADMIN_ID;

  const [skill, setSkill] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/skills/${id}`)
      .then(r => r.json())
      .then(d => { setSkill(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  async function handleDownload() {
    if (!skill) return;
    await fetch(`/api/skills/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ download_count: (skill.download_count || 0) + 1 }),
    });
    setSkill(s => ({ ...s, download_count: (s.download_count || 0) + 1 }));
  }

  if (loading) {
    return (
      <div className="p-6 text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>
        טוען...
      </div>
    );
  }

  if (!skill || skill.error) {
    return (
      <div className="p-6 text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>
        סקיל לא נמצא
        <br />
        <button onClick={() => navigate('/skills')} className="btn-primary mt-4 px-4 py-2 text-sm">
          חזור לסקילים
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto" dir="rtl">
      {/* Back */}
      <button
        onClick={() => navigate('/skills')}
        className="flex items-center gap-1.5 mb-6 text-sm transition-opacity hover:opacity-70"
        style={{ color: 'rgba(255,255,255,0.5)' }}
      >
        <ArrowRight size={14} /> חזרה לסקילים
      </button>

      {/* Title */}
      <div className="mb-6">
        <h1 className="text-3xl font-black mb-2" style={{ color: 'white' }}>{skill.title}</h1>
        <p className="text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
          {skill.description}
        </p>
      </div>

      {/* Meta */}
      <div
        className="rounded-2xl p-4 mb-6 flex flex-wrap items-center gap-4"
        style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: 'rgba(245,193,24,0.2)', color: 'rgb(var(--accent))' }}
          >
            {skill.author?.[0] || 'N'}
          </div>
          <span className="text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>{skill.author}</span>
        </div>

        <div className="flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
          <Download size={13} />
          <span className="text-sm">{skill.download_count || 0} הורדות</span>
        </div>

        {skill.tags?.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Tag size={13} style={{ color: 'rgba(255,255,255,0.3)' }} />
            {skill.tags.map(t => (
              <span
                key={t}
                className="px-2 py-0.5 rounded-md text-xs"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)' }}
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Full content */}
      {skill.full_content && (
        <div
          className="rounded-2xl p-6 mb-6 prose prose-invert prose-sm max-w-none"
          style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans" style={{ color: 'rgba(255,255,255,0.75)' }}>
            {skill.full_content}
          </pre>
        </div>
      )}

      {/* Download */}
      {skill.file_url && (
        <a
          href={skill.file_url}
          target="_blank"
          rel="noreferrer"
          onClick={handleDownload}
          className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold"
        >
          <Download size={15} /> הורד סקיל
        </a>
      )}
    </div>
  );
}
