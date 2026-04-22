import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", {
  variants: {
    variant: {
      default: "border-slate-600 text-slate-200",
      destructive: "border-red-500/60 bg-red-500/10 text-red-300",
      warning: "border-amber-500/60 bg-amber-500/10 text-amber-200",
      safe: "border-emerald-500/60 bg-emerald-500/10 text-emerald-200",
      info: "border-cyan-500/60 bg-cyan-500/10 text-cyan-200"
    }
  },
  defaultVariants: {
    variant: "default"
  }
});

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
