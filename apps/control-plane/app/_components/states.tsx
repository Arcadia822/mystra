import { UiText } from "@mystra/ui";

export function PagePlaceholder({ label }: { label: string }) {
  return (
    <section aria-label={label} className="pagePlaceholder" role="status">
      <UiText variant="annotation">{label}</UiText>
    </section>
  );
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div aria-busy="true" aria-label={label} className="statePanel">
      <span className="loadingBar" />
      <span className="loadingBar short" />
      <span className="loadingBar" />
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="statePanel" role="status">
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="statePanel errorState" role="alert">
      <strong>Unable to load this surface</strong>
      <p>{message}</p>
      <button className="secondaryButton" type="button" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}
