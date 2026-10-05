"use client";

import Link from "next/link";
import PropTypes from "prop-types";
import Card from "./Card";
import { cn } from "@/shared/utils/cn";

/**
 * Global stat/metric tile template.
 *
 * One definition drives every small dashboard tile (usage summary, provider
 * tiles, etc.) so they stay visually consistent instead of being hardcoded
 * inline one by one.
 */
export default function StatCard({
  title,
  subtitle,
  label,
  value,
  hint,
  icon,
  media,
  href,
  tone = "default",
  dimmed = false,
  className,
  ...props
}) {
  const tones = {
    default: "text-text-main",
    primary: "text-primary",
    muted: "text-text-muted",
    brand: "text-brand-500",
  };

  const content = (
    <Card
      padding="sm"
      className={cn(
        "h-full min-w-0 transition-all",
        href && "cursor-pointer hover:border-brand-500/30 hover:shadow-[var(--shadow-soft)]",
        dimmed && "opacity-60 grayscale hover:opacity-80",
        className
      )}
      {...props}
    >
      {title && (
        <div className="flex min-w-0 items-center gap-2 font-medium text-text-main">
          {media}
          {!media && icon && (
            <span className="material-symbols-outlined text-[18px] text-text-muted">{icon}</span>
          )}
          <span className="min-w-0 truncate">{title}</span>
        </div>
      )}
      {icon && !title && !media && !label && (
        <span className="material-symbols-outlined text-[18px] text-text-muted">{icon}</span>
      )}
      {label && (
        <div className="flex min-w-0 items-center gap-2">
          {!title && !media && icon && (
            <span className="material-symbols-outlined text-[18px] text-text-muted">{icon}</span>
          )}
          <div className="min-w-0 text-xs uppercase tracking-wide text-text-muted">{label}</div>
        </div>
      )}
      {subtitle && <div className="mt-0.5 text-xs text-text-muted">{subtitle}</div>}
      {value != null && (
        <div className={cn("mt-1 truncate text-xl font-bold", tones[tone] || tones.default)}>
          {value}
        </div>
      )}
      {hint && <div className="mt-1 text-xs text-text-muted">{hint}</div>}
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block min-w-0">
        {content}
      </Link>
    );
  }
  return content;
}

StatCard.propTypes = {
  // Top line (e.g. provider name); when set, value/hint render beneath it.
  title: PropTypes.node,
  // Small muted line under the title (e.g. "N active accounts").
  subtitle: PropTypes.node,
  // Small uppercase label (e.g. "Requests").
  label: PropTypes.node,
  value: PropTypes.node,
  hint: PropTypes.node,
  icon: PropTypes.string,
  // Leading node for the title row (e.g. provider logo).
  media: PropTypes.node,
  href: PropTypes.string,
  tone: PropTypes.oneOf(["default", "primary", "muted", "brand"]),
  dimmed: PropTypes.bool,
  className: PropTypes.string,
};
