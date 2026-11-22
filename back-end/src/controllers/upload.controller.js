import Upload from "../models/Upload.js";
import { cloudinary } from "../config/cloudinary.js";

function detectKind(mime = "") {
  const m = String(mime).toLowerCase();
  if (m === "image/gif") return { kind: "gif", resourceType: "image" };
  if (m.startsWith("image/")) return { kind: "image", resourceType: "image" };
  return { kind: "file", resourceType: "raw" };
}

function uploadBufferToCloudinary({ buffer, resourceType, folder, filename }) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: resourceType, // "image" | "raw"
        folder,
        use_filename: true,
        unique_filename: true,
        filename_override: filename || undefined,
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );

    stream.end(buffer);
  });
}

// POST /upload/single (multipart/form-data, field name: file)
export async function uploadSingleFile(req, res) {
  if (!req.file) {
    return res.status(400).json({ message: "file is required" });
  }

  const { kind, resourceType } = detectKind(req.file.mimetype);
  const folder = kind === "file" ? "chat_uploads/files" : "chat_uploads/images";

  try {
    const result = await uploadBufferToCloudinary({
      buffer: req.file.buffer,
      resourceType,
      folder,
      filename: req.file.originalname || "",
    });

    try {
      await Upload.create({ ownerId: req.user.id, publicId: result.public_id, resourceType, url: result.secure_url });
    } catch (error) {
      await cloudinary.uploader.destroy(result.public_id, { resource_type: resourceType });
      throw error;
    }

    return res.status(201).json({
      file: {
        // frontend của mày đang coi gif như image => tao map gif về "image" cho đỡ sửa nhiều
        kind: kind === "gif" ? "image" : kind,
        url: result.secure_url,
        name: req.file.originalname || "",
        mime: req.file.mimetype || "",
        size: req.file.size || 0,

        // để nếu muốn gỡ trên cloudinary
        publicId: result.public_id,
        resourceType, // "image" | "raw"
      },
    });
  } catch (err) {
    console.error("Cloudinary upload error:", err);
    return res.status(500).json({ message: "Upload failed" });
  }
}

// DELETE /upload/delete (JSON body: { publicId, resourceType })
export async function deleteUploadedFile(req, res) {
  const publicId = req.body?.publicId;
  const resourceType = req.body?.resourceType || "image";

  if (typeof publicId !== "string" || !publicId || !["image", "raw"].includes(resourceType)) {
    return res.status(400).json({ message: "publicId is required" });
  }

  try {
    const upload = await Upload.findOne({ publicId, resourceType, ownerId: req.user.id });
    if (!upload) return res.status(403).json({ message: "Kh?ng c? quy?n x?a file n?y" });
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });

    if (!["ok", "not found"].includes(result.result)) throw new Error("Delete failed");
    await Upload.deleteOne({ _id: upload._id });
    return res.json({ ok: true, result });
  } catch (err) {
    console.error("Cloudinary delete error:", err);
    return res.status(500).json({ message: "Delete failed" });
  }
}
