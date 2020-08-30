import DataLoader from "dataloader";
import { Updoot } from "../entities/Updoot";

// it can be nullable because there could be no votes

export const updootLoader = () =>
  new DataLoader<{ postId: number; userId: number }, Updoot | null>(
    async (keys) => {
      const updoots = await Updoot.findByIds(keys as any);

      const updootIdsToUpdoot: Record<string, Updoot> = {};
      updoots.forEach((updoot) => {
        updootIdsToUpdoot[`${updoot.userId}|${updoot.postId}`] = updoot;
      });

      console.log(updoots);

      return keys.map(
        (key) => updootIdsToUpdoot[`${key.userId}|${key.postId}`]
      );
    }
  );
