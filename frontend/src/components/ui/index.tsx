import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import * as SelectPrimitive from '@radix-ui/react-select'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'
import { ChevronDown, X, Loader2 } from 'lucide-react'

// ─── Button ───────────────────────────────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'success' | 'warning'
  size?: 'xs' | 'sm' | 'md' | 'lg'
  loading?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => {
    const variants = {
      primary:   'bg-primary-500 text-white hover:bg-primary-600 shadow-orange hover:-translate-y-px',
      secondary: 'bg-teal-400 text-white hover:bg-teal-500 shadow-[0_4px_14px_rgba(61,191,184,.3)] hover:-translate-y-px',
      ghost:     'bg-warm-100 border border-warm-200 text-[--text-mid] hover:bg-primary-100 hover:text-primary-500 hover:border-[--peach]',
      danger:    'bg-red-500 text-white hover:bg-red-600 shadow-[0_4px_14px_rgba(255,82,82,.3)] hover:-translate-y-px',
      outline:   'border-2 border-primary-500 text-primary-500 hover:bg-primary-500 hover:text-white',
      success:   'bg-[--green] text-white hover:opacity-90 hover:-translate-y-px',
      warning:   'bg-[--yellow] text-yellow-900 hover:opacity-90 hover:-translate-y-px',
    }
    const sizes = {
      xs: 'px-3 py-1.5 text-xs rounded-2xl gap-1',
      sm: 'px-4 py-2 text-xs',
      md: 'px-5 py-2.5 text-sm',
      lg: 'px-6 py-3 text-sm',
    }
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-full font-bold transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-1',
          'disabled:opacity-45 disabled:cursor-not-allowed disabled:pointer-events-none',
          'active:scale-[.97]',
          variants[variant], sizes[size], className
        )}
        {...props}
      >
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'

