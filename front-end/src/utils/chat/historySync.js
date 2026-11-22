// Read back to the oldest cached cursor, including every page of a reconnect gap.
export async function fetchHistoryWindow(fetchPage, previous, isCurrent = () => true) {
  let cursor = {};
  let data;
  const messages = [];
  do {
    data = await fetchPage({ limit: 100, ...cursor });
    if (!isCurrent()) return null;
    messages.push(...data.messages);
    cursor = { before: data.nextBefore, beforeId: data.nextBeforeId };
  } while (data.hasMore && previous?.nextBefore && data.messages.length &&
    (new Date(data.nextBefore) > new Date(previous.nextBefore) ||
      (new Date(data.nextBefore).getTime() === new Date(previous.nextBefore).getTime() &&
        String(data.nextBeforeId) > String(previous.nextBeforeId))));
  return { ...data, messages };
}
