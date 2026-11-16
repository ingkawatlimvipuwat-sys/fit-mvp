import type { ComponentProps } from 'react';

/** A file input with a quiet button-like "choose" part. Put it inside the caller's own <label>. */
export default function FileInput({ className = '', ...rest }: Omit<ComponentProps<'input'>, 'type'>) {
  return (
    <input
      type="file"
      className={`mt-1 block w-full min-w-0 text-sm text-ink file:mr-3 file:min-h-[44px] file:cursor-pointer file:rounded-[10px] file:border file:border-control file:bg-surface file:px-4 file:text-sm file:font-medium file:text-ink hover:file:bg-page ${className}`}
      {...rest}
    />
  );
}
