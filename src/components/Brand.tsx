import logo from "../assets/gsic-logo.png";

// GSIC wordmark with the app name beside it, used in every page header.
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={"brand" + (compact ? " brand-compact" : "")}>
      <img src={logo} alt="Georgia Social Impact Collaborative" />
      <span className="brand-title">Collaborative Brainstorming Boards</span>
    </div>
  );
}
