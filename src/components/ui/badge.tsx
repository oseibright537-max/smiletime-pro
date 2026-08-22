import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-[#C7B8F5] bg-[#F3EFFC] text-[#7C5ED6]",
        secondary: "border-[#ECEBF0] bg-[#F3F2F6] text-[#5C5A66]",
        destructive: "border-[#F5B8C4] bg-[#FDF1F3] text-[#D64545]",
        outline: "border-[#ECEBF0] text-[#1B1A20] bg-white",
        success: "border-[#B8E5C8] bg-[#EEF7F1] text-[#2F9E63]",
        warning: "border-[#FDE68A] bg-[#FDF6E2] text-[#B45309]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
