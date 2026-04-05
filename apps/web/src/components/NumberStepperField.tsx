import { Input } from "@/components/ui/input";

type NumberStepperFieldProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function snapToStep(value: number, min: number, max: number, step: number) {
  const snapped = min + Math.round((value - min) / step) * step;
  return clamp(snapped, min, max);
}

export function NumberStepperField({
  label,
  value,
  min,
  max,
  step,
  onChange
}: NumberStepperFieldProps) {
  const updateValue = (nextValue: number) => {
    onChange(snapToStep(nextValue, min, max, step));
  };

  return (
    <label className="stepper-field">
      <span className="field-label stepper-field__label">{label}</span>
      <Input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => {
          const nextValue = Number(event.currentTarget.value);
          if (Number.isFinite(nextValue)) {
            updateValue(nextValue);
          }
        }}
        className="stepper-field__input"
        aria-label={label}
      />
    </label>
  );
}
