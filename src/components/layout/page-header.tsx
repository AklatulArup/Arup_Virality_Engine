import React from "react";

// Standard page header used by every (app) route: title, one-line "so what"
// description, optional right-aligned actions.
export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
      <div>
        <h1 className="text-[22px] font-semibold text-foreground">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children ? <div className="flex items-center gap-2">{children}</div> : null}
    </div>
  );
}
