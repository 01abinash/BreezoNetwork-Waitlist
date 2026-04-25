import { useEffect, useState, useRef } from 'react';
import { supabase, waitlistTable } from './lib/supabase';

const statsConfig = [];

const features = [
  {
    title: 'Hyperlocal AQI Intelligence',
    body: 'See pollution changes block by block instead of relying on a few static city stations.',
  },
  {
    title: 'Open Data Marketplace',
    body: 'Businesses, researchers, and governments can access reliable AQI datasets through a trustless, on-chain exchange system.',
  },
  {
    title: 'Tokenized Data Exchange',
    body: 'Users earn blockchain-based rewards for contributing verified environmental data, creating a fair and incentivized data economy.',
  },
  {
    title: 'WhatsApp chat Bot',
    body: 'Users can simply message on WhatsApp to get real-time AQI data for their location, making Breezo accessible without needing any app or dashboard.',
  },
];

const quickPoints = [
  'Real-time hyperlocal monitoring',
  'Data transparency for research and policy',
  'Accessible environmental intelligence for users',
];

const initialForm = {
  name: '',
  email: '',
  location: '',
  twitter: '',
  telegram: '',
  interest: '',
};

const COUNTDOWN_SECONDS = 10;

function easeOutExpo(value) {
  return value === 1 ? 1 : 1 - Math.pow(2, -10 * value);
}

function formatStatValue(key, value) {
  if (key === 'waitlist') return Math.round(value).toLocaleString();
  if (key === 'uptime') return value.toFixed(2);
  return value.toFixed(1);
}

function getFriendlyError(message) {
  if (!message) return 'Something went wrong while saving your spot. Please try again.';
  return message;
}

const styles = `
  .flip-container {
    margin-top: 20px;
    perspective: 1200px;
    width: 100%;
    position: relative;
    z-index: 3;
  }

  .flip-inner {
    position: relative;
    width: 100%;
    min-height: 460px;
    transition: transform 0.85s cubic-bezier(0.22, 1, 0.36, 1) !important;
    transform-style: preserve-3d;
    -webkit-transform-style: preserve-3d;
    will-change: transform;
    transform: rotateY(0deg) translateZ(0);
  }

  .flip-inner.flipped {
    transform: rotateY(180deg) translateZ(0);
  }

  .flip-front,
  .flip-back {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    transform-style: preserve-3d;
    -webkit-transform-style: preserve-3d;
    border-radius: 24px;
  }

  .flip-front {
    transform: rotateY(0deg) translateZ(1px);
    z-index: 2;
    pointer-events: auto;
    visibility: visible;
  }

  .flip-back {
    transform: rotateY(180deg) translateZ(1px);
    display: flex;
    align-items: stretch;
    pointer-events: none;
    z-index: 1;
    visibility: hidden;
    opacity: 0;
  }

  .flip-inner.flipped .flip-front {
    pointer-events: none;
    z-index: 1;
    visibility: hidden;
  }

  .flip-inner.flipped .flip-back {
    pointer-events: auto;
    z-index: 2;
    visibility: visible;
    opacity: 1;
  }

  .flip-form-card,
  .waitlist-form,
  .submit-button {
    position: relative;
    z-index: 4;
  }

  .success-border-wrap {
    width: 100%;
    height: 100%;
    position: relative;
    border-radius: 24px;
  }

  .success-border-svg {
    position: absolute;
    inset: -2px;
    width: calc(100% + 4px);
    height: calc(100% + 4px);
    pointer-events: none;
    overflow: visible;
  }

  .border-track {
    fill: none;
    stroke: rgba(255,255,255,0.07);
    stroke-width: 3;
  }

  .border-progress {
    fill: none;
    stroke: url(#borderGrad);
    stroke-width: 3;
    stroke-linecap: round;
  }

  .success-inner-card {
    height: 100%;
    border-radius: 14px;
    position: relative;
    z-index: 1;
  }

  .flip-form-card,
  .flip-success-card {
    height: 100%;
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 24px;
    background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015));
  }

  .flip-form-card {
    padding: 22px;
  }

  .flip-success-card {
    display: flex;
    align-items: stretch;
    justify-content: stretch;
  }

  @media (prefers-reduced-motion: reduce) {
    .flip-inner {
      transition: transform 0.85s cubic-bezier(0.22, 1, 0.36, 1) !important;
    }
  }
`;

