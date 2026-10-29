// Name, phone and address remembered on this phone for repeat orders.
export type CustomerDetails = {
  name: string;
  phone: string;
  addressLine: string;
  area: string;
  landmark: string;
  pincode: string;
};

const STORAGE_KEY = "xu-noodles-customer-v1";

export const emptyCustomer: CustomerDetails = { name: "", phone: "", addressLine: "", area: "", landmark: "", pincode: "" };

export function getSavedCustomer(): CustomerDetails | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...emptyCustomer, ...(JSON.parse(raw) as Partial<CustomerDetails>) } : null;
  } catch {
    return null;
  }
}

export function saveCustomer(details: CustomerDetails) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(details));
  } catch {
    // Ignore storage errors (private mode, quota).
  }
}
