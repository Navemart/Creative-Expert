import { useState, useEffect } from 'react';
import { useUser, useClerk } from '@clerk/clerk-react';
import { supabase } from '../lib/supabase.js';
import { User, Briefcase, MapPin, Globe, Instagram, Phone, Save, Check, Loader2, LogOut } from 'lucide-react';

const BUSINESS_TYPES = [
  'מיתוג וזהות מותגית','בניית אתרים','UX/UI Design',
  'עיצוב גרפי','שיווק דיגיטלי','צילום ווידאו',
  'סושיאל מדיה','תוכן ויצירה','אחר',
];

function SectionHeader({ icon: Icon, label, color = '#F5C118' }) {
  return (
    <div className="flex items-center gap-2.5 mb-5">
      <div className="h-8 w-8 rounded-xl flex items-center justify-center flex-none" style={{ background:`${color}18` }}>
        <Icon size={16} style={{ color }} />
      </div>
      <span className="text-sm font-bold text-white uppercase tracking-wider">{label}</span>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium" style={{ color:'rgba(255,255,255,0.82)' }}>{label}</label>
      {hint && <p className="text-[11px]" style={{ color:'rgba(255,255,255,0.3)' }}>{hint}</p>}
      {children}
    </div>
  );
}

const inp = {
  width:'100%', boxSizing:'border-box',
  background:'rgb(var(--bg-elevated))',
  border:'1px solid rgba(255,255,255,0.1)',
  borderRadius:10, padding:'10px 14px',
  fontSize:14, color:'rgba(255,255,255,0.9)',
  outline:'none', fontFamily:'inherit',
};

