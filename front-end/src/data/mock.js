export const me = {
  name: "Vuong",
  avatar: "https://i.pravatar.cc/100?img=12",
};

export const chats = [
  {
    id: "c1",
    name: "Design chat",
    members: 23,
    online: 10,
    pinned: true,
    unread: 1,
    lastMessage: "Jessie Rollins sent a photo",
    time: "4m",
    avatar: "https://i.pravatar.cc/100?img=5",
  },
  {
    id: "c2",
    name: "Osman Campos",
    members: 2,
    online: 1,
    pinned: false,
    unread: 0,
    lastMessage: "You: Hey! We are ready…",
    time: "20m",
    avatar: "https://i.pravatar.cc/100?img=13",
  },
  {
    id: "c3",
    name: "Jayden Church",
    members: 2,
    online: 1,
    pinned: false,
    unread: 2,
    lastMessage: "I prepared some varia…",
    time: "1h",
    avatar: "https://i.pravatar.cc/100?img=33",
  },
];

export const friends = [
  {
    id: "f1",
    name: "Tanisha Combs",
    status: "online",
    avatar: "https://i.pravatar.cc/100?img=47",
  },
  {
    id: "f2",
    name: "Alex Hunt",
    status: "offline",
    avatar: "https://i.pravatar.cc/100?img=24",
  },
  {
    id: "f3",
    name: "Jasmin Lowery",
    status: "online",
    avatar: "https://i.pravatar.cc/100?img=44",
  },
  {
    id: "f4",
    name: "Max Padilla",
    status: "offline",
    avatar: "https://i.pravatar.cc/100?img=29",
  },
];

export const messagesByChatId = {
  c1: [
    {
      id: "m1",
      from: "other",
      name: "Jasmin Lowery",
      avatar: "https://i.pravatar.cc/100?img=44",
      text: "I added new flows to our design system. Now you can use them for your projects!",
      time: "09:20",
      reactions: ["👍 4"],
      seen: 23,
    },
    {
      id: "m2",
      from: "other",
      name: "Alex Hunt",
      avatar: "https://i.pravatar.cc/100?img=24",
      text: "Hey guys! Important news!",
      time: "09:24",
      reactions: ["🔥 5", "👍 4"],
      seen: 16,
    },
    {
      id: "m3",
      from: "me",
      name: "You",
      avatar: "https://i.pravatar.cc/100?img=12",
      text: "Jaden, my congratulations! I will be glad to work with you on a new project 😊",
      time: "09:27",
      reactions: ["❤️ 10"],
      seen: 10,
    },
    {
      id: "m4",
      from: "other",
      name: "Jessie Rollins",
      avatar: "https://i.pravatar.cc/100?img=18",
      image:
        "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=900&q=60",
      time: "09:30",
      seen: 10,
    },
    {
      id: "m5",
      from: "other",
      name: "Jessie Rollins",
      avatar: "https://i.pravatar.cc/100?img=18",
      audio: { duration: "0:15" },
      time: "09:30",
      seen: 10,
    },
  ],
  c2: [
    {
      id: "m1",
      from: "other",
      name: "Osman",
      avatar: "https://i.pravatar.cc/100?img=13",
      text: "Hey!",
      time: "11:10",
      seen: 2,
    },
    {
      id: "m2",
      from: "me",
      name: "You",
      avatar: "https://i.pravatar.cc/100?img=12",
      text: "We are ready.",
      time: "11:12",
      seen: 2,
    },
  ],
  c3: [
    {
      id: "m1",
      from: "other",
      name: "Jayden",
      avatar: "https://i.pravatar.cc/100?img=33",
      text: "Can you review my draft?",
      time: "15:01",
      seen: 2,
    },
  ],
};

export const groupInfoMock = {
  files: [
    { label: "photos", count: 265 },
    { label: "videos", count: 13 },
    { label: "files", count: 378 },
    { label: "audio files", count: 21 },
    { label: "shared links", count: 45 },
    { label: "voice messages", count: 2589 },
  ],
  members: [
    {
      id: "u1",
      name: "Tanisha Combs",
      role: "admin",
      avatar: "https://i.pravatar.cc/100?img=47",
    },
    {
      id: "u2",
      name: "Alex Hunt",
      role: "",
      avatar: "https://i.pravatar.cc/100?img=24",
    },
    {
      id: "u3",
      name: "Jasmin Lowery",
      role: "",
      avatar: "https://i.pravatar.cc/100?img=44",
    },
    {
      id: "u4",
      name: "Max Padilla",
      role: "",
      avatar: "https://i.pravatar.cc/100?img=29",
    },
    {
      id: "u5",
      name: "Jessie Rollins",
      role: "",
      avatar: "https://i.pravatar.cc/100?img=18",
    },
    {
      id: "u6",
      name: "Lukas Mcgowan",
      role: "",
      avatar: "https://i.pravatar.cc/100?img=8",
    },
  ],
};
