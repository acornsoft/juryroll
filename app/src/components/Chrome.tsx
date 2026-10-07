import type { ReactNode } from 'react';
import type { AppRoute } from '../route.ts';

export function PageBanner({ title, crumbs }: {
  title: string;
  crumbs: { href?: string; label: string }[];
}) {
  return (
    <div className="page-banner">
      <div className="banner-pattern" aria-hidden="true" />
      <div className="about-inner">
        <h1 className="title">{title}</h1>
      </div>
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <ul>
          {crumbs.map((crumb, index) => {
            const last = index === crumbs.length - 1;
            return (
              <li key={`${crumb.label}-${index}`}>
                {crumb.href && !last ? <a href={crumb.href}>{crumb.label}</a> : <span aria-current={last ? 'page' : undefined}>{crumb.label}</span>}
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

const SWOOSH = 'M4 5 C 28 16, 78 17, 112 4';

export function HomeHero() {
  return (
    <section className="home-hero header-area header-sanatory" aria-labelledby="heroTitle">
      <div className="hero-wash" aria-hidden="true" />
      <div className="hero-panel">
        <div className="hero-visual">
          <svg className="hero-ballot" viewBox="0 0 220 148" aria-hidden="true">
            <rect x="58" y="14" width="104" height="120" rx="6" fill="#fff" />
            <path d="M58 28h104" stroke="#DD131A" strokeWidth="8" />
            <rect x="72" y="44" width="14" height="14" rx="2" fill="none" stroke="#000565" strokeWidth="2" />
            <path d="M75 51.5l3 3.2 6.5-7" fill="none" stroke="#DD131A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M94 51h52" stroke="#04072E" strokeWidth="3" strokeLinecap="round" />
            <rect x="72" y="70" width="14" height="14" rx="2" fill="none" stroke="#000565" strokeWidth="2" />
            <path d="M75 77.5l3 3.2 6.5-7" fill="none" stroke="#DD131A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M94 77h40" stroke="#04072E" strokeWidth="3" strokeLinecap="round" />
            <rect x="72" y="96" width="14" height="14" rx="2" fill="none" stroke="#000565" strokeWidth="2" />
            <path d="M94 103h46" stroke="#9aa0b8" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <ul className="hero-stats">
            <li>100% in your browser</li>
            <li>0 network calls</li>
            <li>Counts only</li>
          </ul>
        </div>
      </div>
      <div className="header-inner">
        <h1 id="heroTitle" className="title">
          Check a jury list
          <br />
          <span className="swoosh-word">
            against the
            <svg viewBox="0 0 116 18" className="lottie-shape" aria-hidden="true">
              <path className="path" fill="none" stroke="#DD131A" strokeWidth="4" strokeLinecap="round" d={SWOOSH} />
            </svg>
          </span>
          {' '}voter roll
        </h1>
        <p className="subtitle-01">
          <span className="bullet" aria-hidden="true" />
          A match is a referral, not proof
        </p>
        <p>JuryRoll never contacts voters. Do not publish names.</p>
        <div className="btn-wrapper">
          <a className="boxed-btn btn-sanatory" href="#stepper">
            Run a check
            <i className="icon-paper-plan" aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}

export function SideTab() {
  return (
    <a className="side-tab" href="#stepper">Run a check</a>
  );
}

export function bannerFor(route: AppRoute, stateLabel: string): { title: string; crumbs: { href?: string; label: string }[] } | null {
  switch (route.name) {
    case 'home':
      return null;
    case 'states':
      return {
        title: 'State walkthroughs',
        crumbs: [{ href: '#/run', label: 'Home' }, { label: 'State walkthroughs' }],
      };
    case 'state':
      return {
        title: stateLabel,
        crumbs: [
          { href: '#/run', label: 'Home' },
          { href: '#/states', label: 'State walkthroughs' },
          { label: stateLabel },
        ],
      };
    case 'law':
      return {
        title: 'Law & guidance',
        crumbs: [{ href: '#/run', label: 'Home' }, { label: 'Law & guidance' }],
      };
    case 'faq':
      return {
        title: 'Help & FAQ',
        crumbs: [{ href: '#/run', label: 'Home' }, { label: 'Help & FAQ' }],
      };
    default: {
      const neverRoute: never = route;
      return neverRoute;
    }
  }
}

export function IconBox({ id, icon, title, role, children }: {
  id?: string;
  icon: string;
  title: string;
  role?: 'status' | 'alert';
  children: ReactNode;
}) {
  return (
    <div className="icon-box-item-02" id={id} role={role}>
      <div className="icon" aria-hidden="true"><i className={icon} /></div>
      <div className="content">
        <span className="title">{title}</span>
        <div className="icon-copy">{children}</div>
      </div>
    </div>
  );
}
