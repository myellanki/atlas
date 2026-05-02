import { Router, type IRouter } from "express";
import healthRouter from "./health";
import teamsRouter from "./teams";
import membersRouter from "./members";
import labelsRouter from "./labels";
import cardsRouter from "./cards";
import notesRouter from "./notes";
import checklistRouter from "./checklist";
import commentsRouter from "./comments";
import linksRouter from "./links";
import dashboardRouter from "./dashboard";
import ganttRouter from "./gantt";
import aiRouter from "./ai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(teamsRouter);
router.use(membersRouter);
router.use(labelsRouter);
router.use(cardsRouter);
router.use(notesRouter);
router.use(checklistRouter);
router.use(commentsRouter);
router.use(linksRouter);
router.use(dashboardRouter);
router.use(ganttRouter);
router.use(aiRouter);

export default router;
