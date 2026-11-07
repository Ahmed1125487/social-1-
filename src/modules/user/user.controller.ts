import { StorageApproachEnum } from './../../Common/enum/multer.enum';
import { localFileUpload, fileValidation } from './../../Common/utils/multer/local.multer';
import { uploadMiddleware } from './../../middleware/multer.middleware';
import { getIssuer } from './../../Common/utils/issuer';
import { userService } from './user.service';
import { followService } from './follow.service';
import { tokenTypeEnum } from "./../../Common/enum/security.enum";
import { RoleEnum } from "./../../Common/enum/user.enum";
import { responseFormatter } from "./../../middleware/response.middleware";
import { authentication, authorization } from "./../../middleware/authentication.middleware";
import { validation } from "./../../middleware/validation.middleware";
import * as validators from './user.validation'
import { NextFunction, Request, Response, Router } from "express";

const router = Router({ strict: true, caseSensitive: true });

/* ------------------------------ my account ------------------------------ */

router.get(
  "/",
  authentication(),
  responseFormatter(async (req: Request, res: Response, next: NextFunction) => {
    return { data: await userService.getProfile(req.user) };
  }),
);
router.patch(
  "/",
  authentication(),
  validation(validators.updateProfile),
  responseFormatter(async (req: Request, res: Response, next: NextFunction) => {
    return { data: await userService.updateProfile(req.user, req.validate.body) };
  }),
);
router.delete(
  "/",
  authentication(),
  responseFormatter(async (req: Request, res: Response, next: NextFunction) => {
    await userService.archiveAccount(req.user);
    return { message: "account archived" };
  }),
);
router.patch(
  "/privacy",
  authentication(),
  validation(validators.privacy),
  responseFormatter(async (req: Request, res: Response, next: NextFunction) => {
    return { data: await userService.setPrivacy(req.user, req.validate.body.isPrivate) };
  }),
);
router.patch(
  "/password",
  authentication(),
  validation(validators.changePassword),
  responseFormatter(async (req: Request, res: Response, next: NextFunction) => {
    await userService.changePassword(req.user, req.payload, req.validate.body);
    return { message: "password changed, your other devices were logged out" };
  }),
);
router.patch(
  "/profile-image",
  authentication(),
  uploadMiddleware({
    multerMiddleware:localFileUpload({storageApproach:StorageApproachEnum.DISK}).single('attachment'),
    validation:fileValidation.image,
    customPath:'User'
  }),
  responseFormatter(async (req: Request, res: Response, next: NextFunction) => {
    return { data: await userService.updateImage(req.user, req.file as Express.Multer.File) };
  }),
);

/* ------------------------ token refreshing & revocation ------------------------ */

router.post(
  "/rotate-token",
  authentication(tokenTypeEnum.REFRESH),
  responseFormatter(async (req: Request, res: Response, next: NextFunction) => {
    const data = await userService.rotateToken(
      req.payload,
      req.user,
      getIssuer(req)
    );
    return  { data };
  }),
);
router.post(
  "/logout",
  authentication(),
  validation(validators.logout),
  responseFormatter(async (req: Request, res: Response, next: NextFunction) => {
    await userService.logout(req.payload, req.user, req.validate.body);

    return  { message: "logged out" };
  }),
);

/* ---------- search, suggestions and follow requests (fixed paths come before "/:id") ---------- */

router.get(
  "/search",
  authentication(),
  validation(validators.search),
  responseFormatter(async (req: Request, res: Response, next: NextFunction) => {
    return { data: await followService.search(req.user, req.validate.query) };
  }),
);
router.get(
  "/suggestions",
  authentication(),
  validation(validators.suggestions),
  responseFormatter(async (req: Request, res: Response, next: NextFunction) => {
    return { data: await followService.suggestions(req.user, req.validate.query.limit) };
  }),
);
router.get(
  "/follow-requests",
  authentication(),
  validation(validators.pagination),
  responseFormatter(async (req: Request, res: Response, next: NextFunction) => {
    const { page, limit } = req.validate.query;
    return { data: await followService.requests(req.user, page, limit) };
  }),
);
router.post(
  "/follow-requests/:id/accept",
  authentication(),
  validation(validators.idParam),
  responseFormatter(async (req: Request, res: Response, next: NextFunction) => {
    await followService.acceptRequest(req.user, req.validate.params.id);
    return { message: "request accepted" };
  }),
);
router.delete(
  "/follow-requests/:id",
  authentication(),
  validation(validators.idParam),
  responseFormatter(async (req: Request, res: Response, next: NextFunction) => {
    await followService.rejectRequest(req.user, req.validate.params.id);
    return { message: "request rejected" };
  }),
);

/* ---------------------------------- admin ---------------------------------- */

router.patch(
  "/:id/restore",
  authentication(),
  authorization(RoleEnum.ADMIN),
  validation(validators.idParam),
  responseFormatter(async (req: Request, res: Response, next: NextFunction) => {
    await userService.restoreAccount(req.validate.params.id);
    return { message: "account restored" };
  }),
);

/* ------------------------- other users + follow system ------------------------- */

router.get(
  "/:id",
  authentication(),
  validation(validators.idParam),
  responseFormatter(async (req: Request, res: Response, next: NextFunction) => {
    return { data: await followService.profile(req.user, req.validate.params.id) };
  }),
);
router.get(
  "/:id/followers",
  authentication(),
  validation(validators.pagedIdParam),
  responseFormatter(async (req: Request, res: Response, next: NextFunction) => {
    const { page, limit } = req.validate.query;
    return { data: await followService.connections(req.user, req.validate.params.id, "followers", page, limit) };
  }),
);
router.get(
  "/:id/following",
  authentication(),
  validation(validators.pagedIdParam),
  responseFormatter(async (req: Request, res: Response, next: NextFunction) => {
    const { page, limit } = req.validate.query;
    return { data: await followService.connections(req.user, req.validate.params.id, "following", page, limit) };
  }),
);
router.post(
  "/:id/follow",
  authentication(),
  validation(validators.idParam),
  responseFormatter(async (req: Request, res: Response, next: NextFunction) => {
    const data = await followService.follow(req.user, req.validate.params.id);
    return { status: 201, data };
  }),
);
router.delete(
  "/:id/follow",
  authentication(),
  validation(validators.idParam),
  responseFormatter(async (req: Request, res: Response, next: NextFunction) => {
    await followService.unfollow(req.user, req.validate.params.id);
    return { message: "unfollowed" };
  }),
);

export default router;