// ─── Input ────────────────────────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-bold" style={{ color: 'var(--text-mid)' }}>
            {label}
            {props.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full px-3.5 py-2.5 text-sm rounded-xl border-[1.5px] border-warm-200 bg-warm-100 font-semibold',
            'placeholder:text-[--text-soft] placeholder:font-medium',
            'text-[--text-dark]',
            'focus:outline-none focus:border-primary-500 focus:bg-white focus:shadow-[0_0_0_3px_rgba(255,122,61,.12)]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-all duration-200',
            error && 'border-red-400 focus:shadow-[0_0_0_3px_rgba(255,82,82,.1)]',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs font-semibold text-red-500">⚠️ {error}</p>}
        {hint && !error && <p className="text-xs font-medium" style={{ color: 'var(--text-soft)' }}>{hint}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'

// ─── Textarea ─────────────────────────────────────────────────────────────────
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-bold" style={{ color: 'var(--text-mid)' }}>
            {label}
            {props.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          rows={3}
          className={cn(
            'w-full px-3.5 py-2.5 text-sm rounded-xl border-[1.5px] border-warm-200 bg-warm-100 font-semibold resize-y',
            'placeholder:text-[--text-soft] placeholder:font-medium text-[--text-dark]',
            'focus:outline-none focus:border-primary-500 focus:bg-white focus:shadow-[0_0_0_3px_rgba(255,122,61,.12)]',
            'transition-all duration-200',
            error && 'border-red-400',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs font-semibold text-red-500">{error}</p>}
      </div>
    )
  }
)
Textarea.displayName = 'Textarea'

// ─── Select ───────────────────────────────────────────────────────────────────
interface SelectProps {
  label?: string
  error?: string
  placeholder?: string
  value?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
  required?: boolean
}

export function Select({ label, error, placeholder, value, onValueChange, children, required }: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-bold" style={{ color: 'var(--text-mid)' }}>
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
        <SelectPrimitive.Trigger
          className={cn(
            'flex w-full items-center justify-between px-3.5 py-2.5 text-sm rounded-xl',
            'border-[1.5px] border-warm-200 bg-warm-100 font-semibold text-[--text-dark]',
            'focus:outline-none focus:border-primary-500 focus:shadow-[0_0_0_3px_rgba(255,122,61,.12)]',
            'data-[placeholder]:text-[--text-soft] cursor-pointer',
            'transition-all duration-200',
            error && 'border-red-400'
          )}
        >
          <SelectPrimitive.Value placeholder={placeholder ?? 'Pilih...'} />
          <ChevronDown className="w-4 h-4 shrink-0" style={{ color: 'var(--text-soft)' }} />
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content className="z-50 min-w-[8rem] overflow-hidden rounded-xl border-[1.5px] border-warm-200 bg-white shadow-card-md animate-in fade-in-0 zoom-in-95">
            <SelectPrimitive.Viewport className="p-1.5">
              {children}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
      {error && <p className="text-xs font-semibold text-red-500">{error}</p>}
    </div>
  )
}

export function SelectItem({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <SelectPrimitive.Item
      value={value}
      className="relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2 text-sm font-semibold text-[--text-mid] outline-none hover:bg-primary-100 hover:text-primary-600 data-[highlighted]:bg-primary-100 data-[highlighted]:text-primary-600"
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

// ─── Dialog / Modal ───────────────────────────────────────────────────────────
export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger

interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  title: string
  description?: string
  footer?: React.ReactNode
}

export function DialogContent({ title, description, children, footer, className, ...props }: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[rgba(45,27,14,.35)] backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
          'w-full max-w-lg bg-white rounded-2xl shadow-card-lg border-[1.5px] border-warm-200',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          'max-h-[90vh] overflow-y-auto',
          className
        )}
        {...props}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-0">
          <div>
            <DialogPrimitive.Title className="font-display font-extrabold text-lg" style={{ color: 'var(--text-dark)' }}>
              {title}
            </DialogPrimitive.Title>
            {description && (
              <DialogPrimitive.Description className="text-xs font-medium mt-0.5" style={{ color: 'var(--text-soft)' }}>
                {description}
              </DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close
            className="w-8 h-8 rounded-full flex items-center justify-center border-[1.5px] border-warm-200 bg-warm-100 transition-all hover:bg-red-50 hover:text-red-500 hover:border-red-300"
            style={{ color: 'var(--text-soft)' }}
          >
            <X className="w-3.5 h-3.5" />
          </DialogPrimitive.Close>
        </div>
        {/* Body */}
        <div className="px-6 py-5">{children}</div>
        {/* Footer */}
        {footer && (
          <div className="px-6 pb-6 flex gap-2.5 justify-end border-t border-warm-200 pt-4">
            {footer}
          </div>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
export const Tabs = TabsPrimitive.Root

export function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <TabsPrimitive.List className={cn('flex gap-0 border-b-2 border-warm-200', className)}>
      {children}
    </TabsPrimitive.List>
  )
}

export function TabsTrigger({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <TabsPrimitive.Trigger
      value={value}
      className="px-4 py-2.5 text-sm font-bold border-b-[2.5px] border-transparent -mb-[2px] transition-all
                 data-[state=active]:text-primary-500 data-[state=active]:border-primary-500"
      style={{ color: 'var(--text-soft)' } as React.CSSProperties}
    >
      {children}
    </TabsPrimitive.Trigger>
  )
}

export const TabsContent = TabsPrimitive.Content

// ─── Badge ────────────────────────────────────────────────────────────────────
type BadgeVariant =
  | 'green' | 'yellow' | 'red' | 'blue' | 'gray' | 'orange'
  | 'teal'  | 'pink'   | 'purple' | 'dark'

export function Badge({ children, variant = 'gray' }: { children: React.ReactNode; variant?: BadgeVariant }) {
  const styles: Record<BadgeVariant, React.CSSProperties> = {
    orange: { background: 'var(--orange-lt)', color: 'var(--orange)' },
    teal:   { background: 'var(--teal-lt)',   color: 'var(--teal)'   },
    yellow: { background: 'var(--yellow-lt)', color: '#C98A00'       },
    pink:   { background: 'var(--pink-lt)',   color: 'var(--pink)'   },
    purple: { background: 'var(--purple-lt)', color: 'var(--purple)' },
    green:  { background: 'var(--green-lt)',  color: 'var(--green)'  },
    red:    { background: 'var(--red-lt)',    color: 'var(--red)'    },
    blue:   { background: 'var(--blue-lt)',   color: 'var(--blue)'   },
    gray:   { background: 'var(--warm-bg)',   color: 'var(--text-soft)' },
    dark:   { background: 'var(--text-dark)', color: '#fff'          },
  }
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold whitespace-nowrap"
      style={styles[variant]}
    >
      {children}
    </span>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center gap-2">
      {icon && <div className="text-5xl mb-1">{icon}</div>}
      <p className="font-display font-extrabold text-base" style={{ color: 'var(--text-dark)' }}>{title}</p>
      {description && (
        <p className="text-sm font-medium max-w-xs leading-relaxed" style={{ color: 'var(--text-soft)' }}>
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn('rounded-full border-[3px] border-warm-200 border-t-primary-500 animate-spin', className ?? 'w-8 h-8')}
    />
  )
}

// ─── Alert ────────────────────────────────────────────────────────────────────
type AlertVariant = 'warning' | 'danger' | 'success' | 'info' | 'neutral'

export function Alert({
  variant = 'neutral',
  icon,
  title,
  children,
  onClose,
}: {
  variant?: AlertVariant
  icon?: string
  title?: string
  children?: React.ReactNode
  onClose?: () => void
}) {
  const styles: Record<AlertVariant, React.CSSProperties> = {
    warning: { background: 'var(--yellow-lt)', borderColor: 'var(--yellow)' },
    danger:  { background: 'var(--red-lt)',    borderColor: 'var(--red)'    },
    success: { background: 'var(--green-lt)',  borderColor: 'var(--green)'  },
    info:    { background: 'var(--blue-lt)',   borderColor: 'var(--blue)'   },
    neutral: { background: 'var(--warm-bg)',   borderColor: 'var(--peach)'  },
  }
  return (
    <div
      className="flex gap-3 items-start px-4 py-3.5 rounded-xl border-l-4"
      style={styles[variant]}
    >
      {icon && <span className="text-xl flex-shrink-0 mt-0.5">{icon}</span>}
      <div className="flex-1 min-w-0">
        {title && <p className="text-sm font-extrabold" style={{ color: 'var(--text-dark)' }}>{title}</p>}
        {children && <div className="text-xs font-medium mt-0.5" style={{ color: 'var(--text-mid)' }}>{children}</div>}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="text-sm flex-shrink-0 transition-colors"
          style={{ color: 'var(--text-soft)' }}
        >
          ✕
        </button>
      )}
    </div>
  )
}