export default function Settings() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const userId   = user?.id;

  const [form, setForm] = useState({
    first_name:'', last_name:'', phone:'', city:'', bio:'',
    business_name:'', business_type:'', website:'', instagram:'',
  });
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  useEffect(() => {
    if (!user) return;
    setForm(f => ({ ...f, first_name: user.firstName||'', last_name: user.lastName||'' }));
  }, [user]);

  useEffect(() => {
    if (!userId) return;
    supabase.from('student_profiles').select('*').eq('user_id', userId).single()
      .then(({ data }) => {
        if (data) setForm(f => ({
          ...f,
          first_name:    data.first_name    || f.first_name,
          last_name:     data.last_name     || f.last_name,
          phone:         data.phone         || '',
          city:          data.city          || '',
          bio:           data.bio           || '',
          business_name: data.business_name || '',
          business_type: data.business_type || '',
          website:       data.website       || '',
          instagram:     data.instagram     || '',
        }));
      })
      .finally(() => setLoading(false));
  }, [userId]);

  async function save() {
    if (!userId) return;
    setSaving(true);
    await supabase.from('student_profiles').upsert({
      user_id:       userId,
      first_name:    form.first_name.trim(),
      last_name:     form.last_name.trim(),
      email:         user?.primaryEmailAddress?.emailAddress || '',
      phone:         form.phone.trim()         || null,
      city:          form.city.trim()          || null,
      bio:           form.bio.trim()           || null,
      business_name: form.business_name.trim() || null,
      business_type: form.business_type        || null,
      website:       form.website.trim()       || null,
      instagram:     form.instagram.trim()     || null,
      updated_at:    new Date().toISOString(),
    }, { onConflict:'user_id' });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }));

  if (loading) return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 size={24} className="animate-spin" style={{ color:'rgba(255,255,255,0.2)' }} />
    </div>
  );

  const displayName = [form.first_name, form.last_name].filter(Boolean).join(' ') || 'השם שלך';
  const initial = (form.first_name || user?.firstName || '?')[0].toUpperCase();

  return (
    <div className="w-full max-w-2xl mx-auto space-y-5 pb-10" dir="rtl">

      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white">פרופיל</h1>
        <p className="text-sm mt-1" style={{ color:'rgba(255,255,255,0.4)' }}>פרטים אישיים ועסקיים</p>
      </div>

      {/* Preview card */}
      <div className="flex items-center gap-4 p-5 rounded-2xl"
        style={{ background:'rgb(var(--bg-surface))', border:'1px solid rgba(255,255,255,0.07)' }}>
        <div className="h-14 w-14 rounded-full flex-none flex items-center justify-center text-xl font-black"
          style={{ background:'rgba(245,193,24,0.15)', color:'#F5C118', border:'2px solid rgba(245,193,24,0.3)' }}>
          {initial}
        </div>
        <div>
          <p className="font-bold text-white">{displayName}</p>
          <p className="text-sm mt-0.5" style={{ color:'rgba(255,255,255,0.4)' }}>
            {[form.business_type, form.business_name].filter(Boolean).join(' · ') || 'פרטי העסק'}
          </p>
          <p className="text-xs mt-0.5" style={{ color:'rgba(255,255,255,0.28)' }}>
            {user?.primaryEmailAddress?.emailAddress}
          </p>
        </div>
      </div>

      {/* Personal */}
      <div className="rounded-2xl p-5" style={{ background:'rgb(var(--bg-surface))', border:'1px solid rgba(255,255,255,0.07)' }}>
        <SectionHeader icon={User} label="פרטים אישיים" color="#4fc38a" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="שם פרטי">
            <input style={inp} value={form.first_name} onChange={set('first_name')} placeholder="השם הפרטי" />
          </Field>
          <Field label="שם משפחה">
            <input style={inp} value={form.last_name} onChange={set('last_name')} placeholder="שם משפחה" />
          </Field>
          <Field label="טלפון">
            <div style={{ position:'relative' }}>
              <Phone size={13} style={{ position:'absolute', top:'50%', right:12, transform:'translateY(-50%)', color:'rgba(255,255,255,0.3)', pointerEvents:'none' }} />
              <input style={{ ...inp, paddingRight:36 }} value={form.phone} onChange={set('phone')} placeholder="050-0000000" type="tel" dir="ltr" />
            </div>
          </Field>
          <Field label="עיר">
            <div style={{ position:'relative' }}>
              <MapPin size={13} style={{ position:'absolute', top:'50%', right:12, transform:'translateY(-50%)', color:'rgba(255,255,255,0.3)', pointerEvents:'none' }} />
              <input style={{ ...inp, paddingRight:36 }} value={form.city} onChange={set('city')} placeholder="תל אביב" />
            </div>
          </Field>
        </div>
        <div className="mt-4">
          <Field label="קצת עליך" hint="ספר מי אתה ומה אתה עושה">
            <textarea value={form.bio} onChange={set('bio')} placeholder="מעצב עם 5 שנות ניסיון, מתמחה ב..." rows={3}
              style={{ ...inp, resize:'vertical', lineHeight:1.6 }} />
          </Field>
        </div>
      </div>

      {/* Business */}
      <div className="rounded-2xl p-5" style={{ background:'rgb(var(--bg-surface))', border:'1px solid rgba(255,255,255,0.07)' }}>
        <SectionHeader icon={Briefcase} label="פרטי העסק" color="#818cf8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="שם העסק / מותג">
            <input style={inp} value={form.business_name} onChange={set('business_name')} placeholder="Studio / Freelancer Name" />
          </Field>
          <Field label="תחום עיסוק">
            <select value={form.business_type} onChange={set('business_type')} style={{ ...inp, cursor:'pointer' }}>
              <option value="">בחר תחום...</option>
              {BUSINESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="אתר אינטרנט">
            <div style={{ position:'relative' }}>
              <Globe size={13} style={{ position:'absolute', top:'50%', right:12, transform:'translateY(-50%)', color:'rgba(255,255,255,0.3)', pointerEvents:'none' }} />
              <input style={{ ...inp, paddingRight:36 }} value={form.website} onChange={set('website')} placeholder="www.yoursite.com" dir="ltr" />
            </div>
          </Field>
          <Field label="אינסטגרם">
            <div style={{ position:'relative' }}>
              <Instagram size={13} style={{ position:'absolute', top:'50%', right:12, transform:'translateY(-50%)', color:'rgba(255,255,255,0.3)', pointerEvents:'none' }} />
              <input style={{ ...inp, paddingRight:36 }} value={form.instagram} onChange={set('instagram')} placeholder="@yourhandle" dir="ltr" />
            </div>
          </Field>
        </div>
      </div>

      {/* Save */}
      <button onClick={save} disabled={saving}
        className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold transition hover:opacity-90 disabled:opacity-50"
        style={{ background:'#F5C118', color:'#13152A' }}>
        {saving  ? <><Loader2 size={16} className="animate-spin" /> שומר...</>
        : saved   ? <><Check size={16} /> נשמר בהצלחה! ✓</>
        :            <><Save size={16} /> שמור פרופיל</>}
      </button>

      {/* Sign out */}
      <button onClick={() => signOut({ redirectUrl: '/' })}
        className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition hover:bg-white/[0.06]"
        style={{ color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <LogOut size={15} /> התנתקות
      </button>

    </div>
  );
}
