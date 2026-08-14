import {
  forwardRef,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { joinClassNames } from "./ui-actions.js";

export type UiFieldSize = "compact" | "header" | "default";
interface UiFieldStyleProps { fieldSize?: UiFieldSize }

export const UiInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & UiFieldStyleProps>(
  function UiInput({ className, fieldSize = "header", ...props }, ref) {
    return <input {...props} className={joinClassNames("uiFieldControl", className)} data-size={fieldSize} ref={ref} />;
  },
);

export const UiSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & UiFieldStyleProps>(
  function UiSelect({ className, fieldSize = "header", ...props }, ref) {
    return <select {...props} className={joinClassNames("uiFieldControl", className)} data-size={fieldSize} ref={ref} />;
  },
);

export const UiTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function UiTextarea({ className, ...props }, ref) {
    return <textarea {...props} className={joinClassNames("uiTextarea", className)} ref={ref} />;
  },
);

export const UiCheckbox = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "type">>(
  function UiCheckbox({ className, ...props }, ref) {
    return (
      <span className={joinClassNames("uiCheckbox", className)}>
        <input {...props} className="uiCheckboxInput" ref={ref} type="checkbox" />
        <span aria-hidden="true" className="uiCheckboxVisual">
          <svg className="uiCheckboxCheckIcon" viewBox="0 0 12 12">
            <path d="m2.5 6 2.2 2.2L9.5 3.5" />
          </svg>
        </span>
      </span>
    );
  },
);

export interface UiChoiceProps extends LabelHTMLAttributes<HTMLLabelElement> { selected?: boolean }
export function UiChoice({ className, selected = false, ...props }: UiChoiceProps) {
  return <label {...props} className={joinClassNames("uiChoice", className)} data-selected={selected || undefined} />;
}
