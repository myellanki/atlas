import { Router } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import { cardAttachmentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain", "text/csv",
      "image/png", "image/jpeg", "image/gif", "image/webp",
      "application/zip",
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error(`File type ${file.mimetype} not allowed`));
  },
});

const router = Router();

// GET /api/cards/:cardId/attachments
router.get("/cards/:cardId/attachments", async (req, res) => {
  const cardId = parseInt(req.params.cardId);
  const attachments = await db
    .select()
    .from(cardAttachmentsTable)
    .where(eq(cardAttachmentsTable.cardId, cardId));
  res.json(attachments);
});

// POST /api/cards/:cardId/attachments
router.post("/cards/:cardId/attachments", upload.single("file"), async (req, res) => {
  const cardId = parseInt(req.params.cardId);
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const [attachment] = await db.insert(cardAttachmentsTable).values({
    cardId,
    filename: req.file.filename,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    fileSize: req.file.size,
  }).returning();
  res.status(201).json(attachment);
});

// DELETE /api/cards/:cardId/attachments/:id
router.delete("/cards/:cardId/attachments/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [att] = await db.select().from(cardAttachmentsTable).where(eq(cardAttachmentsTable.id, id));
  if (att) {
    const filePath = path.join(UPLOADS_DIR, att.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await db.delete(cardAttachmentsTable).where(eq(cardAttachmentsTable.id, id));
  }
  res.status(204).send();
});

// GET /api/attachments/:filename  — serve file
router.get("/attachments/:filename", (req, res) => {
  const filePath = path.join(UPLOADS_DIR, path.basename(req.params.filename));
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found" });
  res.sendFile(filePath);
});

export default router;
