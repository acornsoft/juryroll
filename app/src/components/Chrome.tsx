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

const SWOOSH = 'M186.3,17.5c0,0-36.4-18.2-92.3-14.7S1.4,29.6,2.9,47.8s34.4,25.9,62.6,28s79.9-1.5,108.2-14.9s12.8-31.8-5.9-37.7c-26.4-8.4-49.5-9.5-49.5-9.5';

export function HomeHero() {
  return (
    <section className="home-hero header-area header-sanatory" aria-labelledby="heroTitle">
      <div className="hero-wash" aria-hidden="true" />
      <div className="hero-panel" aria-hidden="true" />
      <div className="header-inner">
        <svg viewBox="0 0 191.6 78.6" className="lottie-shape" aria-hidden="true">
          <path className="path" fill="none" stroke="#DD131A" strokeWidth="4.5" strokeLinecap="round" d={SWOOSH} />
        </svg>
        <h1 id="heroTitle" className="title">Check a jury list<br />against the voter roll</h1>
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
