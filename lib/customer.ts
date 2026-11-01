import { isObject, readItem, removeItem, writeItem } from "@/lib/storage";

// Name, phone and address remembered on this phone for repeat orders.
export type CustomerDetails = {
  name: string;
  phone: string;
  society: string;
  tower: string;
  flatNumber: string;
  landmark: string;
};

const STORAGE_KEY = "xu-noodles-customer-v2";
const OLD_KEY = "xu-noodles-customer-v1"; // old address format; only name and phone carry over

export const emptyCustomer: CustomerDetails = { name: "", phone: "", society: "", tower: "", flatNumber: "", landmark: "" };

// Text fields only; anything else (numbers, objects, very long text) is treated as missing.
const text = (v: unknown, max = 200) => (typeof v === "string" && v.length <= max ? v : "");

function checkCustomer(v: unknown): CustomerDetails | null {
  if (!isObject(v)) return null;
  const details: CustomerDetails = {
    name: text(v.name, 80),
    phone: /^\d{10}$/.test(text(v.phone)) ? text(v.phone) : "",
    society: text(v.society, 100),
    tower: text(v.tower, 100),
    flatNumber: text(v.flatNumber, 50),
    landmark: text(v.landmark),
  };
  return Object.values(details).some(Boolean) ? details : null;
}

// Returns the saved details and whether the address is complete enough to reuse as-is.
export function getSavedCustomer(): { details: CustomerDetails; complete: boolean } | null {
  const details = readItem(STORAGE_KEY, checkCustomer);
  if (details) {
    const complete = !!(details.name && details.phone && details.society && details.tower && details.flatNumber);
    return { details, complete };
  }
  // Old address format: only name and phone carry over.
  const old = readItem(OLD_KEY, checkCustomer);
  if (old) return { details: { ...emptyCustomer, name: old.name, phone: old.phone }, complete: false };
  return null;
}

export function saveCustomer(details: CustomerDetails) {
  writeItem(STORAGE_KEY, details);
  removeItem(OLD_KEY);
}
