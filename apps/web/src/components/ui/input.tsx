import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

// `block` matters: inputs are inline-block by default, so a narrow one (max-w-32
// on a settings field) sits on the same line as its own label and the two
// collide. Full-width inputs hid this because they filled the line anyway.
const field =
  'block w-full rounded-[4px] border border-line-strong bg-elevated px-2 text-body text-fg placeholder:text-fg-subtle focus:border-accent focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-risk-critical';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(field, 'h-7', className)} {...props} />
  ),
);
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(field, 'min-h-16 resize-y py-1.5', className)} {...props} />
  ),
);
Textarea.displayName = 'Textarea';
