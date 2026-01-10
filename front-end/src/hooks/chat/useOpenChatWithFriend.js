import { useCallback } from "react";
import { ChatAPI } from "../../api/chat.api.js";
import { mapConversationsToChats } from "../../utils/chat/chatMappers.js";
import { getErrMsg } from "../../utils/chat/chatPageHelpers.js";
import { avatarFromName, formatTimeOrDate } from "../../utils/chatUi.js";

export function useOpenChatWithFriend({
  meId,
  chats,
  setChats,
  setActiveChatId,
  setTab,
  onlineIdsRef,
}) {
  return useCallback(
    async (friendId) => {
      const fid = String(friendId || "");
      if (!fid) return;

      const existed = chats.find((c) => String(c.otherUserId || "") === fid);
      if (existed) {
        setActiveChatId(existed.id);
        setTab("chats");

        // reset unread thôi (KHÔNG bump)
        setChats((prev) =>
          prev.map((c) =>
            c.id === String(existed.id) ? { ...c, unread: 0 } : c
          )
        );
        return;
      }

      try {
        const res = await ChatAPI.createOrGetDirect(fid);
        const newConvoId =
          res.data?.conversation?.id ||
          res.data?.conversationId ||
          res.data?.id;

        const convosRes = await ChatAPI.listConversations();
        const convos = convosRes.data?.conversations ?? [];

        const onlineNow = new Set((onlineIdsRef.current || []).map(String));
        const mapped = mapConversationsToChats({
          convos,
          meId,
          onlineIdsSet: onlineNow,
          avatarFromName,
          formatTimeOrDate,
        });

        setChats(mapped);

        if (newConvoId) {
          const id = String(newConvoId);
          setActiveChatId(id);
          setTab("chats");

          // reset unread (nếu có)
          setChats((prev) =>
            prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c))
          );
        }
      } catch (e) {
        console.error(e);
        alert(getErrMsg(e));
      }
    },
    [meId, chats, setActiveChatId, setChats, setTab, onlineIdsRef]
  );
}
