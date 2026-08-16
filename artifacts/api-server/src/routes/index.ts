import { Router, type IRouter } from "express";
import healthRouter from "./health";
import subscriptionsRouter from "./subscriptions";
import authRouter from "./auth";
import hookRouter from "./hook";
import apkRouter from "./apk";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(subscriptionsRouter);
router.use(hookRouter);
router.use(apkRouter);

export default router;
