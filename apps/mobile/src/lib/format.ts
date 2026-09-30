const eventDateTime = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatEventDate(value: string): string {
  return eventDateTime.format(new Date(value));
}

export function formatPrice(price: string): string {
  return price === "0" ? "Free" : `${price} minor units`;
}
