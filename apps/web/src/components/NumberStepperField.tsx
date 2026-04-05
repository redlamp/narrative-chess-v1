import { Minus, Plus } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText
} from "@/components/ui/input-group";

type NumberStepperFieldProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
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
  unit,
  onChange
}: NumberStepperFieldProps) {
  const displayValue = unit ? `${value}${unit}` : String(value);

  const updateValue = (nextValue: number) => {
    onChange(snapToStep(nextValue, min, max, step));
  };

  return (
    <label className="slider-field">
      <div className="slider-field__header">
        <span>{label}</span>
        <strong>{displayValue}</strong>
      </div>
      <InputGroup className="stepper-field">
        <InputGroupInput
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
        {unit ? (
          <InputGroupAddon align="inline-end">
            <InputGroupText>{unit}</InputGroupText>
          </InputGroupAddon>
        ) : null}
        <InputGroupAddon align="inline-end" className="stepper-field__buttons">
          <InputGroupButton
            variant="ghost"
            size="icon-xs"
            onClick={() => updateValue(value + step)}
            disabled={value >= max}
            aria-label={`Increase ${label.toLowerCase()}`}
          >
            <Plus data-icon="inline-start" />
          </InputGroupButton>
          <InputGroupButton
            variant="ghost"
            size="icon-xs"
            onClick={() => updateValue(value - step)}
            disabled={value <= min}
            aria-label={`Decrease ${label.toLowerCase()}`}
          >
            <Minus data-icon="inline-start" />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </label>
  );
}
