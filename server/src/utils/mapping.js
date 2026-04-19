// Converts database rows (snake_case, `id` primary key) into the response
// shape the Angular frontend expects (`_id` everywhere, populated relations
// as nested objects).

export function toUserPublic(row) {
  if (!row) return null;
  return {
    _id: row.id,
    name: row.name,
    avatarUrl: row.avatar_url ?? null,
    createdAt: row.created_at,
  };
}

export function toUserProfile(row, stats = {}) {
  if (!row) return null;
  return {
    ...toUserPublic(row),
    email: row.email,
    emailVerified: row.email_verified,
    avgRating: stats.avgRating ?? null,
    ratingCount: stats.ratingCount ?? 0,
  };
}

export function toProduct(row, owner) {
  if (!row) return null;
  return {
    _id: row.id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    category: row.category,
    condition: row.condition ?? null,
    imageUrl: row.image_url,
    imageUrls: row.image_urls ?? [],
    sold: row.sold,
    ownerId: owner ? toUserPublic(owner) : row.owner_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toOffer(row) {
  if (!row) return null;
  return {
    _id: row.id,
    productId: row.product_id,
    buyerId: row.buyer_id,
    sellerId: row.seller_id,
    amount: Number(row.amount),
    message: row.message ?? null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toMessage(row, offer) {
  if (!row) return null;
  return {
    _id: row.id,
    senderId: row.sender_id,
    recipientId: row.recipient_id,
    productId: row.product_id,
    content: row.content,
    type: row.type,
    offerRef: offer ? toOffer(offer) : null,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export function toRating(row, reviewer) {
  if (!row) return null;
  return {
    _id: row.id,
    sellerId: row.seller_id,
    reviewerId: reviewer ? toUserPublic(reviewer) : row.reviewer_id,
    stars: row.stars,
    comment: row.comment ?? null,
    createdAt: row.created_at,
  };
}

export function toOrder(row) {
  if (!row) return null;
  return {
    _id: row.id,
    buyerId: row.buyer_id,
    items: row.items,
    total: Number(row.total),
    shippingAddress: row.shipping_address,
    status: row.status,
    createdAt: row.created_at,
  };
}
