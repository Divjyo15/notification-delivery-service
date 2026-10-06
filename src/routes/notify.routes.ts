import { Router } from "express";
import { createNotification, getNotification } from "../controllers/notify.controller";

const router = Router();

router.post("/notify", createNotification);
router.get("/notify/:id", getNotification);

export default router;
