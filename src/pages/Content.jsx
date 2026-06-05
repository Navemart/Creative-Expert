import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useSearchParams } from 'react-router-dom';
import {
  Instagram, Users, Eye, Heart, TrendingUp,
  RefreshCw, LogOut, ExternalLink, MessageCircle, AlertCircle,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';

// ── tiny helpers ──────────────────────────────────────────────
const fmt  = n => n == null ? '—' : Number(n).toLocaleString('he-IL');
const fmtK = n => {
  if (n == null) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1)     + 'K';
  return String(n);
};
const heDate = d =>
  new Date(d).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });

// ── connect screen ────────────────────────────────────────────
function ConnectScreen({ userId, error }) {
  const connectUrl = `/api/instagram/connect?userId=${userId}`;
  return (
    <div className="w-full flex flex-col items-center justify-center py-24 gap-8" dir="rtl">
      {/* icon */}
      <div
        className="h-20 w-20 rounded-2xl flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)' }}
      >
        <Instagram size={40} color="white" />
      </div>

      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-white">חבר את האינסטגרם שלך</h2>
        <p className="text-sm max-w-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
          חבר חשבון Business או Creator כדי לראות עוקבים, reach, פוסטים
          ועוד — הכל בזמן אמת.
        </p>
      </div>

      {error && (
        <div
          className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
          style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}
        >
          <AlertCircle size={15} />
          החיבור נכשל — נסה שוב
        </div>
      )}

      <a
        href={connectUrl}
        className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
        style={{ background: 'linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)' }}
      >
        <Instagram size={17} />
        חבר חשבון אינסטגרם
      </a>

      <p className="text-xs text-center max-w-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
        נדרש חשבון Business או Creator.
        הנתונים לא נשמרים אצל גורם שלישי — רק ב-Supabase שלך.
      </p>
    </div>
  );
}

// ── stat card ─────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color = '#F5C118', delta }) {
  const isPos = delta > 0;
  const isNeg = delta < 0;
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3"
      style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div className="flex items-center justify-between">
        <div
          className="h-9 w-9 rounded-xl flex items-center justify-center flex-none"
          style={{ background: color + '1a', color }}
        >
          {icon}
        </div>
        {delta != null && (
          <span
            className="text-xs font-semibold rounded-full px-2 py-0.5"
            style={{
              background: isPos ? 'rgba(74,222,128,0.12)' : isNeg ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.07)',
              color:      isPos ? '#4ade80' : isNeg ? '#ef4444' : 'rgba(255,255,255,0.4)',
            }}
          >
            {isPos ? '+' : ''}{fmt(delta)}
          </span>
        )}
      </div>
      <div>
        <div className="text-2xl font-bold text-white leading-none">{value}</div>
        <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</div>
        {sub && <div className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>{sub}</div>}
      </div>
    </div>
  );
}

// ── custom tooltip for follower chart ─────────────────────────
function FollowerTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-3 py-2 text-xs"
      style={{ background: 'rgb(19,21,40)', border: '1px solid rgba(255,255,255,0.12)', color: 'white' }}
    >
      <div style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</div>
      <div className="font-bold mt-0.5">{fmt(payload[0]?.value)} עוקבים</div>
    </div>
  );
}

// ── post thumbnail ────────────────────────────────────────────
function PostCard({ post }) {
  const src = post.media_type === 'VIDEO' ? post.thumbnail_url : post.media_url;
  return (
    <a
      href={post.permalink}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative aspect-square rounded-xl overflow-hidden block"
      style={{ background: 'rgb(var(--bg-elevated))' }}
    >
      {src && (
        <img
          src={src}
          alt={post.caption?.slice(0, 40) || ''}
          className="w-full h-full object-cover transition group-hover:scale-105 duration-300"
        />
      )}
      {/* video badge */}
      {post.media_type === 'VIDEO' && (
        <div className="absolute top-1.5 right-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white"
          style={{ background: 'rgba(0,0,0,0.55)' }}>
          ▶
        </div>
      )}
      {/* overlay on hover */}
      <div className="absolute inset-0 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition"
        style={{ background: 'rgba(0,0,0,0.55)' }}>
        <span className="flex items-center gap-1 text-white text-xs font-semibold">
          <Heart size={12} fill="white" /> {fmtK(post.like_count)}
        </span>
        <span className="flex items-center gap-1 text-white text-xs font-semibold">
          <MessageCircle size={12} fill="white" /> {fmtK(post.comments_count)}
        </span>
        {post.reach != null && (
          <span className="flex items-center gap-1 text-white text-xs font-semibold">
            <Eye size={12} /> {fmtK(post.reach)}
          </span>
        )}
      </div>
    </a>
  );
}

