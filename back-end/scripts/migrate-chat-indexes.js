import "dotenv/config";
import mongoose from "mongoose";
import Conversation from "../src/models/Conversation.js";
import Message from "../src/models/Message.js";
import Upload from "../src/models/Upload.js";

// Explicit migration: only replace the known old index, never sync/drop unrelated indexes.
await mongoose.connect(process.env.MONGO_URI, { autoIndex: false, serverSelectionTimeoutMS: 10000 });
try {
  await Conversation.createCollection();
  await Message.createCollection();
  await Upload.createCollection();
  const duplicates = await Conversation.aggregate([
    { $match: { type: "direct", directKey: { $type: "string" } } },
    { $group: { _id: "$directKey", count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }, { $limit: 1 },
  ]);
  if (duplicates.length) throw new Error("Duplicate direct conversations exist; resolve them before migrating.");
  // Install replacement first so uniqueness remains enforced during migration.
  await Conversation.createIndexes();
  const indexes = await Conversation.collection.indexes();
  for (const index of indexes) {
    if (index.key.type === 1 && index.key.directKey === 1 && Object.keys(index.key).length === 2 && index.sparse && index.unique)
      await Conversation.collection.dropIndex(index.name);
  }
  await Message.createIndexes();
  await Upload.createIndexes();
  console.log("Chat indexes migrated successfully.");
} finally { await mongoose.disconnect(); }
