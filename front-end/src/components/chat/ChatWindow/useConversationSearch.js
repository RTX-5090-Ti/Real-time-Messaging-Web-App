// src/components/chat/ChatWindow/useConversationSearch.js
import { useEffect, useRef, useReducer } from "react";

const initialState = {
  input: "",
  debounced: "",
  matchIds: [],
  matchPos: 0,
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_INPUT":
      return { ...state, input: action.value };

    case "SET_DEBOUNCED":
      return { ...state, debounced: action.value };

    case "SET_MATCHES":
      return {
        ...state,
        matchIds: action.ids,
        matchPos: action.pos,
      };

    case "SET_POS":
      return { ...state, matchPos: action.value };

    case "RESET":
      return initialState;

    default:
      return state;
  }
}

export function useConversationSearch({ isSearchOpen, chatId, messages }) {
  const [s, dispatch] = useReducer(reducer, initialState);
  const searchInputRef = useRef(null);

  // focus khi mở search / đổi chat
  useEffect(() => {
    if (!isSearchOpen) return;
    const raf = requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [isSearchOpen, chatId]);

  // debounce
  useEffect(() => {
    if (!isSearchOpen) return;
    const t = setTimeout(() => {
      dispatch({ type: "SET_DEBOUNCED", value: s.input.trim() });
    }, 500);
    return () => clearTimeout(t);
  }, [s.input, isSearchOpen]);

  // reset khi đóng search
  useEffect(() => {
    if (isSearchOpen) return;
    dispatch({ type: "RESET" });
  }, [isSearchOpen]);

  // reset khi đổi chat
  useEffect(() => {
    dispatch({ type: "RESET" });
  }, [chatId]);

  const searchQuery = isSearchOpen ? s.debounced : "";
  const isSearching = isSearchOpen && s.input.trim() !== s.debounced;

  // compute matches
  useEffect(() => {
    const q = searchQuery.toLowerCase();
    if (!q) {
      dispatch({ type: "SET_MATCHES", ids: [], pos: 0 });
      return;
    }

    const ids = (messages || [])
      .filter((m) =>
        String(m?.text || "")
          .toLowerCase()
          .includes(q)
      )
      .map((m) => m.id);

    dispatch({
      type: "SET_MATCHES",
      ids,
      pos: ids.length ? ids.length - 1 : 0,
    });
  }, [messages, searchQuery]);

  return {
    searchInput: s.input,
    setSearchInput: (v) => dispatch({ type: "SET_INPUT", value: v }),
    debouncedQuery: s.debounced,
    searchQuery,
    isSearching,
    matchIds: s.matchIds,
    matchPos: s.matchPos,
    setMatchPos: (fn) =>
      dispatch({
        type: "SET_POS",
        value: typeof fn === "function" ? fn(s.matchPos) : fn,
      }),
    searchInputRef,
  };
}
