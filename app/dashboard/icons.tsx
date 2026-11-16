/** Small inline stroke icons for the dashboard. Decorative: the text next to them carries the meaning. */
type P = { size?: number; className?: string };
const base = (size: number) => ({
  'aria-hidden': true as const, width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
});

export function FolderIcon({ size = 18, className = 'shrink-0' }: P) {
  return <svg {...base(size)} className={className}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>;
}
export function SearchIcon({ size = 18, className = 'shrink-0' }: P) {
  return <svg {...base(size)} className={className}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>;
}
export function WarningIcon({ size = 16, className = 'shrink-0' }: P) {
  return <svg {...base(size)} className={className}><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17v.5" /></svg>;
}
export function LinkIcon({ size = 18, className = 'shrink-0' }: P) {
  return <svg {...base(size)} className={className}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>;
}
export function CheckIcon({ size = 18, className = 'shrink-0' }: P) {
  return <svg {...base(size)} className={className}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
}
export function TagIcon({ size = 18, className = 'shrink-0' }: P) {
  return <svg {...base(size)} className={className}><path d="M3 12V4h8l9 9-8 8z" /><circle cx="7.5" cy="8.5" r="1" /></svg>;
}
export function ChevronLeftIcon({ size = 18, className = 'shrink-0' }: P) {
  return <svg {...base(size)} className={className}><path d="M15 5l-7 7 7 7" /></svg>;
}
export function DotsIcon({ size = 20, className = 'shrink-0' }: P) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}
