"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      richColors
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          // Each kind of toast tinted with its status color: green done, blue info, amber warning, red error.
          "--success-bg": "color-mix(in oklch, var(--success) 12%, var(--popover))",
          "--success-text": "var(--success)",
          "--success-border": "color-mix(in oklch, var(--success) 40%, var(--border))",
          "--info-bg": "color-mix(in oklch, var(--info) 12%, var(--popover))",
          "--info-text": "var(--info)",
          "--info-border": "color-mix(in oklch, var(--info) 40%, var(--border))",
          "--warning-bg": "color-mix(in oklch, var(--warning) 12%, var(--popover))",
          "--warning-text": "var(--warning)",
          "--warning-border": "color-mix(in oklch, var(--warning) 40%, var(--border))",
          "--error-bg": "color-mix(in oklch, var(--destructive) 12%, var(--popover))",
          "--error-text": "var(--destructive)",
          "--error-border": "color-mix(in oklch, var(--destructive) 40%, var(--border))",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
