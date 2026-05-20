"use client";

import * as React from "react";
import * as ContextMenuPrimitive from "@radix-ui/react-context-menu";
import { cn } from "@/lib/utils";

export const ContextMenu = ContextMenuPrimitive.Root;

export const ContextMenuTrigger = ContextMenuPrimitive.Trigger;

export const ContextMenuPortal = ContextMenuPrimitive.Portal;

function getSideOffset(props: Record<string, unknown>): number | undefined {
  const val = props["sideOffset"];
  return typeof val === "number" ? val : undefined;
}

// Content wrapper with styling
export const ContextMenuContent = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>
>(({ className, ...props }, ref) => {
  const sideOffset = getSideOffset(props as any);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { sideOffset: _sideOffset, ...rest } = props as any;
  return (
    <ContextMenuPortal>
      <ContextMenuPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          "min-w-[8rem] z-50 overflow-hidden rounded-md border border-border bg-popover p-1 shadow-md",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          className
        )}
        {...rest}
      />
    </ContextMenuPortal>
  );
});

ContextMenuContent.displayName = "ContextMenuContent";

// Menu item
export const ContextMenuItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item>
>(({ className, ...props }, ref) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { inset: _inset, ...rest } = props as any;
  return (
    <ContextMenuPrimitive.Item
      ref={ref}
      className={cn(
        "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none",
        "focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        _inset && "pl-8",
        className
      )}
      {...rest}
    />
  );
});

ContextMenuItem.displayName = "ContextMenuItem";

// Separator
export const ContextMenuSeparator = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
));

ContextMenuSeparator.displayName = "ContextMenuSeparator";


