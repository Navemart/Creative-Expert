import { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import {
  Instagram, Users, Heart, TrendingUp,
  RefreshCw, LogOut, ExternalLink, MessageCircle, AlertCircle,
  Video, Image, Layers,
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
  { key: 'all', label: 'הכל'       },
  { key: '30',  label: 'חודש אחרון' },
  { key: '90',  label: '3 חודשים'  },
  { key: '180', label: 'חצי שנה'   },
  { key: '365', label: 'שנה'       },
];

const SORT_OPTIONS = [
  { key: 'recent',     label: 'אחרונים'    },
  { key: 'engagement', label: 'מעורבות'    },
  { key: 'views',      label: 'חשיפה'      },
  { key: 'likes',      label: 'צפיות'      },
];

const PAGE_SIZE = 25;

function InstagramDashboard({ userId, profile, media, insights, onDisconnect, onRefresh, refreshing }) {
  const [period,       setPeriod]       = useState('28D');
  const [sortBy,       setSortBy]       = useState('recent');
  const [postPeriod,   setPostPeriod]   = useState('all');
  const [postPage,     setPostPage]     = useState(0);
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

  // Pagination
  const totalPages  = Math.ceil(sortedMedia.length / PAGE_SIZE);
  const pagedMedia  = sortedMedia.slice(postPage * PAGE_SIZE, (postPage + 1) * PAGE_SIZE);

  function changeFilter(newPeriod, newSort) {
    if (newPeriod !== undefined) setPostPeriod(newPeriod);
    if (newSort   !== undefined) setSortBy(newSort);
    setPostPage(0);
  }

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
          {/* Toolbar: period + sort */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>תקופה</span>
              <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
                {POST_PERIODS.map(p => (
                  <button key={p.key} type="button" onClick={() => changeFilter(p.key, undefined)}
                    className="rounded-lg px-3 py-1 text-xs font-semibold transition whitespace-nowrap"
                    style={{ background: postPeriod === p.key ? 'rgba(255,255,255,0.14)' : 'transparent', color: postPeriod === p.key ? 'white' : 'rgba(255,255,255,0.35)' }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>מיון</span>
              <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
                {SORT_OPTIONS.map(s => (
                  <button key={s.key} type="button" onClick={() => changeFilter(undefined, s.key)}
                    className="rounded-lg px-3 py-1 text-xs font-semibold transition whitespace-nowrap"
                    style={{ background: sortBy === s.key ? 'rgba(255,255,255,0.14)' : 'transparent', color: sortBy === s.key ? 'white' : 'rgba(255,255,255,0.35)' }}>
                    {s.label}
                  </button>
                ))}
              </div>
              <a href={`https://instagram.com/${profile?.username}`} target="_blank" rel="noopener noreferrer"
                className="text-xs flex items-center gap-1 hover:opacity-80 transition"
                style={{ color: 'rgba(255,255,255,0.3)' }}>
                <ExternalLink size={11} />
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

          {pagedMedia.length > 0 ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {pagedMedia.map(post => <PostCard key={post.id} post={post} />)}
            </div>
          ) : (
            <div className="text-center py-8 text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
              אין פוסטים בפילטר הנוכחי
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button
                disabled={postPage === 0}
                onClick={() => setPostPage(p => p - 1)}
                className="rounded-lg px-4 py-1.5 text-xs font-semibold transition disabled:opacity-30"
                style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
                ← הקודם
              </button>
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                עמוד {postPage + 1} מתוך {totalPages} · {sortedMedia.length} פוסטים
              </span>
              <button
                disabled={postPage >= totalPages - 1}
                onClick={() => setPostPage(p => p + 1)}
                className="rounded-lg px-4 py-1.5 text-xs font-semibold transition disabled:opacity-30"
                style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
                הבא →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ── Apify connect screen ──────────────────────────────────────
function ApifyConnectScreen({ onConnect, loading, error }) {
  const [username, setUsername] = useState('');
  return (
    <div className="w-full flex flex-col items-center justify-center py-24 gap-8" dir="rtl">
      <div className="h-20 w-20 rounded-2xl flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)' }}>
        <Instagram size={40} color="white" />
      </div>
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-white">חבר את האינסטגרם שלך</h2>
        <p className="text-sm max-w-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
          הכנס את שם המשתמש שלך באינסטגרם ונביא את הנתונים שלך.
        </p>
      </div>
      {error && (
        <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
          style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>
          <AlertCircle size={15} />
          {error}
        </div>
      )}
      <div className="flex items-center gap-2 w-full max-w-sm">
        <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>@</span>
        <input
          value={username}
          onChange={e => setUsername(e.target.value.replace('@', '').trim())}
          onKeyDown={e => e.key === 'Enter' && username && onConnect(username)}
          placeholder="שם_משתמש"
          dir="ltr"
          className="flex-1 rounded-xl px-4 py-3 text-sm text-white outline-none"
          style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.15)' }}
        />
        <button
          onClick={() => username && onConnect(username)}
          disabled={!username || loading}
          className="rounded-xl px-5 py-3 text-sm font-bold transition hover:opacity-90 disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)', color: 'white' }}
        >
          {loading ? <RefreshCw size={15} className="animate-spin" /> : 'חבר'}
        </button>
      </div>
      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
        ניתן להשתמש בפרופיל ציבורי בלבד
      </p>
    </div>
  );
}

// ── helpers ────────────────────────────────────────────────────
const TYPE_LABEL = { Video: 'וידאו', Sidecar: 'קרוסלה', Image: 'תמונה' };
const TYPE_COLOR = { Video: '#818cf8', Sidecar: '#34d399', Image: '#f472b6' };
function TypeIcon({ type, size = 11 }) {
  if (type === 'Video')   return <Video   size={size} />;
  if (type === 'Sidecar') return <Layers  size={size} />;
  return <Image size={size} />;
}
function engPct(post) {
  if (!post.views && post.views !== 0) return null; // image/carousel – no views
  const total = (post.likes || 0) + (post.comments || 0);
  const denom = post.views || post.likes || 1;
  return (total / denom * 100).toFixed(1);
}

// ── unified metric chart ──────────────────────────────────────
const METRICS = [
  { key: 'followers',      label: 'עוקבים',   color: '#833ab4', fmt: fmtK },
  { key: 'avg_views',      label: 'חשיפה',     color: '#06b6d4', fmt: fmtK },
  { key: 'avg_engagement', label: 'מעורבות',   color: '#f97316', fmt: v => `${v}%` },
];
const RANGES = [
  { key: '3m',  label: '3 חודשים', months: 3  },
  { key: '6m',  label: 'חצי שנה',  months: 6  },
  { key: '1y',  label: 'שנה',       months: 12 },
  { key: 'all', label: 'הכל',       months: null },
];

// build monthly chart from posts array (views / engagement)
function buildMonthlyFromPosts(posts, metricKey) {
  const byMonth = {};
  posts.forEach(p => {
    if (!p.timestamp) return;
    const d = new Date(p.timestamp);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    if (!byMonth[key]) byMonth[key] = { views: [], eng: [] };
    if (p.views > 0) byMonth[key].views.push(p.views);
    const denom = p.views || p.likes || 1;
    byMonth[key].eng.push((p.likes + p.comments) / denom * 100);
  });
  return Object.entries(byMonth)
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([key, v]) => {
      const [yr, mo] = key.split('-');
      const date = new Date(Number(yr), Number(mo)-1).toLocaleDateString('he-IL', { month: 'short', year: '2-digit' });
      const value = metricKey === 'avg_views'
        ? (v.views.length ? Math.round(v.views.reduce((s,x)=>s+x,0)/v.views.length) : 0)
        : parseFloat((v.eng.reduce((s,x)=>s+x,0)/v.eng.length).toFixed(2));
      return { date, value, _key: key };
    });
}

function MetricChart({ history, posts, curAvgViews, curAvgEng, followers }) {
  const [activeMetric, setActiveMetric] = useState('followers');
  const [activeRange,  setActiveRange]  = useState('3m');

  const metric = METRICS.find(m => m.key === activeMetric);
  const range  = RANGES.find(r => r.key === activeRange);

  const cutoff = range.months
    ? new Date(Date.now() - range.months * 30 * 24 * 3600 * 1000)
    : null;

  // For followers — use history snapshots
  // For views/engagement — derive from posts by month (much richer data)
  let chartData;
  if (activeMetric === 'followers') {
    chartData = history
      .filter(h => !cutoff || new Date(h.recorded_at) >= cutoff)
      .map(h => ({
        date:  new Date(h.recorded_at).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' }),
        value: h.followers ?? 0,
      }))
      .reverse(); // RTL: newest on left
  } else {
    const monthly = buildMonthlyFromPosts(posts, activeMetric);
    chartData = (cutoff
      ? monthly.filter(d => {
          const [yr, mo] = d._key.split('-');
          return new Date(Number(yr), Number(mo) - 1, 1) >= cutoff;
        })
      : monthly
    ).slice().reverse(); // RTL: newest on left
  }

  // Current value display
  const currentValues = {
    followers:      followers,
    avg_views:      curAvgViews,
    avg_engagement: curAvgEng,
  };
  const currentVal = currentValues[activeMetric];

  // Delta within selected range
  // index-0 = newest (after RTL reverse), so delta = newest - oldest
  const delta = chartData.length >= 2
    ? parseFloat((chartData[0].value - chartData[chartData.length - 1].value).toFixed(2))
    : null;

  const hasData = chartData.length > 1;

  return (
    <div className="rounded-2xl p-5"
      style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.08)' }}>

      {/* ── top row: metric tabs (right) + range tabs (left) ── */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        {/* Metric tabs */}
        <div className="flex gap-1 rounded-xl p-1" style={{ background: 'rgba(255,255,255,0.05)' }}>
          {METRICS.map(m => (
            <button key={m.key} onClick={() => setActiveMetric(m.key)}
              className="rounded-lg px-4 py-1.5 text-sm font-semibold transition-all"
              style={{
                background: activeMetric === m.key ? m.color + '22' : 'transparent',
                color:      activeMetric === m.key ? m.color        : 'rgba(255,255,255,0.35)',
                border:     activeMetric === m.key ? `1px solid ${m.color}44` : '1px solid transparent',
              }}>
              {m.label}
            </button>
          ))}
        </div>

        {/* Range tabs */}
        <div className="flex gap-1 rounded-xl p-1" style={{ background: 'rgba(255,255,255,0.05)' }}>
          {RANGES.map(r => (
            <button key={r.key} onClick={() => setActiveRange(r.key)}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
              style={{
                background: activeRange === r.key ? 'rgba(255,255,255,0.12)' : 'transparent',
                color:      activeRange === r.key ? 'white'                  : 'rgba(255,255,255,0.3)',
              }}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── current value + delta ── */}
      <div className="mb-4">
        <p className="text-4xl font-black text-white leading-none">
          {metric.fmt(currentVal)}
        </p>
        {delta != null && (
          <p className="text-sm mt-1.5 font-semibold" style={{ color: delta >= 0 ? '#4ade80' : '#ef4444' }}>
            {delta >= 0 ? '+' : ''}{metric.fmt(delta)} ב{range.label}
          </p>
        )}
      </div>

      {/* ── chart ── */}
      {hasData ? (
        <div dir="ltr" key={activeMetric}>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad_${activeMetric}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={metric.color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={metric.color} stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.28)', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.22)', fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={metric.fmt} width={48} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: 'rgba(8,9,22,0.97)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: 'white', fontSize: 12 }}
                formatter={v => [metric.fmt(v), metric.label]}
              />
              <Area type="monotone" dataKey="value" stroke={metric.color} strokeWidth={2.5}
                fill={`url(#grad_${activeMetric})`}
                dot={{ r: 3.5, fill: metric.color, stroke: 'rgb(var(--bg-surface))', strokeWidth: 1.5 }}
                activeDot={{ r: 5, fill: metric.color }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2" style={{ height: 200, color: 'rgba(255,255,255,0.18)' }}>
          <TrendingUp size={30} />
          <p className="text-sm text-center">הגרף יתמלא לאחר מספר רענונים<br/>לחץ "רענן" מדי פעם</p>
        </div>
      )}
    </div>
  );
}

// ── image with proxy fallback ────────────────────────────────
function ProxiedImage({ src, alt, className, style }) {
  const [url, setUrl] = useState(src ? `/api/instagram-apify/proxy-image?url=${encodeURIComponent(src)}` : null);
  if (!url) return null;
  return (
    <img src={url} alt={alt || ''} className={className} style={style}
      onError={() => setUrl(null)} />
  );
}

// ── Apify profile dashboard ───────────────────────────────────
const APIFY_PERIODS = [
  { key: 'all', label: 'הכל',      days: null },
  { key: '30',  label: 'חודש',     days: 30   },
  { key: '90',  label: '3 חודשים', days: 90   },
  { key: '365', label: 'שנה',      days: 365  },
];

function ApifyDashboard({ profile, history, onDisconnect }) {
  const [typeFilter,   setTypeFilter]   = useState('all');
  const [sortCol,      setSortCol]      = useState('timestamp');
  const [sortDir,      setSortDir]      = useState('desc');
  const [postPeriod,   setPostPeriod]   = useState('all');
  const [tablePage,    setTablePage]    = useState(0);
  const [expandedRows, setExpandedRows] = useState(new Set());
  function toggleRow(id) {
    setExpandedRows(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const scrapedAt = profile.scraped_at
    ? new Date(profile.scraped_at).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  // Current values from posts
  const posts = Array.isArray(profile.posts) ? profile.posts : [];
  const videoPosts = posts.filter(p => p.views > 0);
  const curAvgViews = videoPosts.length
    ? Math.round(videoPosts.reduce((s, p) => s + p.views, 0) / videoPosts.length) : 0;
  const curAvgEng = posts.length
    ? parseFloat((posts.reduce((s, p) => {
        const d = p.views || p.likes || 1;
        return s + (p.likes + p.comments) / d * 100;
      }, 0) / posts.length).toFixed(1)) : 0;

  // Posts table
  const now = Date.now();
  const periodFiltered = postPeriod === 'all'
    ? posts
    : posts.filter(p => p.timestamp && new Date(p.timestamp).getTime() >= now - Number(postPeriod) * 86_400_000);
  const filtered = typeFilter === 'all' ? periodFiltered : periodFiltered.filter(p => p.type === typeFilter);
  const sorted = [...filtered].sort((a, b) => {
    if (sortCol === 'engagement') {
      const aE = a.views > 0 ? (a.likes + a.comments) / a.views * 100 : (a.likes + a.comments);
      const bE = b.views > 0 ? (b.likes + b.comments) / b.views * 100 : (b.likes + b.comments);
      return sortDir === 'desc' ? bE - aE : aE - bE;
    }
    if (sortCol === 'type') {
      return sortDir === 'desc'
        ? (b.type || '').localeCompare(a.type || '')
        : (a.type || '').localeCompare(b.type || '');
    }
    const aVal = sortCol === 'timestamp' ? new Date(a.timestamp) : (a[sortCol] ?? -1);
    const bVal = sortCol === 'timestamp' ? new Date(b.timestamp) : (b[sortCol] ?? -1);
    return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
  });

  const tableTotal = sorted.length;
  const tablePages = Math.ceil(tableTotal / PAGE_SIZE);
  const pagedRows  = sorted.slice(tablePage * PAGE_SIZE, (tablePage + 1) * PAGE_SIZE);

  function changeTableFilter(period, sort, type) {
    if (period !== undefined) setPostPeriod(period);
    if (sort   !== undefined) setSortCol(sort);
    if (type   !== undefined) setTypeFilter(type);
    setTablePage(0);
  }
  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortCol(col); setSortDir('desc'); }
    setTablePage(0);
  }

  return (
    <div className="w-full space-y-5" dir="rtl">

      {/* ── Profile header ── */}
      <div className="rounded-2xl p-5 flex items-center gap-4"
        style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.08)' }}>

        {profile.profile_pic ? (
          <ProxiedImage src={profile.profile_pic} alt={profile.username}
            className="h-14 w-14 rounded-full object-cover flex-none"
            style={{ border: '2px solid rgba(255,255,255,0.15)' }} />
        ) : (
          <div className="h-14 w-14 rounded-full flex items-center justify-center flex-none"
            style={{ background: 'linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)' }}>
            <Instagram size={24} color="white" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-bold text-white">@{profile.username}</span>
            {profile.is_verified && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(59,130,246,0.2)', color: '#60a5fa' }}>✓ מאומת</span>}
            <a href={`https://instagram.com/${profile.username}`} target="_blank" rel="noopener noreferrer"
              className="p-1 rounded hover:bg-white/10 transition" style={{ color: 'rgba(255,255,255,0.35)' }}>
              <ExternalLink size={12} />
            </a>
          </div>
          {profile.bio && <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{profile.bio}</p>}
          {scrapedAt && <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>עודכן {scrapedAt}</p>}
        </div>

        <div className="flex gap-6 flex-none text-center px-2">
          <div>
            <p className="text-xl font-black text-white">{fmtK(profile.followers)}</p>
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.38)' }}>עוקבים</p>
          </div>
          <div>
            <p className="text-xl font-black text-white">{fmtK(profile.posts_count)}</p>
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.38)' }}>פוסטים</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-none">
          <button onClick={onDisconnect}
            className="rounded-lg p-1.5 hover:bg-white/10 transition" style={{ color: 'rgba(255,255,255,0.3)' }}>
            <LogOut size={14} />
          </button>
        </div>
      </div>

      {/* ── unified metric chart ── */}
      <MetricChart
        history={history}
        posts={posts}
        followers={profile.followers}
        curAvgViews={curAvgViews}
        curAvgEng={curAvgEng}
      />

      {/* ── Latest content table ── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'rgb(var(--bg-surface))', border: '1px solid rgba(255,255,255,0.08)' }}>

        {/* ── Header: title left, filters right ── */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 flex-wrap gap-3">
          <div>
            <p className="text-sm font-bold text-white">תוכן אחרון</p>
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.28)' }}>
              {postPeriod === 'all' ? 'כל הזמן' : postPeriod === '30' ? 'חודש אחרון' : postPeriod === '90' ? '3 חודשים' : 'שנה אחרונה'} · {tableTotal} פוסטים
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Type filter */}
            <div className="flex gap-0.5 rounded-lg p-0.5" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.07)' }}>
              {[
                { k: 'all',     l: 'הכל'     },
                { k: 'Video',   l: 'וידאו'   },
                { k: 'Sidecar', l: 'קרוסלה'  },
                { k: 'Image',   l: 'תמונה'   },
              ].map(({ k, l }) => (
                <button key={k} onClick={() => changeTableFilter(undefined, undefined, k)}
                  className="rounded-md px-2.5 py-1 text-xs font-semibold transition-all"
                  style={{
                    background: typeFilter === k ? 'rgba(255,255,255,0.12)' : 'transparent',
                    color:      typeFilter === k ? 'white' : 'rgba(255,255,255,0.35)',
                  }}>
                  {l}
                </button>
              ))}
            </div>

            {/* Period filter */}
            <div className="flex gap-0.5 rounded-lg p-0.5" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.07)' }}>
              {APIFY_PERIODS.map(p => (
                <button key={p.key} onClick={() => changeTableFilter(p.key, undefined, undefined)}
                  className="rounded-md px-2.5 py-1 text-xs font-semibold transition-all"
                  style={{
                    background: postPeriod === p.key ? 'rgba(255,255,255,0.12)' : 'transparent',
                    color:      postPeriod === p.key ? 'white' : 'rgba(255,255,255,0.35)',
                  }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Table header — LTR physical layout, RTL reading order ── */}
        {/* Column order left→right: פורסם | מעורבות | תגובות | לייקים | צפיות | סוג | כיתוב | thumb */}
        <div className="grid px-5 pb-2 pt-1 w-full" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr 3fr 52px', direction: 'ltr' }}>
          {[
            { k: 'timestamp',  l: 'פורסם'   },
            { k: 'engagement', l: 'מעורבות' },
            { k: 'comments',   l: 'תגובות'  },
            { k: 'likes',      l: 'לייקים'  },
            { k: 'views',      l: 'צפיות'   },
            { k: 'type',       l: 'סוג'     },
            { k: null,         l: 'כיתוב'   },
            { k: null,         l: ''        },
          ].map(({ k, l }) => (
            <button key={l + (k||'')} onClick={() => k && toggleSort(k)} disabled={!k}
              className="text-[10px] font-semibold tracking-wider select-none transition-colors text-right"
              style={{
                color:  sortCol === k ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.22)',
                cursor: k ? 'pointer' : 'default',
              }}>
              {l}{sortCol === k ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
            </button>
          ))}
        </div>

        {/* ── Rows ── */}
        {pagedRows.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>אין פוסטים</div>
        ) : pagedRows.map((post, i) => {
          const rowId    = post.id || i;
          const isOpen   = expandedRows.has(rowId);
          const eng      = engPct(post);
          const daysAgo  = post.timestamp
            ? Math.floor((Date.now() - new Date(post.timestamp)) / 86_400_000)
            : null;
          const postedLabel = daysAgo === 0 ? 'היום'
            : daysAgo === 1 ? 'אתמול'
            : daysAgo != null ? `לפני ${daysAgo}י`
            : '—';
          const COLS = '1fr 1fr 1fr 1fr 1fr 1fr 3fr 52px';

          return (
            <div key={rowId} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
              {/* Main row — same LTR column order as header */}
              <div className="grid px-5 py-2.5 items-center hover:bg-white/[0.025] transition cursor-pointer w-full"
                style={{ gridTemplateColumns: COLS, direction: 'ltr' }}
                onClick={() => toggleRow(rowId)}>

                {/* פורסם */}
                <p className="text-xs text-right" style={{ color: 'rgba(255,255,255,0.35)' }}>{postedLabel}</p>

                {/* מעורבות */}
                <p className="text-sm font-semibold text-right" style={{ color: eng ? '#4ade80' : 'rgba(255,255,255,0.2)' }}>
                  {eng ? `${eng}%` : '—'}
                </p>

                {/* תגובות */}
                <p className="text-sm font-semibold text-white text-right">{fmtK(post.comments)}</p>

                {/* לייקים */}
                <p className="text-sm font-semibold text-white text-right">{fmtK(post.likes)}</p>

                {/* צפיות */}
                <p className="text-sm font-semibold text-right" style={{ color: post.views > 0 ? 'white' : 'rgba(255,255,255,0.2)' }}>
                  {post.views > 0 ? fmtK(post.views) : '—'}
                </p>

                {/* סוג */}
                <div className="flex justify-end">
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: (TYPE_COLOR[post.type] || '#fff') + '18', color: TYPE_COLOR[post.type] || 'white' }}>
                    <TypeIcon type={post.type} size={9} />
                    {TYPE_LABEL[post.type] || post.type || '—'}
                  </span>
                </div>

                {/* כיתוב */}
                <p className="text-xs text-white truncate px-3 leading-snug text-right" style={{ direction: 'rtl' }}>
                  {post.caption?.slice(0, 120) || '—'}
                </p>

                {/* Thumbnail */}
                <a href={post.url} target="_blank" rel="noopener noreferrer"
                  className="block flex-none" onClick={e => e.stopPropagation()}>
                  {post.displayUrl ? (
                    <ProxiedImage src={post.displayUrl} alt=""
                      className="h-9 w-9 rounded-lg object-cover" style={{}} />
                  ) : (
                    <div className="h-9 w-9 rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(255,255,255,0.06)', color: TYPE_COLOR[post.type] || 'white' }}>
                      <TypeIcon type={post.type} size={13} />
                    </div>
                  )}
                </a>
              </div>

              {/* Expanded caption */}
              {isOpen && post.caption && (
                <div className="px-5 pb-3 pt-0" dir="rtl">
                  <p className="text-xs leading-relaxed rounded-xl p-3"
                    style={{ color: 'rgba(255,255,255,0.65)', background: 'rgba(255,255,255,0.04)', whiteSpace: 'pre-wrap' }}>
                    {post.caption}
                  </p>
                </div>
              )}
            </div>
          );
        })}

        {/* ── Pagination ── */}
        {tablePages > 1 && (
          <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <button
              disabled={tablePage === 0}
              onClick={() => setTablePage(p => p - 1)}
              className="rounded-lg px-4 py-1.5 text-xs font-semibold transition disabled:opacity-30"
              style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
              → הקודם
            </button>
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
              עמוד {tablePage + 1} מתוך {tablePages} · {tableTotal} פוסטים
            </span>
            <button
              disabled={tablePage >= tablePages - 1}
              onClick={() => setTablePage(p => p + 1)}
              className="rounded-lg px-4 py-1.5 text-xs font-semibold transition disabled:opacity-30"
              style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
              הבא ←
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── root component ────────────────────────────────────────────
export default function Content() {
  const { user }  = useUser();
  const userId    = user?.id;

  const [state,      setState]      = useState('loading'); // loading | connected | disconnected
  const [profile,    setProfile]    = useState(null);
  const [history,    setHistory]    = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [connectErr, setConnectErr] = useState(null);
  const [connecting, setConnecting] = useState(false);

  function loadHistory(uid) {
    fetch(`/api/instagram-apify/history?userId=${uid}`)
      .then(r => r.json())
      .then(d => Array.isArray(d) && setHistory(d))
      .catch(() => {});
  }

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/instagram-apify/profile?userId=${userId}`)
      .then(r => r.json())
      .then(data => {
        if (data?.username) { setProfile(data); setState('connected'); loadHistory(userId); }
        else setState('disconnected');
      })
      .catch(() => setState('disconnected'));
  }, [userId]);

  async function handleConnect(username) {
    setConnecting(true);
    setConnectErr(null);
    try {
      const r = await fetch('/api/instagram-apify/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, username }),
      });
      const d = await r.json();
      if (!r.ok || d.error) throw new Error(d.error || 'שגיאה בחיבור');
      setProfile(d.profile);
      setState('connected');
      loadHistory(userId);
    } catch(e) {
      setConnectErr(e.message);
    } finally {
      setConnecting(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const r = await fetch('/api/instagram-apify/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const d = await r.json();
      if (d.profile) { setProfile(d.profile); loadHistory(userId); }
    } finally {
      setRefreshing(false);
    }
  }

  async function handleDisconnect() {
    await fetch('/api/instagram-apify/disconnect', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    setProfile(null);
    setState('disconnected');
  }

  if (state === 'loading') return (
    <div className="w-full space-y-4" dir="rtl">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: 'rgb(var(--bg-surface))' }} />
      ))}
    </div>
  );

  if (state === 'disconnected') {
    return <ApifyConnectScreen onConnect={handleConnect} loading={connecting} error={connectErr} />;
  }

  return (
    <ApifyDashboard
      profile={profile}
      history={history}
      onDisconnect={handleDisconnect}
    />
  );
}
