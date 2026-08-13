// client/src/components/AuthShell.tsx
//
// Shared split-panel layout for Login/Register: a branded panel on the
// left, the actual form on the right. Pulled out so both pages share one
// definition of "what StockPilot's auth screens look like" instead of
// duplicating the branding markup.

import { PackageSearch, Layers, ShieldCheck, ArrowLeftRight } from "lucide-react";
import type { ReactNode } from "react";

const FEATURES = [
  { icon: Layers, text: "Ledger-based stock tracking — every change is a permanent, auditable record" },
  { icon: ArrowLeftRight, text: "Transfer stock between warehouses without losing the trail" },
  { icon: ShieldCheck, text: "Role-based access — Admins manage the catalog, Staff run daily operations" },
];

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="auth-split">
      <div className="auth-brand-panel">
        <div className="auth-brand-panel-inner">
          <div className="auth-brand-logo">
            <PackageSearch size={26} strokeWidth={2.25} />
            <span>StockPilot</span>
          </div>
          <h2>Inventory that never lies about what's in stock.</h2>
          <ul className="auth-feature-list">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text}>
                <Icon size={18} />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="auth-form-panel">
        <div className="auth-form-wrap">
          <div className="auth-form-header">
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
