export async function submitCartAction(input: Record<string, string>) {
  const body = new FormData();

  for (const [key, value] of Object.entries(input)) {
    body.set(key, value);
  }

  try {
    const response = await fetch("/api/cart", {
      body,
      headers: {
        Accept: "application/json",
        "x-cart-request": "ajax"
      },
      method: "POST"
    });
    const data = await response.json() as { message?: string; ok?: boolean };

    return {
      ok: Boolean(data.ok) && response.ok,
      message: data.message ?? "Cart update failed."
    };
  } catch {
    return {
      ok: false,
      message: "Cart update failed. Please try again."
    };
  }
}

export function notifyCartUpdated() {
  window.dispatchEvent(new CustomEvent("dash-cart-updated"));
}
