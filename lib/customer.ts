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

// Returns the saved details and whether the address is complete enough to reuse as-is.
export function getSavedCustomer(): { details: CustomerDetails; complete: boolean } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { details: { ...emptyCustomer, ...(JSON.parse(raw) as Partial<CustomerDetails>) }, complete: true };
    const old = localStorage.getItem(OLD_KEY);
    if (old) {
      const { name = "", phone = "" } = JSON.parse(old) as { name?: string; phone?: string };
      return { details: { ...emptyCustomer, name, phone }, complete: false };
    }
  } catch {
    // Ignore broken or blocked storage.
  }
  return null;
}

export function saveCustomer(details: CustomerDetails) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(details));
    localStorage.removeItem(OLD_KEY);
  } catch {
    // Ignore storage errors (private mode, quota).
  }
}
