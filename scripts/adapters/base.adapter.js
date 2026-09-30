export function normalizeProduct(rawItem, providerName) {
  return {
    id: `${providerName}-${rawItem.id || rawItem.productId}`,
    title: rawItem.title || rawItem.name,
    price: rawItem.price,
    currency: rawItem.currency || "USD",
    url: rawItem.affiliateUrl || rawItem.url,
    image: rawItem.imageUrl || rawItem.image,
    provider: providerName,
    isGlobal: true
  };
}
