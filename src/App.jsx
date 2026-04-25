import { useEffect, useState } from 'react';
import { supabase, waitlistTable } from './lib/supabase';

const statsConfig = [
  // { key: 'waitlist', label: 'Waitlist', value: 0, suffix: '' },
  // { key: 'uptime', label: 'Uptime target', value: 99.94, suffix: '%' },
  // { key: 'latency', label: 'Latency', value: 2.8, suffix: 's' },
];

const features = [
  {
    title: 'Street-level coverage',
    body: 'See pollution changes block by block instead of relying on a few static city stations.',
  },
  // {
  //   title: 'Live sensor network',
  //   body: 'PM2.5, PM10, CO2, humidity, temperature, and pressure flow into one real-time data layer.',
  // },
  {
    title: 'Community incentives',
    body: 'Reliable contributors can earn for hosting devices and contrubuting for hyperlocal data.',
  },
  {
    title: 'Open environmental data',
    body: 'A cleaner base layer for citizens, researchers, partners, and future city integrations.',
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
  organization: '',
  role: '',
  twitter: '',
  telegram: '',
  interest: '',
};

function easeOutExpo(value) {
  return value === 1 ? 1 : 1 - 2 ** (-10 * value);
}

function formatStatValue(key, value) {
  if (key === 'waitlist') {
    return Math.round(value).toLocaleString();
  }

  if (key === 'uptime') {
    return value.toFixed(2);
  }

  return value.toFixed(1);
}

function getFriendlyError(message) {
  if (!message) {
    return 'Something went wrong while saving your spot. Please try again.';
  }

  if (message.toLowerCase().includes('duplicate')) {
    return 'This email is already on the waitlist. Try another address or check your inbox.';
  }

  return message;
}

export default function App() {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle');
  const [submitError, setSubmitError] = useState('');
  const [successData, setSuccessData] = useState(null);
  const [waitlistCount, setWaitlistCount] = useState(0);
  const [statsError, setStatsError] = useState('');
  const [animatedStats, setAnimatedStats] = useState(() =>
    statsConfig.reduce((accumulator, stat) => {
      accumulator[stat.key] = 0;
      return accumulator;
    }, {}),
  );

  const fetchWaitlistCount = async () => {
    if (!supabase) {
      return null;
    }

    const { count, error } = await supabase
      .from(waitlistTable)
      .select('*', { count: 'exact', head: true });

    if (error) {
      throw error;
    }

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
        targetStats.reduce((accumulator, stat) => {
          accumulator[stat.key] = stat.value;
          return accumulator;
        }, {}),
      );
      return undefined;
    }

    const animate = (timestamp) => {
      if (!start) {
        start = timestamp;
      }

      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = easeOutExpo(progress);

      setAnimatedStats(
        targetStats.reduce((accumulator, stat) => {
          accumulator[stat.key] = stat.value * eased;
          return accumulator;
        }, {}),
      );

      if (progress < 1) {
        frameId = window.requestAnimationFrame(animate);
      }
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

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    setErrors((current) => {
      if (!current[name]) {
        return current;
      }

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
        document.getElementById(firstInvalidField)?.focus();
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

      const { data: existingEntry, error: existingEntryError } = await supabase
        .from(waitlistTable)
        .select('id')
        .eq('email', email)
        .limit(1);

      if (existingEntryError) {
        throw existingEntryError;
      }

      if (existingEntry?.length) {
        throw new Error('duplicate_email');
      }

      const payload = {
        id: crypto.randomUUID(),
        name: form.name.trim(),
        email,
        location: form.location.trim(),
        organization: form.organization.trim() || null,
        role: form.role.trim() || null,
        twitter: form.twitter.trim() || null,
        telegram: form.telegram.trim() || null,
        interest: form.interest.trim() || null,
      };

      const { error: insertError } = await supabase.from(waitlistTable).insert(payload);

      if (insertError) {
        throw insertError;
      }

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

  return (
    <div className="page-shell">
      <div className="ambient ambient-left" aria-hidden="true" />
      <div className="ambient ambient-right" aria-hidden="true" />

      <header className="topbar fade-up">
        <a className="brand" href="/" aria-label="BREEZO Network home">
          <img
            src="/logo2.png"   // <-- put your logo in public folder
            alt="Breezo logo"
            className="brand-logo"
          />
          <span>BREEZO NETWORK</span>
        </a>

        <a
  href="https://x.com/Breezo_Network"
  target="_blank"
  rel="noopener noreferrer"
  className="topbar-meta twitter-link"
  aria-label="Breezo Twitter"
>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    width="16"
    height="16"
  >
    <path d="M18.244 2H21.5l-7.52 8.59L22 22h-6.828l-5.35-6.993L3.5 22H.244l8.045-9.19L2 2h6.828l4.83 6.34L18.244 2Zm-2.39 18h1.885L8.4 4H6.38l9.474 16Z"/>
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
            Breezo Network is building real-time,
            hyperlocal environmental infrastructure for the cities that need it most.
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

          {/* <p className="stats-note fade-up d5">
            {statsError || `Live count is being read from the "${waitlistTable}" table in Supabase.`}
          </p> */}
        </section>

        <section className="waitlist-panel fade-up d4" id="waitlist">
          <div className="panel-glow" aria-hidden="true" />
          <div className="panel-head">
            <span className="panel-badge mono">EARLY ACCESS</span>
            <h2>Reserve your spot</h2>
            <p>Tell us who you are and where you're based. We'll save your entry directly to Supabase.</p>
          </div>

          <div className="live-strip" aria-label="Live waitlist summary">
            <div>
              <span>Current waitlist</span>
              <strong className="mono">{waitlistCount.toLocaleString()}</strong>
            </div>
            {/* <a className="secondary-button live-cta" href="#form-fields">
              Join now
            </a> */}
          </div>

          {successData ? (
            <div className="success-card" role="status" aria-live="polite">
              <span className="success-kicker mono">Saved to database</span>
              <h3>Welcome, {successData.name}.</h3>
              <p>
                Your spot number is <strong>#{successData.spot}</strong>. We&apos;ll reach out at{' '}
                <strong>{successData.email}</strong> when the next Breezo rollout opens.
              </p>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setSuccessData(null);
                  setStatus('idle');
                }}
              >
                Add another signup
              </button>
            </div>
          ) : (
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
                    placeholder="address"
                  />
                  {errors.location ? <p className="field-error" id="location-error">{errors.location}</p> : null}
                </div>

                {/* <div className="field">
                  <label htmlFor="organization">Organization</label>
                  <input
                    id="organization"
                    name="organization"
                    type="text"
                    autoComplete="organization"
                    value={form.organization}
                    onChange={handleChange}
                    placeholder="organization"
                  />
                </div> */}

                {/* <div className="field">
                  <label htmlFor="role">Role</label>
                  <input
                    id="role"
                    name="role"
                    type="text"
                    autoComplete="organization-title"
                    value={form.role}
                    onChange={handleChange}
                    placeholder="Node operator"
                  />
                </div> */}

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

                {/* <div className="field field-full">
                  <label htmlFor="interest">How do you want to participate?</label>
                  <textarea
                    id="interest"
                    name="interest"
                    rows="4"
                    value={form.interest}
                    onChange={handleChange}
                    placeholder="Host a node, partner with the network, pilot data tools, or join the early community."
                  />
                </div> */}
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

              {/* <p className="form-note">Each successful submission is inserted into Supabase and updates the live count.</p> */}
            </form>
          )}
        </section>
      </main>

      <section className="feature-section">
        <div className="section-copy fade-up">
          <span className="section-label mono">CORE CAPABILITIES</span>
          <h2>Simple layout, stronger signal.</h2>
        </div>

        <div className="feature-grid">
          {features.map((feature, index) => (
            <article className={`feature-card fade-up d${Math.min(index + 1, 5)}`} key={feature.title}>
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
