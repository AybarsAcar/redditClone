import { Request, Response } from "express";
import { Redis } from "ioredis";
import { createUserLoader } from "./utils/UserLoader";
import { updootLoader } from "./utils/VoteLoader";

export type MyContext = {
  // override so session cannot be undefined
  req: Request & { session: Express.Session };
  res: Response;
  redis: Redis;
  userLoader: ReturnType<typeof createUserLoader>;
  updootLoader: ReturnType<typeof updootLoader>;
};
