import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold cursor-pointer transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45 disabled:cursor-not-allowed active:scale-[0.97] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[#1B1A20] text-white hover:bg-[#2B2934] border border-[#1B1A20] hover:shadow-[0_0_20px_rgba(199,184,245,0.45)]",
        destructive: "bg-[#D64545] text-white hover:bg-[#B83838] border border-[#D64545] shadow-xs",
        outline:
          "border border-[#ECEBF0] bg-white text-[#1B1A20] hover:bg-[#F3F2F6] hover:border-[#9B99A6] shadow-xs",
        secondary: "bg-[#F3F2F6] text-[#1B1A20] hover:bg-[#EFEDF4] border border-[#ECEBF0]",
        ghost: "hover:bg-[#F3F2F6] text-[#5C5A66] hover:text-[#1B1A20]",
        link: "text-[#1B1A20] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8.5 rounded-full px-4 text-xs font-semibold",
        lg: "h-12 rounded-full px-7 text-base font-semibold",
        icon: "h-10 w-10 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
