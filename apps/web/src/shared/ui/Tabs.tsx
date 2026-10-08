interface Tab<Id extends string> {
  id: Id;
  label: string;
}

interface TabsProps<Id extends string> {
  label: string;
  tabs: readonly Tab<Id>[];
  value: Id;
  onChange: (id: Id) => void;
}

/** Segmented control: the active segment is a white plate with an outline and no shadow. */
export function Tabs<Id extends string>({ label, tabs, value, onChange }: TabsProps<Id>) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 rounded-[16px] bg-surface-2 p-1">
      {tabs.map((tab) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={`h-11 min-w-0 flex-1 rounded-[12px] border-2 px-1 text-[14px] font-extrabold tablet:text-[16px] ${
              selected
                ? 'border-edge bg-surface text-text'
                : 'border-transparent bg-transparent text-text-2'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
