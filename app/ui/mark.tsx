export default function Mark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="8" y="8" width="24" height="24" />
      <rect x="8" y="8" width="24" height="24" transform="rotate(45 20 20)" />
      <circle cx="20" cy="20" r="4" fill="currentColor" stroke="none" />
    </svg>
  );
}
