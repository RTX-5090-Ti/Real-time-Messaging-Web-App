import { sendChatMessage, mutateChatMessage } from "../services/message.service.js";

export function registerMessageHandlers(socket, on, typing) {
  for (const action of ["edit", "recall", "pin", "react"]) {
    on(`message:${action}`, async (payload, ack) => {
      const message = await mutateChatMessage(socket.user.id, action, payload);
      ack({ ok: true, message });
    });
  }
  on("message:send", async (payload, ack) => {
    const message = await sendChatMessage(socket.user.id, payload);
    typing.stop(message.conversationId, socket);
    ack({ ok: true, id: message.id, createdAt: message.createdAt, message });
  });
}
