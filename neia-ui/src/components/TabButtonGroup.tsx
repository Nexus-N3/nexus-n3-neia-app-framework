type Option<T extends string> = {
  label: string;
  value: T;
};

type TabButtonGroupProps<T extends string> = {
  activeValue: T;
  ariaLabel: string;
  className?: string;
  options: Option<T>[];
  onSelect: (value: T) => void;
};

export function TabButtonGroup<T extends string>({
  activeValue,
  ariaLabel,
  className = "category-tabs",
  options,
  onSelect,
}: TabButtonGroupProps<T>) {
  return (
    <div className={className} role="tablist" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          className={activeValue === option.value ? "tab active" : "tab"}
          onClick={() => onSelect(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
