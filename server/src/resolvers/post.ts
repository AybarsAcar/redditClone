import {
  Resolver,
  Query,
  Arg,
  Mutation,
  InputType,
  Field,
  Ctx,
  UseMiddleware,
  Int,
  FieldResolver,
  Root,
  ObjectType,
} from "type-graphql";
import { Post } from "../entities/Post";
import { MyContext } from "src/types";
import { getConnection } from "typeorm";
import { isAuth } from "../middlewares/isAuth";
import { Updoot } from "../entities/Updoot";
import { User } from "../entities/User";

@InputType()
class PostInput {
  @Field()
  title: string;
  @Field()
  text: string;
}

@ObjectType()
class PaginatedPosts {
  @Field(() => [Post])
  posts: Post[];
  @Field()
  hasMore: boolean;
}

@Resolver(Post)
export class PostResolver {
  // to crop the post text and send not the whole data
  @FieldResolver(() => String)
  textSnippet(@Root() root: Post) {
    return root.text.slice(0, 100);
  }

  // get the user our and send whereever we need it
  // given a post fetch the user
  @FieldResolver(() => User)
  creator(@Root() post: Post, @Ctx() { userLoader }: MyContext) {
    return userLoader.load(post.creatorId);
  }

  @FieldResolver(() => Int, { nullable: true })
  async voteStatus(
    @Root() post: Post,
    @Ctx() { updootLoader, req }: MyContext
  ) {
    if (!req.session.userId) {
      return null;
    }

    const updoot = await updootLoader.load({
      postId: post.id,
      userId: req.session.userId,
    });

    return updoot ? updoot.value : null;
  }

  //
  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async vote(
    @Arg("postId", () => Int) postId: number,
    @Arg("value", () => Int) value: number,
    @Ctx() { req }: MyContext
  ) {
    const isUpdoot = value !== -1;
    const vote = isUpdoot ? 1 : -1;
    // grab the userId from the request object
    const { userId } = req.session;

    // check if the user already voted
    const updoot = await Updoot.findOne({ where: { postId, userId } });

    console.log("UPDOOOOOOTTT", updoot);

    // if user already voted on the post
    if (updoot && updoot.value !== vote) {
      // they are changing their vote
      await getConnection().transaction(async (tm) => {
        await tm.query(
          `
        update updoot
        set value = $1
        where "postId" = $2 and "userId" = $3
        `,
          [vote, postId, userId]
        );
        await tm.query(
          `
          update post
          set points = points + $1
          where id = $2 
        `,
          [2 * vote, postId]
        );
      });
    } else if (!updoot) {
      // has never voted before
      await getConnection().transaction(async (tm) => {
        await tm.query(
          `
        insert into updoot ("userId", "postId", value)
        values ($1, $2, $3)
        `,
          [userId, postId, vote]
        );

        await tm.query(
          `
        update post
        set points = points + $1
        where id = $2
        `,
          [vote, postId]
        );
      });
    }

    return true;
  }

  // return an array of posts
  @Query(() => PaginatedPosts)
  async posts(
    @Arg("limit", () => Int) limit: number,
    @Arg("cursor", () => String, { nullable: true }) cursor: string | null
  ): Promise<PaginatedPosts> {
    const realLimit = Math.min(50, limit);
    const realLimitPO = realLimit + 1;

    const replacements: any[] = [realLimitPO];

    if (cursor) {
      replacements.push(new Date(parseInt(cursor)));
    }
    // write it in raw SQL -- haha
    const posts = await getConnection().query(
      `
      select p.*
      from post p
      ${cursor ? `where p."createdAt" < $2` : ""}
        order by p."createdAt" DESC
        limit $1
    `,
      replacements
    );

    // console.log(posts);

    // return all the posts -- conditionally
    // const query = getConnection()
    //   .getRepository(Post)
    //   .createQueryBuilder("p") // this is just an alias
    //   .innerJoinAndSelect("p.creator", "u", 'u.id = p."creatorId"')
    //   .orderBy('p."createdAt"', "DESC")
    //   .take(realLimitPO);
    // if (cursor) {
    //   query.where('p."createdAt" < :cursor', {
    //     cursor: new Date(parseInt(cursor)),
    //   });
    // }

    // const posts = await query.getMany();

    return {
      posts: posts.slice(0, realLimit),
      hasMore: posts.length === realLimitPO,
    };
  }

  // get a single post -- returns either Post or null
  @Query(() => Post, { nullable: true })
  post(@Arg("id", () => Int) id: number): Promise<Post | undefined> {
    return Post.findOne(id, { relations: ["creator"] });
  }

  // create a post
  @Mutation(() => Post)
  @UseMiddleware(isAuth)
  async createPost(
    @Arg("input") input: PostInput,
    @Ctx() { req }: MyContext
  ): Promise<Post> {
    // REFACTOR STARTS ---------------------------------------------
    // // create a post
    // return await Post.create({
    //   ...input,
    //   creatorId: req.session.userId,
    // }).save();
    //
    let post;
    const result = await getConnection()
      .createQueryBuilder()
      .insert()
      .into(Post)
      .values({
        title: input.title,
        text: input.text,
        creatorId: req.session.userId,
      })
      .returning("*")
      .execute();
    // console.log(result);
    post = result.raw[0];

    return post;
    // REFACTOR ENDS ------------------------------------------------
  }

  // update a post -- you need 2 arguement
  @Mutation(() => Post, { nullable: true })
  @UseMiddleware(isAuth)
  async updatePost(
    @Arg("id", () => Int) id: number,
    @Arg("title") title: string,
    @Arg("text") text: string,
    @Ctx() { req }: MyContext
  ): Promise<Post | null> {
    const result = await getConnection()
      // quert
      .createQueryBuilder()
      .update(Post)
      .set({ title, text })
      .where('id = :id and "creatorId" = :creatorId', {
        id,
        creatorId: req.session.userId,
      })
      .returning("*")
      .execute();

    return result.raw[0];
  }

  // delete a post
  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async deletePost(
    @Arg("id", () => Int) id: number,
    @Ctx() { req }: MyContext
  ): Promise<boolean> {
    // const post = await Post.findOne(id);
    // if (!post) {
    //   return false;
    // }
    // if (post.creatorId !== req.session.userId) {
    //   throw new Error("Not Authorised");
    // }
    // // you can only delete your own posts
    // await Updoot.delete({ postId: id });
    // await Post.delete({ id, creatorId: req.session.userId });

    // CASCADE WAY
    await Post.delete({ id, creatorId: req.session.userId });
    return true;
  }
}
