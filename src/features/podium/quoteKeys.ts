/** El `search_id` y el perfil (`preferenceKey`) forman la query key del podio. */
export const quoteKeys = {
  podium: (searchId: string, preferenceKey: string) => ['quotes', searchId, preferenceKey] as const,
};
