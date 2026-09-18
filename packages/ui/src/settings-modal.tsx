import type { ReactNode, Ref } from "react";
import { ShellIcon } from "./icons.js";
import { MystraLogo } from "./mystra-logo.js";
import { VerticalNavItem } from "./navigation.js";
import { UiIconButton, UiButton } from "./ui-actions.js";
import { UiInput } from "./ui-fields.js";
import { UiDialogSurface, UiSurface } from "./ui-surfaces.js";

export type SettingsModalGlyphName =
  | "account"
  | "appearance"
  | "team"
  | "team-members"
  | "integrations";

export interface SettingsModalSection {
  id: string;
  label: string;
  glyph: SettingsModalGlyphName;
}

const GLYPH_PATHS: Record<SettingsModalGlyphName, ReactNode> = {
  account: (
    <>
      <circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5.5 19c.8-3.5 3-5.3 6.5-5.3s5.7 1.8 6.5 5.3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
    </>
  ),
  appearance: (
    <>
      <circle cx="12" cy="12" fill="none" r="8" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 4a8 8 0 0 0 0 16Z" fill="currentColor" opacity=".45" />
    </>
  ),
  team: (
    <>
      <circle cx="9" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="16" cy="9" r="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3.8 18c.7-3.2 2.5-4.8 5.2-4.8s4.5 1.6 5.2 4.8M14 14c2.9 0 4.8 1.3 5.5 4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
    </>
  ),
  "team-members": (
    <>
      <circle cx="9" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="16" cy="9" r="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 18c.7-3.1 2.4-4.7 5-4.7s4.3 1.6 5 4.7M14 14c2.8 0 4.6 1.3 5.3 4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
    </>
  ),
  integrations: (
    <path d="M8.5 8.5 5 12l3.5 3.5M15.5 8.5 19 12l-3.5 3.5M14 5l-4 14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
  ),
};

/**
 * Settings navigation glyph shared by production Control Plane and the
 * independent Spec Prototype. Both apps must render these icons from here so
 * the settings surface stays byte-identical across surfaces.
 */
export function SettingsModalGlyph({ name }: { name: SettingsModalGlyphName }) {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
      {GLYPH_PATHS[name]}
    </svg>
  );
}

export interface SettingsModalFrameProps {
  activeSectionId: string;
  backLabel: string;
  children: ReactNode;
  closeLabel: string;
  /** Identity line under the Mystra wordmark. */
  identityDetail: string;
  navLabel: string;
  /** When set, the header renders the back affordance for an open detail pane. */
  onBack?: () => void;
  onClose: () => void;
  onQueryChange: (query: string) => void;
  onSelectSection: (sectionId: string) => void;
  /** Render as a non-modal open dialog. Callers driving `dialogRef` leave this unset and call `showModal()`. */
  open?: boolean;
  query: string;
  searchLabel: string;
  sections: readonly SettingsModalSection[];
  title: string;
  titleId?: string;
  dialogRef?: Ref<HTMLDialogElement>;
}

/**
 * Shared Settings modal frame: dialog surface, navigation rail, search field
 * and content header. Feature code owns only its content pane; it must not
 * re-create this DOM or its icons.
 */
export function SettingsModalFrame({
  activeSectionId,
  backLabel,
  children,
  closeLabel,
  dialogRef,
  identityDetail,
  navLabel,
  onBack,
  onClose,
  onQueryChange,
  onSelectSection,
  open = false,
  query,
  searchLabel,
  sections,
  title,
  titleId = "settings-title",
}: SettingsModalFrameProps) {
  return (
    <dialog
      aria-labelledby={titleId}
      className="settingsModal"
      ref={dialogRef}
      {...(open ? { open: true } : {})}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <UiDialogSurface className="settingsModalLayout">
        <UiSurface as="aside" className="settingsNavigation" variant="ghost">
          <div className="settingsIdentity">
            <MystraLogo className="settingsIdentityMark" />
            <div>
              <strong>Mystra</strong>
              <span>{identityDetail}</span>
            </div>
          </div>

          <label className="settingsSearch">
            <ShellIcon name="search" />
            <span className="srOnly">{searchLabel}</span>
            <UiInput
              autoFocus
              fieldSize="header"
              placeholder={searchLabel}
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.currentTarget.value)}
            />
          </label>

          <div aria-label={navLabel} className="settingsNavList" role="tablist">
            {sections.map((section) => (
              <VerticalNavItem
                active={activeSectionId === section.id}
                ariaLabel={section.label}
                className="settingsNavItem"
                key={section.id}
                onClick={() => onSelectSection(section.id)}
              >
                <span className="settingsNavIcon"><SettingsModalGlyph name={section.glyph} /></span>
                <span>{section.label}</span>
              </VerticalNavItem>
            ))}
            {sections.length === 0 ? <p className="settingsSearchEmpty" role="status">—</p> : null}
          </div>
        </UiSurface>

        <UiSurface as="section" className="settingsContent" variant="ghost">
          <h2 className="srOnly" id={titleId}>{title}</h2>
          <header className="settingsContentHeader">
            <div className="settingsContentTitle">
              {onBack ? (
                <UiButton aria-label={backLabel} size="compact" onClick={onBack}>‹</UiButton>
              ) : null}
              <h3>{title}</h3>
            </div>
            <UiIconButton aria-label={closeLabel} className="settingsCloseButton" onClick={onClose}>
              <ShellIcon name="close" />
            </UiIconButton>
          </header>

          <div
            aria-label={title}
            className="settingsPane scrollableSurface"
            id={`settings-panel-${activeSectionId}`}
            role="tabpanel"
          >
            {children}
          </div>
        </UiSurface>
      </UiDialogSurface>
    </dialog>
  );
}
