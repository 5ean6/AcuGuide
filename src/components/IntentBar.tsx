import { ArrowRight, Sparkles } from "lucide-react";
import type { FormEvent } from "react";

type IntentBarProps = {
  value: string;
  placeholder: string;
  actionLabel: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

export function IntentBar({
  value,
  placeholder,
  actionLabel,
  disabled = false,
  onChange,
  onSubmit,
}: IntentBarProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form className="intent-bar" onSubmit={handleSubmit}>
      <div className="intent-inner">
        <label className="intent-label" htmlFor="intent-input">
          <Sparkles size={16} strokeWidth={1.8} aria-hidden="true" />
          症狀 / 目標
        </label>
        <input
          id="intent-input"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="off"
          disabled={disabled}
        />
        <button
          className="primary-action"
          type="submit"
          disabled={disabled}
          data-testid="intent-submit"
        >
          <span>{actionLabel}</span>
          <ArrowRight size={17} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
    </form>
  );
}