function CountdownBorderCard({ countdown, totalSeconds, children }) {
  const wrapRef = useRef(null);
  const [perimeter, setPerimeter] = useState(0);
  const [offset, setOffset] = useState(0);
  const rafRef = useRef(null);
  const startTimeRef = useRef(null);
  const startOffsetRef = useRef(0);

  useEffect(() => {
    const measure = () => {
      if (wrapRef.current) {
        const { width, height } = wrapRef.current.getBoundingClientRect();
        const r = 16;
        const p = 2 * ((width - 2 * r) + (height - 2 * r)) + 2 * Math.PI * r;
        setPerimeter(Math.round(p));
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (perimeter === 0) return;

    // cancel any running animation
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    startTimeRef.current = null;

    const targetOffset = perimeter * (1 - countdown / totalSeconds);
    startOffsetRef.current = offset;

    const animate = (timestamp) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const duration = 1000; // 1s per tick, driven by RAF
      const t = Math.min(elapsed / duration, 1);

      const current = startOffsetRef.current + (targetOffset - startOffsetRef.current) * t;
      setOffset(current);

      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [countdown, perimeter]);

  return (
    <div className="success-border-wrap" ref={wrapRef}>
      <svg
        className="success-border-svg"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#6ee7f7" />
            <stop offset="50%"  stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#f472b6" />
          </linearGradient>
        </defs>

        {perimeter > 0 && (
          <>
            <rect
              className="border-track"
              x="2" y="2"
              width="calc(100% - 4px)"
              height="calc(100% - 4px)"
              rx="16" ry="16"
            />
            <rect
              className="border-progress"
              x="2" y="2"
              width="calc(100% - 4px)"
              height="calc(100% - 4px)"
              rx="16" ry="16"
              strokeDasharray={perimeter}
              strokeDashoffset={offset}
            />
          </>
        )}
      </svg>

      <div className="success-inner-card">
        {children}
      </div>
    </div>
  );
}

export default function App() {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle');
  const [submitError, setSubmitError] = useState('');
  const [successData, setSuccessData] = useState(null);
  const [flipped, setFlipped] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [waitlistCount, setWaitlistCount] = useState(0);
  const [statsError, setStatsError] = useState('');
  const [animatedStats, setAnimatedStats] = useState(() =>
    statsConfig.reduce((acc, stat) => {
      acc[stat.key] = 0;
      return acc;
    }, {}),
  );

  const fetchWaitlistCount = async () => {
    if (!supabase) return null;
    const { count, error } = await supabase
      .from(waitlistTable)
      .select('*', { count: 'exact', head: true });
    if (error) throw error;
    const nextCount = count ?? 0;
    setWaitlistCount(nextCount);
    return nextCount;
  };

  useEffect(() => {
    let frameId;
    let start;
    const duration = 1400;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const targetStats = statsConfig.map((stat) =>
      stat.key === 'waitlist' ? { ...stat, value: waitlistCount } : stat,
    );

    if (mediaQuery.matches) {
      setAnimatedStats(
        targetStats.reduce((acc, stat) => {
          acc[stat.key] = stat.value;
          return acc;
        }, {}),
      );
      return undefined;
    }

    const animate = (timestamp) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = easeOutExpo(progress);
      setAnimatedStats(
        targetStats.reduce((acc, stat) => {
          acc[stat.key] = stat.value * eased;
          return acc;
        }, {}),
      );
      if (progress < 1) frameId = window.requestAnimationFrame(animate);
    };

    frameId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frameId);
  }, [waitlistCount]);

  useEffect(() => {
    const loadWaitlistCount = async () => {
      if (!supabase) {
        setStatsError('Connect Supabase to show the live waitlist count.');
        return;
      }
      try {
        setStatsError('');
        await fetchWaitlistCount();
      } catch (error) {
        setStatsError('Could not load the live waitlist count.');
      }
    };
    loadWaitlistCount();
  }, []);

  useEffect(() => {
    if (!successData) return;

    setFlipped(true);
    setCountdown(COUNTDOWN_SECONDS);

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setFlipped(false);
          setTimeout(() => {
            setSuccessData(null);
            setStatus('idle');
          }, 800);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [successData]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  };

  const validateForm = () => {
    const nextErrors = {};
    if (!form.name.trim()) {
      nextErrors.name = 'Tell us your name so we can personalize your invite.';
    }
    if (!form.email.trim()) {
      nextErrors.email = 'Enter the email where we should send your access update.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      nextErrors.email = 'Enter a valid email address.';
    }
    if (!form.location.trim()) {
      nextErrors.location = 'Add your city so we can map early node demand.';
    }
    return nextErrors;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const validationErrors = validateForm();
    setErrors(validationErrors);
    setSubmitError('');

    if (Object.keys(validationErrors).length > 0) {
      const firstInvalidField = Object.keys(validationErrors)[0];
      window.requestAnimationFrame(() => {
        document.getElementById(firstInvalidField).focus();
      });
      return;
    }

    if (!supabase) {
      setSubmitError('Missing Supabase environment variables. Add them to your local .env file first.');
      return;
    }

    setStatus('loading');

    try {
      const email = form.email.trim().toLowerCase();

      const payload = {
        id: crypto.randomUUID(),
        name: form.name.trim(),
        email: email,
        location: form.location.trim(),
        twitter: form.twitter.trim() || null,
        telegram: form.telegram.trim() || null,
        interest: form.interest.trim() || null,
      };

      const { error: insertError } = await supabase.from(waitlistTable).insert(payload);
      if (insertError) throw insertError;

      const count = await fetchWaitlistCount();

      setSuccessData({
        name: payload.name.split(' ')[0],
        email: payload.email,
        spot: count ?? 1,
      });
      setForm(initialForm);
      setStatus('success');
    } catch (error) {
      setSubmitError(getFriendlyError(error.message));
      setStatus('error');
    }
  };

  const resetToForm = () => {
    setFlipped(false);
    setTimeout(() => {
      setSuccessData(null);
      setStatus('idle');
    }, 800);
  };

  return (
    <div className="page-shell">
      <style>{styles}</style>

      <div className="ambient ambient-left" aria-hidden="true" />
      <div className="ambient ambient-right" aria-hidden="true" />

      <header className="topbar fade-up">
        <a className="brand" href="/" aria-label="BREEZO Network home">
          <img src="/logo2.png" alt="Breezo logo" className="brand-logo" />
          <span>BREEZO NETWORK</span>
        </a>

        <a
          href="https://x.com/Breezo_Network"
          target="_blank"
          rel="noopener noreferrer"
          className="topbar-meta twitter-link"
          aria-label="Breezo Twitter"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <path d="M18.244 2H21.5l-7.52 8.59L22 22h-6.828l-5.35-6.993L3.5 22H.244l8.045-9.19L2 2h6.828l4.83 6.34L18.244 2Zm-2.39 18h1.885L8.4 4H6.38l9.474 16Z" />
          </svg>
        </a>
      </header>

      <main className="hero-layout">
        <section className="hero-copy">
          <div className="eyebrow fade-up d1">
            <span className="eyebrow-dot" aria-hidden="true" />
            Decentralized AQI
          </div>

          <h1 className="fade-up d2">Join Breezo before the device wave goes live.</h1>

          <p className="hero-text fade-up d3">
            Breezo Network is building real-time, hyperlocal environmental infrastructure for the cities that need it most.
          </p>

          <ul className="quick-list fade-up d4" aria-label="Highlights">
            {quickPoints.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <dl className="stats-grid fade-up d5" aria-label="Network stats">
            {statsConfig.map((stat) => (
              <div className="stat-card" key={stat.key}>
                <dt>{stat.label}</dt>
                <dd className="mono">
                  {formatStatValue(stat.key, animatedStats[stat.key] ?? 0)}
                  {stat.suffix}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="waitlist-panel fade-up d4" id="waitlist">
          <div className="panel-glow" aria-hidden="true" />
          <div className="panel-head">
            <span className="panel-badge mono">EARLY ACCESS</span>
            <h2>Reserve your spot</h2>
            <p>Tell us who you are and where you are based.</p>
          </div>

          <div className="live-strip" aria-label="Live waitlist summary">
            <div>
              <span>Current waitlist</span>
              <strong className="mono">{waitlistCount.toLocaleString()}</strong>
            </div>
          </div>

          <div className="flip-container" aria-live="polite">
            <div className={'flip-inner' + (flipped ? ' flipped' : '')}>

              <div className="flip-front">
                <div className="flip-form-card">
                <form className="waitlist-form" onSubmit={handleSubmit} noValidate>
                  <div className="field-grid" id="form-fields">
                    <div className="field">
                      <label htmlFor="name">Full name *</label>
                      <input
                        id="name"
                        name="name"
                        type="text"
                        autoComplete="name"
                        spellCheck={false}
                        value={form.name}
                        onChange={handleChange}
                        aria-invalid={errors.name ? 'true' : undefined}
                        aria-describedby={errors.name ? 'name-error' : undefined}
                        placeholder="Your name"
                      />
                      {errors.name ? <p className="field-error" id="name-error">{errors.name}</p> : null}
                    </div>

                    <div className="field">
                      <label htmlFor="email">Email *</label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        spellCheck={false}
                        value={form.email}
                        onChange={handleChange}
                        aria-invalid={errors.email ? 'true' : undefined}
                        aria-describedby={errors.email ? 'email-error' : undefined}
                        placeholder="you@domain.com"
                      />
                      {errors.email ? <p className="field-error" id="email-error">{errors.email}</p> : null}
                    </div>

                    <div className="field">
                      <label htmlFor="location">Location *</label>
                      <input
                        id="location"
                        name="location"
                        type="text"
                        autoComplete="address-level2"
                        value={form.location}
                        onChange={handleChange}
                        aria-invalid={errors.location ? 'true' : undefined}
                        aria-describedby={errors.location ? 'location-error' : undefined}
                        placeholder="City"
                      />
                      {errors.location ? <p className="field-error" id="location-error">{errors.location}</p> : null}
                    </div>

                    <div className="field">
                      <label htmlFor="twitter">Twitter / X</label>
                      <input
                        id="twitter"
                        name="twitter"
                        type="text"
                        autoComplete="off"
                        spellCheck={false}
                        value={form.twitter}
                        onChange={handleChange}
                        placeholder="@twitter"
                      />
                    </div>

                    <div className="field field-full">
                      <label htmlFor="telegram">Telegram</label>
                      <input
                        id="telegram"
                        name="telegram"
                        type="text"
                        autoComplete="off"
                        spellCheck={false}
                        value={form.telegram}
                        onChange={handleChange}
                        placeholder="@telegram"
                      />
                    </div>
                  </div>

                  {submitError ? (
                    <div className="form-banner" role="alert">
                      {submitError}
                    </div>
                  ) : null}

                  <button
                    className="primary-button submit-button"
                    type="submit"
                    disabled={status === 'loading'}
                    aria-busy={status === 'loading'}
                  >
                    {status === 'loading' ? (
                      <>
                        <span className="button-spinner" aria-hidden="true" />
                        Saving your spot...
                      </>
                    ) : (
                      'Join the waitlist'
                    )}
                  </button>
                </form>
                </div>
              </div>

              <div className="flip-back">
                {successData ? (
                  <div className="flip-success-card">
                  <CountdownBorderCard countdown={countdown} totalSeconds={COUNTDOWN_SECONDS}>
                    <div className="success-card" role="status" aria-live="polite">
                      <span className="success-kicker mono">Thanks! You have been added.</span>
                      <h3>Welcome, {successData.name}!</h3>
                      <p>
                        You have secured early access to BREEZO NETWORK.
                        <br />
                        Stay tuned — we will notify you when we launch.
                      </p>
                      {/* <p style={{ opacity: 0.6, fontSize: '0.85rem', marginTop: '0.5rem' }}>
                        Flipping back in {countdown}s...
                      </p> */}
                      {/* <button type="button" className="secondary-button" onClick={resetToForm}>
                        Add another signup
                      </button> */}
                    </div>
                  </CountdownBorderCard>
                  </div>
                ) : null}
              </div>

            </div>
          </div>

        </section>
      </main>

      <section className="feature-section">
        <div className="section-copy fade-up">
          <span className="section-label mono">CORE CAPABILITIES</span>
          <h2>Simple layout, stronger signal.</h2>
        </div>

        <div className="feature-grid">
          {features.map((feature, index) => (
            <article className={'feature-card fade-up d' + Math.min(index + 1, 5)} key={feature.title}>
              <span className="feature-index mono">0{index + 1}</span>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
