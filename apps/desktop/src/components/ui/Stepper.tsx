import { Check } from "lucide-react";
import { Fragment } from "react";

function circleClass(index: number, current: number): string {
  if (index === current) return "bg-blue-700 text-white";
  if (index < current) return "bg-blue-50 text-blue-700";
  return "bg-slate-100 text-slate-500";
}

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-4">
      {steps.map((step, i) => (
        <Fragment key={step}>
          {i > 0 && <li aria-hidden className="h-px flex-1 bg-slate-200" />}
          <li className="flex items-center gap-3 text-sm">
            <span
              className={`grid size-8 place-items-center rounded-full text-sm font-medium ${circleClass(i, current)}`}
            >
              {i + 1}
            </span>
            <span className={i === current ? "font-semibold" : "text-slate-600"}>{step}</span>
            {i < current && <Check size={16} className="text-green-600" />}
          </li>
        </Fragment>
      ))}
    </ol>
  );
}
