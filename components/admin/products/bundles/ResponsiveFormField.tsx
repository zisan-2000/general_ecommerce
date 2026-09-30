"use client";

import {
  memo,
  startTransition,
  useEffect,
  useState,
  type ComponentProps,
} from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ResponsiveInputProps = Omit<
  ComponentProps<typeof Input>,
  "value" | "defaultValue" | "onChange"
> & {
  value: string;
  onValueChange: (value: string) => void;
};

type ResponsiveTextareaProps = Omit<
  ComponentProps<typeof Textarea>,
  "value" | "defaultValue" | "onChange"
> & {
  value: string;
  onValueChange: (value: string) => void;
};

/**
 * Keeps keystrokes local and immediate while the expensive modal tree updates
 * at transition priority. The authoritative value still lives in the form.
 */
export const ResponsiveInput = memo(function ResponsiveInput({
  value,
  onValueChange,
  onBlur,
  onKeyDown,
  ...props
}: ResponsiveInputProps) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  return (
    <Input
      {...props}
      value={localValue}
      onBlur={(event) => {
        onValueChange(localValue);
        onBlur?.(event);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") onValueChange(localValue);
        onKeyDown?.(event);
      }}
      onChange={(event) => {
        const nextValue = event.target.value;
        setLocalValue(nextValue);
        startTransition(() => onValueChange(nextValue));
      }}
    />
  );
});

export const ResponsiveTextarea = memo(function ResponsiveTextarea({
  value,
  onValueChange,
  onBlur,
  ...props
}: ResponsiveTextareaProps) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  return (
    <Textarea
      {...props}
      value={localValue}
      onBlur={(event) => {
        onValueChange(localValue);
        onBlur?.(event);
      }}
      onChange={(event) => {
        const nextValue = event.target.value;
        setLocalValue(nextValue);
        startTransition(() => onValueChange(nextValue));
      }}
    />
  );
});
