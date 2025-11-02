"use client";

import React from "react";

type ButtonVariant = "filled" | "tonal" | "outline" | "text";

export function M3Button({
  children,
  className = "",
  variant = "filled",
  disabled,
  onClick,
  type = "button",
}: React.PropsWithChildren<{
  className?: string;
  variant?: ButtonVariant;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
}>) {
  const base = `m3-btn ${
    variant === "filled"
      ? "m3-btn--filled"
      : variant === "tonal"
      ? "m3-btn--tonal"
      : variant === "outline"
      ? "m3-btn--outline"
      : ""
  }`;
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={`${base} ${className}`}>
      {children}
    </button>
  );
}

export function M3IconButton({
  children,
  className = "",
  onClick,
  title,
  ariaLabel,
}: React.PropsWithChildren<{
  className?: string;
  onClick?: () => void;
  title?: string;
  ariaLabel?: string;
}>) {
  return (
    <button
      className={`m3-icon-btn hover:bg-[color-mix(in_oklab,var(--md-sys-color-on-surface)_8%,transparent)] ${className}`}
      onClick={onClick}
      title={title}
      aria-label={ariaLabel || title}
    >
      {children}
    </button>
  );
}

export function M3AppBar({ children }: React.PropsWithChildren) {
  return (
    <div className="m3-appbar sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">{children}</div>
      </div>
    </div>
  );
}

export function M3Tabs({ children }: React.PropsWithChildren) {
  return (
    <div className="bg-[var(--md-sys-color-surface)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="m3-tabs">{children}</div>
      </div>
    </div>
  );
}

export function M3Tab({
  selected,
  onClick,
  children,
}: {
  selected?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button className="m3-tab" role="tab" aria-selected={selected} onClick={onClick}>
      {children}
    </button>
  );
}

export function M3Card({ children, className = "" }: React.PropsWithChildren<{ className?: string }>) {
  return <div className={`m3-card ${className}`}>{children}</div>;
}

export function M3SectionHeader({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-8">
      <div className="flex items-center gap-4">
        {icon && (
          <div
            className="flex items-center justify-center w-12 h-12 rounded-[var(--md-sys-shape-corner-xl)]"
            style={{ background: "var(--md-sys-color-primary-container)", color: "var(--md-sys-color-on-primary-container)" }}
          >
            {icon}
          </div>
        )}
        <div>
          <h2 className="text-2xl font-medium">{title}</h2>
          {subtitle && <p className="text-sm opacity-70">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

