import {
  forwardRef,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

function joinClassNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export type UiFieldSize = "compact" | "header" | "default";

interface UiFieldStyleProps {
  fieldSize?: UiFieldSize;
}

export const UiInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & UiFieldStyleProps
>(function UiInput({ className, fieldSize = "header", ...props }, ref) {
  return (
    <input
      {...props}
      className={joinClassNames("uiFieldControl", className)}
      data-size={fieldSize}
      ref={ref}
    />
  );
});

export const UiSelect = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & UiFieldStyleProps
>(function UiSelect({ className, fieldSize = "header", ...props }, ref) {
  return (
    <select
      {...props}
      className={joinClassNames("uiFieldControl", className)}
      data-size={fieldSize}
      ref={ref}
    />
  );
});

export const UiTextarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function UiTextarea({ className, ...props }, ref) {
  return <textarea {...props} className={joinClassNames("uiTextarea", className)} ref={ref} />;
});

export interface UiChoiceProps extends LabelHTMLAttributes<HTMLLabelElement> {
  selected?: boolean;
}

export function UiChoice({ className, selected = false, ...props }: UiChoiceProps) {
  return (
    <label
      {...props}
      className={joinClassNames("uiChoice", className)}
      data-selected={selected || undefined}
    />
  );
}
