export const getGooglePhoto = user =>
  user?.providerData?.find(provider => provider.providerId === 'google.com')?.photoURL ||
  user?.photoURL ||
  null

export function getLinkedPlayerPhoto(playerId, links, user) {
  if (links[user?.uid]?.playerId === playerId && getGooglePhoto(user)) return getGooglePhoto(user)
  const candidates = Object.values(links || {})
    .filter(link => link.playerId === playerId && (link.userPhoto || link.odedByPhoto))
    .sort((a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0))
  return candidates[0]?.userPhoto || candidates[0]?.odedByPhoto || null
}
