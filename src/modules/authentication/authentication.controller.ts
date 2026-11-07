import { ILoginResponse } from './entities/authentication.entities';
import { getIssuer } from './../../Common/utils/issuer';
import { IUser } from './../../Common/interface/user.interface';
import { validation } from './../../middleware/validation.middleware';
import { IResponse } from './../../Common/interface/response.interface';
import { responseFormatter } from "./../../middleware/response.middleware";
import { NextFunction, Request, Response, Router } from "express";
import authService from "./authentication.service";
import * as validators from './authentication.validation'
const router = Router({ strict: true, caseSensitive: true });

router.post(
  "/signup-with-gmail",
  validation(validators.signupWithGmail),
  responseFormatter(
    async (
      req: Request,
      res: Response,
      next: NextFunction,
    ): Promise<IResponse<ILoginResponse>> => {
      const {data,status} = await authService.signupWithGmail(req.validate.body, getIssuer(req));
      return { status , data  };
    },
  ),
);
router.post(
  "/signup",
  validation(validators.signup),
  responseFormatter(
    async (
      req: Request,
      res: Response,
      next: NextFunction,
    ): Promise<IResponse<IUser>> => {
      const data = await authService.signup(req.validate);
      return { status: 201 , message: "account created, check your email for the confirmation code", data };
    },
  ),
);
router.patch("/confirm-email",validation(validators.confirmEmail),
responseFormatter(
  async (
    req: Request,
      res: Response,
      next: NextFunction,
  ) => {

   await authService.confirmEmail(req.validate.body);
   return { message: "email confirmed, you can login now" };
}
)
);

router.patch("/resend-confirm-email",validation(validators.resendConfirmEmail),

responseFormatter(
  async (
    req: Request,
      res: Response,
      next: NextFunction,
  ) => {

  await authService.reSendConfirmEmail(req.validate.body);
  return { message: "a new confirmation code was sent" };
}
)
);

router.post(
  "/login",
  validation(validators.login),
  responseFormatter(
    async (
      req: Request,
      res: Response,
      next: NextFunction,
    ): Promise<IResponse<ILoginResponse>> => {
      const data = await authService.login(req.validate.body, getIssuer(req));
      return { status: 200 , data };
    },
  ),
);

router.post(
  "/forgot-password",
  validation(validators.forgotPassword),
  responseFormatter(
    async (
      req: Request,
      res: Response,
      next: NextFunction,
    ): Promise<IResponse> => {
      await authService.forgotPassword(req.validate.body);
      return { message: "if the email is registered, a reset code was sent" };
    },
  ),
);

router.patch(
  "/reset-password",
  validation(validators.resetForgotPassword),
  responseFormatter(
    async (
      req: Request,
      res: Response,
      next: NextFunction,
    ): Promise<IResponse> => {
      await authService.resetForgotPassword(req.validate.body);
      return { message: "password updated, please login again" };
    },
  ),
);

export default router;
