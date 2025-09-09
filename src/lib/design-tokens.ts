/**
 * Design Tokens for Frontier Guest Check-in System
 * Consistent spacing, colors, and visual hierarchy tokens
 */

// Spacing Scale
export const spacing = {
  // List item spacing
  listItem: {
    padding: "py-4 px-0", // Standard list item padding
    paddingCompact: "py-3 px-0", // Compact list item padding
    paddingLarge: "py-6 px-0", // Large list item padding
    gap: "gap-3", // Standard gap between list elements
    gapCompact: "gap-2", // Compact gap between list elements
    gapLarge: "gap-4", // Large gap between list elements
  },
  
  // Card spacing
  card: {
    padding: "p-6", // Standard card padding
    paddingCompact: "p-4", // Compact card padding
    paddingDense: "p-3", // Dense card padding
    gap: "gap-6", // Standard gap between card elements
    gapCompact: "gap-4", // Compact gap between card elements
    gapDense: "gap-3", // Dense gap between card elements
  },
  
  // Table spacing
  table: {
    cellPadding: "px-4 py-3", // Standard table cell padding
    headerPadding: "px-4 py-4", // Table header padding
    headerHeight: "h-12", // Table header height
    rowHeight: "h-auto", // Auto row height for content
  },
  
  // Grid spacing
  grid: {
    gap: "gap-4", // Standard grid gap
    gapLarge: "gap-6", // Large grid gap
    gapCompact: "gap-3", // Compact grid gap
  },
  
  // Search component spacing
  search: {
    containerPadding: "py-3 px-0", // Search container padding
    elementGap: "gap-4", // Gap between search elements
    resultsPadding: "py-4", // Padding for search results
    resultsMargin: "mt-6", // Margin before search results
  },
  
  // Data list spacing for better scannability
  dataList: {
    itemPadding: "py-4 px-5", // Generous padding for data items
    itemPaddingCompact: "py-3 px-4", // Compact data item padding
    itemGap: "gap-1", // Gap between data list items
    itemGapLarge: "gap-2", // Larger gap for emphasis
    dividerColor: "border-border/50", // Subtle divider color
    alternateRow: "even:bg-muted/30", // Alternating row backgrounds
  },
  
  // Section spacing
  section: {
    marginBottom: "mb-8", // Bottom margin between sections
    paddingY: "py-6", // Vertical padding for sections
    gap: "space-y-8", // Gap between major sections
  }
} as const

// Color Tokens for Better Visual Hierarchy
export const colors = {
  // Status colors with consistent opacity levels
  status: {
    success: {
      bg: "bg-green-500/15 dark:bg-green-500/25",
      text: "text-green-800 dark:text-green-300",
      border: "border-green-500/30 dark:border-green-500/40",
      icon: "text-green-700 dark:text-green-400",
      shadow: "shadow-green-500/10",
      ring: "ring-green-500/20"
    },
    warning: {
      bg: "bg-amber-500/15 dark:bg-amber-500/25", 
      text: "text-amber-800 dark:text-amber-300",
      border: "border-amber-500/30 dark:border-amber-500/40",
      icon: "text-amber-700 dark:text-amber-400",
      shadow: "shadow-amber-500/10",
      ring: "ring-amber-500/20"
    },
    error: {
      bg: "bg-red-500/15 dark:bg-red-500/25",
      text: "text-red-800 dark:text-red-300", 
      border: "border-red-500/30 dark:border-red-500/40",
      icon: "text-red-700 dark:text-red-400",
      shadow: "shadow-red-500/10",
      ring: "ring-red-500/20"
    },
    info: {
      bg: "bg-blue-500/15 dark:bg-blue-500/25",
      text: "text-blue-800 dark:text-blue-300",
      border: "border-blue-500/30 dark:border-blue-500/40", 
      icon: "text-blue-700 dark:text-blue-400",
      shadow: "shadow-blue-500/10",
      ring: "ring-blue-500/20"
    },
    neutral: {
      bg: "bg-muted",
      text: "text-muted-foreground",
      border: "border-border",
      icon: "text-muted-foreground",
      shadow: "shadow-sm",
      ring: "ring-border"
    }
  },
  
  // Interactive states
  interactive: {
    hover: "hover:bg-muted/50",
    hoverStrong: "hover:bg-muted/70",
    focus: "focus:ring-2 focus:ring-primary/20 focus:border-primary",
    active: "active:bg-muted/80",
    disabled: "disabled:opacity-50 disabled:cursor-not-allowed"
  },
  
  // Background layers
  background: {
    page: "bg-background",
    card: "bg-card", 
    muted: "bg-muted/20",
    mutedStrong: "bg-muted/50",
    accent: "bg-accent/10"
  },
  
  // Border variants
  border: {
    default: "border-border",
    muted: "border-border/50",
    strong: "border-border",
    accent: "border-primary/20"
  }
} as const

