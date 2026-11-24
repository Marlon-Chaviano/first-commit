import { useId } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";

export function BrandPrivacy({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  const id = useId();
  return (
    <Field orientation="horizontal">
      <Checkbox id={id} checked={checked} onCheckedChange={onChange} aria-describedby={id + "-hint"} />
      <FieldContent>
        <FieldLabel htmlFor={id} lang="es">Hacer privada</FieldLabel>
        <FieldDescription id={id + "-hint"}>
          {checked ? "Only the owner or members of the owning organization can use this profile." :
            "Anyone can find and use this profile, including its assets, rules and documentation."}
        </FieldDescription>
      </FieldContent>
    </Field>
  );
}
