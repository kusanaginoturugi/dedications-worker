export const formDefinitions = {
  wish_fulfillment_staff: {
    label: "八大明王如意棒",
    plainLabel: "八大明王如意棒",
    unitPrice: 2000,
    refundUnit: 800,
    mirokuUnit: 1200,
    reportLabel: "明王如意棒",
  },
  sankai_ryuge_pillar: {
    label: "三會龍華\n之御柱",
    plainLabel: "三會龍華之御柱",
    unitPrice: 500,
    refundUnit: 150,
    mirokuUnit: 350,
    reportLabel: "三會龍華\n之御柱",
  },
  sanki_reiboku: {
    label: "三期滅劫\n之霊木",
    plainLabel: "三期滅劫之霊木",
    unitPrice: 800,
    refundUnit: 100,
    mirokuUnit: 700,
    reportLabel: "三期滅劫\n之霊木",
  },
} as const;

export type FormType = keyof typeof formDefinitions;

export function isFormType(value: string): value is FormType {
  return value in formDefinitions;
}

export function totalQuantity(row: {
  serial_number_start: number | null;
  serial_number_end: number | null;
}): number | null {
  if (row.serial_number_start == null || row.serial_number_end == null) return null;
  return row.serial_number_end - row.serial_number_start + 1;
}

export function totalAmount(row: {
  form_type: string;
  serial_number_start: number | null;
  serial_number_end: number | null;
}): number | null {
  if (!isFormType(row.form_type)) return null;
  const quantity = totalQuantity(row);
  return quantity == null ? null : quantity * formDefinitions[row.form_type].unitPrice;
}