// Typography Scale
export const typography = {
  // List item typography
  listItem: {
    title: "font-semibold text-foreground",
    titleLarge: "text-lg font-semibold text-foreground",
    description: "text-sm text-muted-foreground",
    meta: "text-xs text-muted-foreground"
  },
  
  // Badge typography
  badge: {
    default: "text-sm font-medium",
    compact: "text-xs font-medium", 
    strong: "text-sm font-semibold",
    emphasis: "text-sm font-bold"
  },
  
  // Table typography
  table: {
    header: "font-semibold text-muted-foreground",
    cell: "text-sm",
    cellStrong: "font-medium text-foreground"
  }
} as const

// Animation and Transition Tokens
export const animation = {
  // Standard transitions
  transition: "transition-colors duration-200",
  transitionAll: "transition-all duration-200",
  transitionSlow: "transition-all duration-300",
  
  // Hover effects
  hoverScale: "hover:scale-[1.01]",
  hoverScaleStrong: "hover:scale-[1.02]",
  hoverShadow: "hover:shadow-md",
  hoverShadowStrong: "hover:shadow-lg",
  
  // Loading states
  pulse: "animate-pulse",
  spin: "animate-spin"
} as const

// Border Radius Scale
export const radius = {
  small: "rounded-md",
  default: "rounded-lg", 
  large: "rounded-xl",
  full: "rounded-full",
  
  // Specific use cases
  card: "rounded-xl",
  button: "rounded-lg",
  badge: "rounded-full",
  input: "rounded-lg",
  table: "rounded-lg"
} as const

// Shadow Scale
export const shadow = {
  none: "shadow-none",
  sm: "shadow-sm",
  default: "shadow-md",
  lg: "shadow-lg",
  xl: "shadow-xl",
  
  // Colored shadows for states
  success: "shadow-green-500/10",
  warning: "shadow-amber-500/10", 
  error: "shadow-red-500/10",
  info: "shadow-blue-500/10"
} as const

// Helper function to combine multiple design tokens
export function combineTokens(...tokens: (string | undefined)[]): string {
  return tokens.filter(Boolean).join(" ")
}

// Common component patterns
export const patterns = {
  // Interactive card pattern
  interactiveCard: combineTokens(
    colors.background.card,
    colors.border.default,
    radius.card,
    shadow.default,
    animation.transitionAll,
    animation.hoverScale,
    animation.hoverShadow
  ),
  
  // List item pattern
  listItem: combineTokens(
    spacing.listItem.padding,
    spacing.listItem.gap,
    animation.transition,
    colors.interactive.hover
  ),
  
  // Status badge pattern  
  statusBadge: combineTokens(
    typography.badge.strong,
    radius.badge,
    shadow.sm,
    "px-3 py-1.5"
  ),
  
  // Table row pattern
  tableRow: combineTokens(
    spacing.table.cellPadding,
    animation.transition,
    colors.interactive.hover,
    "border-b border-border"
  )
} as const