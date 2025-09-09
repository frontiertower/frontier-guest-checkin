import * as React from "react"
import { cn } from "@/lib/utils"

interface ListItemProps extends React.ComponentProps<"div"> {
  variant?: "default" | "compact" | "padded" | "interactive"
  showBorder?: boolean
  showHoverEffect?: boolean
}

const ListItem = React.forwardRef<HTMLDivElement, ListItemProps>(
  ({ className, variant = "default", showBorder = false, showHoverEffect = true, ...props }, ref) => {
    const variants = {
      default: "py-3 px-0",
      compact: "py-2 px-0", 
      padded: "p-4",
      interactive: "p-3 rounded-lg cursor-pointer"
    }

    const baseStyles = "flex items-start gap-3 transition-colors"
    const borderStyles = showBorder ? "border-b border-border last:border-b-0" : ""
    const hoverStyles = showHoverEffect ? "hover:bg-muted/50" : ""
    
    return (
      <div
        ref={ref}
        className={cn(
          baseStyles,
          variants[variant],
          borderStyles,
          hoverStyles,
          className
        )}
        {...props}
      />
    )
  }
)
ListItem.displayName = "ListItem"

interface ListItemIconProps extends React.ComponentProps<"div"> {
  variant?: "default" | "colorful" | "minimal"
}

const ListItemIcon = React.forwardRef<HTMLDivElement, ListItemIconProps>(
  ({ className, variant = "default", children, ...props }, ref) => {
    const variants = {
      default: "w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0",
      colorful: "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0", // Background color applied by parent
      minimal: "flex-shrink-0"
    }

    return (
      <div
        ref={ref}
        className={cn(variants[variant], className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)
ListItemIcon.displayName = "ListItemIcon"

interface ListItemContentProps extends React.ComponentProps<"div"> {}

const ListItemContent = React.forwardRef<HTMLDivElement, ListItemContentProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex-1 min-w-0", className)}
        {...props}
      />
    )
  }
)
ListItemContent.displayName = "ListItemContent"

interface ListItemHeaderProps extends React.ComponentProps<"div"> {}

const ListItemHeader = React.forwardRef<HTMLDivElement, ListItemHeaderProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex items-center justify-between gap-4 mb-1", className)}
        {...props}
      />
    )
  }
)
ListItemHeader.displayName = "ListItemHeader"

interface ListItemTitleProps extends React.ComponentProps<"h4"> {}

const ListItemTitle = React.forwardRef<HTMLHeadingElement, ListItemTitleProps>(
  ({ className, ...props }, ref) => {
    return (
      <h4
        ref={ref}
        className={cn("font-medium text-foreground truncate", className)}
        {...props}
      />
    )
  }
)
ListItemTitle.displayName = "ListItemTitle"

interface ListItemDescriptionProps extends React.ComponentProps<"p"> {}

const ListItemDescription = React.forwardRef<HTMLParagraphElement, ListItemDescriptionProps>(
  ({ className, ...props }, ref) => {
    return (
      <p
        ref={ref}
        className={cn("text-sm text-muted-foreground", className)}
        {...props}
      />
    )
  }
)
ListItemDescription.displayName = "ListItemDescription"

interface ListItemMetaProps extends React.ComponentProps<"span"> {}

const ListItemMeta = React.forwardRef<HTMLSpanElement, ListItemMetaProps>(
  ({ className, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn("text-xs text-muted-foreground flex-shrink-0", className)}
        {...props}
      />
    )
  }
)
ListItemMeta.displayName = "ListItemMeta"

interface ListItemActionProps extends React.ComponentProps<"div"> {}

const ListItemAction = React.forwardRef<HTMLDivElement, ListItemActionProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex items-center gap-2 flex-shrink-0", className)}
        {...props}
      />
    )
  }
)
ListItemAction.displayName = "ListItemAction"

export {
  ListItem,
  ListItemIcon,
  ListItemContent,
  ListItemHeader,
  ListItemTitle,
  ListItemDescription,
  ListItemMeta,
  ListItemAction,
}