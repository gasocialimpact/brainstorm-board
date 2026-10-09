// Full-resolution logo (uploaded to src/), so it stays crisp on any screen.
import logo from "../GSIC Logo - Green - Transparent.png";

// GSIC wordmark with the app name beside it, used in every page header.
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={"brand" + (compact ? " brand-compact" : "")}>
      <img src={logo} alt="Georgia Social Impact Collaborative" />
      <span className="brand-title">Collaborative Brainstorming Boards</span>
    </div>
  );
}