// ── period pills ──────────────────────────────────────────────
function PeriodPicker({ value, onChange }) {
  return (
    <div className="flex gap-1 rounded-lg p-1 flex-none" style={{ background: 'rgb(var(--bg-elevated))' }}>
      {['7D', '28D', '90D'].map(p => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className="rounded-md px-3 py-1 text-xs font-semibold transition"
          style={{
            background: value === p ? 'rgba(255,255,255,0.15)' : 'transparent',
            color:      value === p ? 'white' : 'rgba(255,255,255,0.35)',
          }}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

// ── main dashboard ────────────────────────────────────────────
const POST_PERIODS = [
  { key: 'all', label: 'הכל'      },
  { key: '7',   label: '7 ימים'   },
  { key: '30',  label: '30 ימים'  },
  { key: '90',  label: '90 ימים'  },
  { key: '120', label: '120 ימים' },
];

function InstagramDashboard({ userId, profile, media, insights, onDisconnect, onRefresh, refreshing }) {
  const [period,       setPeriod]       = useState('28D');
  const [sortBy,       setSortBy]       = useState('recent');
  const [postPeriod,   setPostPeriod]   = useState('all');
  const [reachMap,     setReachMap]     = useState(null);   // null=not loaded, {}=loaded/unavailable
  const [reachLoading, setReachLoading] = useState(false);

  // Lazy-load per-post reach only when user selects "views" sort
  useEffect(() => {
    if (sortBy !== 'views' || reachMap !== null || media.length === 0) return;
    setReachLoading(true);
    const ids = media.map(p => p.id).join(',');
    fetch(`/api/instagram/media-reach?userId=${userId}&ids=${ids}`)
      .then(r => r.json())
      .then(d => setReachMap(d.available ? d.reachMap : {}))
      .catch(() => setReachMap({}))
      .finally(() => setReachLoading(false));
  }, [sortBy, userId, media]); // eslint-disable-line

  // Compute follower timeline based on selected period
  const periodDays = { '7D': 7, '28D': 28, '90D': 90 };
  const timeline = (insights?.followerTimeline || [])
    .slice(-(periodDays[period]))
    .map(v => ({
      date:      heDate(v.end_time),
      followers: v.value,
    }));

  // Merge reach data into media
  const mediaWithReach = reachMap
    ? media.map(p => ({ ...p, reach: reachMap[p.id] ?? null }))
    : media;

  // Filter by post period
  const now = Date.now();
  const filteredMedia = postPeriod === 'all'
    ? mediaWithReach
    : mediaWithReach.filter(p => new Date(p.timestamp).getTime() >= now - Number(postPeriod) * 86_400_000);

  // Sort
  const sortedMedia = [...filteredMedia].sort((a, b) => {
    if (sortBy === 'likes')      return (b.like_count      || 0) - (a.like_count      || 0);
    if (sortBy === 'comments')   return (b.comments_count  || 0) - (a.comments_count  || 0);
    if (sortBy === 'engagement') return ((b.like_count || 0) + (b.comments_count || 0)) - ((a.like_count || 0) + (a.comments_count || 0));
    if (sortBy === 'views')      return (b.reach           || 0) - (a.reach           || 0);
    return 0; // recent — keep API order
  });

  // Derived from media
  const totalComments = media.reduce((s, p) => s + (p.comments_count || 0), 0);
  const avgComments   = media.length ? Math.round(totalComments / media.length) : null;

  const totalLikes = media.reduce((s, p) => s + (p.like_count || 0), 0);
  const avgLikes   = media.length ? Math.round(totalLikes / media.length) : null;

  // Follower delta (first → last in timeline)
  const followerDelta = timeline.length >= 2
    ? timeline[timeline.length - 1].followers - timeline[0].followers
    : null;

  return (
    <div className="w-full space-y-6" dir="rtl">

      {/* ── Profile header ── */}
      <div
        className="rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5"
        style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* Avatar */}
        {profile?.profile_picture_url ? (
          <img
            src={profile.profile_picture_url}
            alt={profile.username}
            className="h-16 w-16 rounded-full object-cover flex-none ring-2"
            style={{ ringColor: 'rgba(255,255,255,0.15)' }}
          />
        ) : (
          <div
            className="h-16 w-16 rounded-full flex items-center justify-center flex-none"
            style={{ background: 'linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)' }}
          >
            <Instagram size={28} color="white" />
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg font-bold text-white">@{profile?.username || '—'}</span>
            <a
              href={`https://instagram.com/${profile?.username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded-md hover:bg-white/10 transition"
              style={{ color: 'rgba(255,255,255,0.4)' }}
            >
              <ExternalLink size={13} />
            </a>
          </div>
          {profile?.biography && (
            <p className="text-sm mt-1 line-clamp-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {profile.biography}
            </p>
          )}
        </div>

        {/* Big numbers */}
        <div className="flex gap-6 flex-none text-center">
          <div>
            <div className="text-2xl font-bold text-white">{fmtK(profile?.followers_count)}</div>
            <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>עוקבים</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{fmtK(profile?.media_count)}</div>
            <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>פוסטים</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-none">
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="rounded-lg p-2 hover:bg-white/10 transition"
            style={{ color: 'rgba(255,255,255,0.5)' }}
            title="רענן נתונים"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={onDisconnect}
            className="rounded-lg p-2 hover:bg-white/10 transition"
            style={{ color: 'rgba(255,255,255,0.35)' }}
            title="נתק חשבון"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={<Users size={17} />}
          label="עוקבים"
          value={fmtK(profile?.followers_count)}
          delta={followerDelta}
          color="#833ab4"
        />
        <StatCard
          icon={<Eye size={17} />}
          label="Reach (28 יום)"
          value={insights?.insightsAvailable ? fmtK(insights.reach) : '—'}
          sub={insights?.insightsAvailable ? undefined : 'נדרש אישור Meta'}
          color="#06b6d4"
        />
        <StatCard
          icon={<Heart size={17} />}
          label="ממוצע לייקים"
          value={avgLikes != null ? fmtK(avgLikes) : '—'}
          sub={`מתוך ${media.length} פוסטים אחרונים`}
          color="#ef4444"
        />
        <StatCard
          icon={<MessageCircle size={17} />}
          label="ממוצע תגובות"
          value={avgComments != null ? fmtK(avgComments) : '—'}
          sub={`מתוך ${media.length} פוסטים אחרונים`}
          color="#f97316"
        />
      </div>

      {/* ── Followers over time ── */}
      <div
        className="rounded-2xl p-6"
        style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
              עוקבים לאורך זמן
            </div>
            {followerDelta != null && (
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-white">{fmt(profile?.followers_count)}</span>
                <span
                  className="text-sm font-semibold"
                  style={{ color: followerDelta >= 0 ? '#4ade80' : '#ef4444' }}
                >
                  {followerDelta >= 0 ? '+' : ''}{fmt(followerDelta)} ב-{period}
                </span>
              </div>
            )}
          </div>
          <PeriodPicker value={period} onChange={setPeriod} />
        </div>

        {timeline.length > 0 ? (
          <div dir="ltr">
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={timeline} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="igGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#833ab4" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#833ab4" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }}
                  axisLine={false} tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }}
                  axisLine={false} tickLine={false}
                  tickFormatter={fmtK}
                  width={48}
                  domain={['auto', 'auto']}
                />
                <Tooltip content={<FollowerTip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }} />
                <Area
                  type="monotone"
                  dataKey="followers"
                  stroke="#833ab4"
                  strokeWidth={2.5}
                  fill="url(#igGrad)"
                  dot={false}
                  activeDot={{ r: 5, fill: '#833ab4', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div
            className="h-44 rounded-xl flex flex-col items-center justify-center gap-2 text-sm"
            style={{ background: 'rgb(var(--bg-elevated))' }}
          >
            {insights?.insightsAvailable === false ? (
              <>
                <TrendingUp size={24} style={{ color: 'rgba(255,255,255,0.2)' }} />
                <span style={{ color: 'rgba(255,255,255,0.3)' }}>גרף עוקבים מצריך אישור</span>
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  instagram_business_manage_insights — שלח ל-Meta לאישור
                </span>
              </>
            ) : (
              <>
                <TrendingUp size={24} style={{ color: 'rgba(255,255,255,0.2)' }} />
                <span style={{ color: 'rgba(255,255,255,0.3)' }}>אין עדיין נתוני עוקבים</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Recent posts ── */}
      {media.length > 0 && (
        <div
          className="rounded-2xl p-6"
          style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            {/* Right: title + period pills */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
                פוסטים אחרונים
              </div>
              <div className="flex gap-1">
                {POST_PERIODS.map(p => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPostPeriod(p.key)}
                    className="rounded-md px-2.5 py-1 text-xs font-semibold transition"
                    style={{
                      background: postPeriod === p.key ? 'rgba(255,255,255,0.12)' : 'transparent',
                      color:      postPeriod === p.key ? 'white' : 'rgba(255,255,255,0.35)',
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Left: sort dropdown + see-all */}
            <div className="flex items-center gap-2">
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold outline-none cursor-pointer"
                style={{
                  background: 'rgb(var(--bg-elevated))',
                  color: 'rgba(255,255,255,0.7)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <option value="recent">אחרונים</option>
                <option value="likes">הכי הרבה לייקים</option>
                <option value="comments">הכי הרבה תגובות</option>
                <option value="engagement">הכי הרבה מעורבות</option>
                <option value="views">הכי הרבה צפיות</option>
              </select>
              <a
                href={`https://instagram.com/${profile?.username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs flex items-center gap-1 hover:opacity-80 transition"
                style={{ color: 'rgba(255,255,255,0.35)' }}
              >
                ראה הכל <ExternalLink size={11} />
              </a>
            </div>
          </div>
          {sortBy === 'views' && reachLoading && (
            <p className="text-xs mb-3 flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
              <RefreshCw size={11} className="animate-spin" /> טוען נתוני reach...
            </p>
          )}
          {sortBy === 'views' && !reachLoading && reachMap && Object.keys(reachMap).length === 0 && (
            <p className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Reach לפי פוסט מצריך אישור Meta — ממוין לפי מעורבות בינתיים
            </p>
          )}
          {sortedMedia.length > 0 ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {sortedMedia.map(post => <PostCard key={post.id} post={post} />)}
            </div>
          ) : (
            <div className="text-center py-8 text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
              אין פוסטים בפילטר הנוכחי
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ── root component ────────────────────────────────────────────
export default function Content() {
  const { user }     = useUser();
  const userId       = user?.id;
  const [searchParams, setSearchParams] = useSearchParams();

  const [state,      setState]      = useState('loading'); // loading | connected | disconnected
  const [profile,    setProfile]    = useState(null);
  const [media,      setMedia]      = useState([]);
  const [insights,   setInsights]   = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [oauthError, setOauthError] = useState(false);

  // Handle redirect from Instagram OAuth callback
  useEffect(() => {
    const ig = searchParams.get('ig');
    if (ig === 'error') setOauthError(true);
    if (ig) setSearchParams({});
  }, []); // eslint-disable-line

  const loadAll = useCallback(async () => {
    if (!userId) return;
    setRefreshing(true);
    try {
      const [profileRes, mediaRes, insightsRes] = await Promise.all([
        fetch(`/api/instagram/profile?userId=${userId}`),
        fetch(`/api/instagram/media?userId=${userId}&limit=100`),
        fetch(`/api/instagram/insights?userId=${userId}&days=90`),
      ]);
      const [pd, md, id] = await Promise.all([profileRes.json(), mediaRes.json(), insightsRes.json()]);

      if (!pd.connected) { setState('disconnected'); return; }

      setProfile(pd.profile  || null);
      setMedia(md.data       || []);
      setInsights(id         || null);
      setState('connected');
    } finally {
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      // Quick status check first (no API call to Instagram)
      const r    = await fetch(`/api/instagram/status?userId=${userId}`);
      const data = await r.json();
      if (data.connected) {
        setState('connected');
        loadAll();
      } else {
        setState('disconnected');
      }
    })();
  }, [userId]); // eslint-disable-line

  async function handleDisconnect() {
    await fetch(`/api/instagram/disconnect?userId=${userId}`, { method: 'DELETE' });
    setState('disconnected');
    setProfile(null);
    setMedia([]);
    setInsights(null);
  }

  if (state === 'loading') {
    return (
      <div className="w-full space-y-4" dir="rtl">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: 'rgb(var(--bg-surface))' }} />
        ))}
      </div>
    );
  }

  if (state === 'disconnected') {
    return <ConnectScreen userId={userId} error={oauthError} />;
  }

  return (
    <InstagramDashboard
      userId={userId}
      profile={profile}
      media={media}
      insights={insights}
      onDisconnect={handleDisconnect}
      onRefresh={loadAll}
      refreshing={refreshing}
    />
  );
}
