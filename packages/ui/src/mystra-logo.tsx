export interface MystraLogoProps { className?: string; title?: string }
export function MystraLogo({ className, title }: MystraLogoProps) {
  return (
    <svg aria-hidden={title ? undefined : true} aria-label={title} className={className ? `mystraLogo ${className}` : "mystraLogo"} focusable="false" role={title ? "img" : undefined} viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
      {title ? <title>{title}</title> : null}
      <rect className="mystraLogoSurface" height="1024" width="1024" rx="228" />
      <g className="mystraLogoSeams" fill="none" strokeLinecap="butt" strokeWidth="48"><path d="M -64 -64 L 512 512" /><path d="M 1088 -64 L 512 512" /><path d="M 1088 1088 L 512 512" /><path d="M -64 1088 L 512 512" /></g>
      <rect className="mystraLogoForeground" height="328" rx="80" width="328" x="348" y="348" />
      <rect className="mystraLogoSurface" height="232" rx="32" width="232" x="396" y="396" />
    </svg>
  );
}
