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
    accountType: row.account_type ?? 'individual',
    currentOrgId: row.current_org_id ?? null,
    avgRating: stats.avgRating ?? null,
    ratingCount: stats.ratingCount ?? 0,
  };
}

export function toOrganization(row, extra = {}) {
  if (!row) return null;
  return {
    _id: row.id,
    name: row.name,
    slug: row.slug,
    type: row.type,
    kybStatus: row.kyb_status,
    taxId: row.tax_id ?? null,
    billingAddress: row.billing_address ?? null,
    logoUrl: row.logo_url ?? null,
    coverUrl: row.cover_url ?? null,
    bio: row.bio ?? null,
    website: row.website ?? null,
    supportEmail: row.support_email ?? null,
    // Phone lives inside billing_address.phone since organizations has no
    // dedicated phone column; surfaced here for convenience.
    phone: row.billing_address?.phone ?? null,
    memberCount: extra.memberCount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toStorefront(row, org) {
  return {
    slug: row?.slug ?? org?.slug ?? null,
    theme: row?.theme ?? {},
    seo: row?.seo ?? {},
    policies: row?.policies ?? {},
  };
}

export function toOrgMember(row, user) {
  if (!row) return null;
  return {
    orgId: row.org_id,
    userId: row.user_id,
    role: row.role,
    invitedAt: row.invited_at,
    acceptedAt: row.accepted_at ?? null,
    status: row.accepted_at ? 'accepted' : 'pending',
    user: user ? toUserPublic(user) : null,
    email: user?.email ?? null,
  };
}

export function toInvitation(row, user) {
  if (!row) return null;
  return {
    orgId: row.org_id,
    userId: row.user_id,
    role: row.role,
    invitedAt: row.invited_at,
    user: user ? toUserPublic(user) : null,
    email: user?.email ?? null,
  };
}

export function toProduct(row, owner) {
  if (!row) return null;
  const orgRel = row.org && typeof row.org === 'object'
    ? { _id: row.org.id, name: row.org.name, slug: row.org.slug }
    : null;
  const city = row.city ?? null;
  const country = row.country ?? null;
  return {
    _id: row.id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    category: row.category,
    categoryId: row.category_id ?? null,
    condition: row.condition ?? null,
    imageUrl: row.image_url,
    imageUrls: row.image_urls ?? [],
    sold: row.sold,
    status: row.status ?? 'active',
    orgId: row.org_id ?? null,
    org: orgRel,
    ownerId: owner ? toUserPublic(owner) : row.owner_id,
    // Classifieds-side fields (nullable on Pro products).
    pricingMode: row.pricing_mode ?? 'fixed',
    location: (city || country) ? { city, country } : null,
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

export function toBanner(row) {
  if (!row) return null;
  return {
    _id: row.id,
    title: row.title,
    subtitle: row.subtitle ?? null,
    ctaLabel: row.cta_label ?? null,
    ctaUrl: row.cta_url ?? null,
    imageUrl: row.image_url ?? null,
    bgColor: row.bg_color ?? null,
    sortOrder: row.sort_order ?? 0,
    startsAt: row.starts_at ?? null,
    endsAt: row.ends_at ?? null,
  };
}

export function toTile(row) {
  if (!row) return null;
  return {
    _id: row.id,
    label: row.label,
    iconUrl: row.icon_url ?? null,
    targetUrl: row.target_url,
    sortOrder: row.sort_order ?? 0,
  };
}

export function toSubscriptionPlan(row) {
  if (!row) return null;
  return {
    _id: row.id,
    slug: row.slug,
    name: row.name,
    priceMinor: row.price_minor,
    currency: row.currency,
    billingInterval: row.billing_interval,
    features: row.features ?? {},
    sortOrder: row.sort_order ?? 0,
  };
}

export function toAddonService(row) {
  if (!row) return null;
  return {
    _id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? null,
    priceMinor: row.price_minor,
    currency: row.currency,
    type: row.type,
    durationDays: row.duration_days ?? null,
    features: row.features ?? {},
    sortOrder: row.sort_order ?? 0,
  };
}

// Intentionally omits stripe_customer_id / stripe_subscription_id —
// those are server-only and must never leak to the frontend.
export function toOrgSubscription(row) {
  if (!row) return null;
  return {
    status: row.status,
    startedAt: row.started_at,
    currentPeriodEnd: row.current_period_end ?? null,
    cancelAtPeriodEnd: !!row.cancel_at_period_end,
  };
}

export function toOrgAddon(row) {
  if (!row) return null;
  return {
    _id: row.id,
    addonSlug: row.addon_slug,
    status: row.status,
    startedAt: row.started_at,
    endsAt: row.ends_at ?? null,
    productId: row.product_id ?? null,
  };
}
