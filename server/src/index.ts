import dotenv from "dotenv";
dotenv.config();
// import "dotenv-safe/config";
import "reflect-metadata";
import { __prod__, COOKIE_NAME } from "./constants";
import express from "express";
import { ApolloServer } from "apollo-server-express";
import { buildSchema } from "type-graphql";
import { HelloResolver } from "./resolvers/hello";
import { PostResolver } from "./resolvers/post";
import { UserResolver } from "./resolvers/user";
import Redis from "ioredis";
import session from "express-session";
import connectRedis from "connect-redis";
import cors from "cors";
import { createConnection } from "typeorm";
import { Post } from "./entities/Post";
import { User } from "./entities/User";
import path from "path";
import { Updoot } from "./entities/Updoot";
import { createUserLoader } from "./utils/UserLoader";
import { updootLoader } from "./utils/VoteLoader";

// create the mikroorm
const main = async () => {
  // create a typeorm instance -- returns a promise
  const connection = await createConnection({
    type: "postgres",
    database: "lireddit2",
    username: "postgres",
    password: "postgres",
    // url: process.env.DATABASE_URL,
    logging: true,
    synchronize: true,
    migrations: [path.join(__dirname, "./migrations/*")],
    entities: [Post, User, Updoot],
  });

  await connection.runMigrations();

  // create the server connection
  const app = express();

  // redis setup
  const RedisStore = connectRedis(session);
  const redis = new Redis(process.env.REDIS_URL);
  // for production make sure cookies work in a proxy environment
  app.set("trust proxy", 1);

  // set the cross orign globally to accept requests from client
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN,
      credentials: true,
    })
  );

  // session middleware runs before the Apollo middleware
  app.use(
    session({
      name: COOKIE_NAME, //cookie name
      store: new RedisStore({
        client: redis,
        disableTouch: true,
      }),
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        httpOnly: true,
        sameSite: "lax",
        secure: __prod__, // cookie only works in https -- true whe
        domain: __prod__ ? "YOUR DOMAIN HERE" : undefined,
      },
      saveUninitialized: false,
      secret: process.env.SESSION_SECRET as string,
      resave: false,
    })
  );

  // apollo server creation
  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [HelloResolver, PostResolver, UserResolver],
      validate: false,
    }),
    context: ({ req, res }) => ({
      req,
      res,
      redis,
      userLoader: createUserLoader(),
      updootLoader: updootLoader(),
    }),
  });

  // create graphql endpoint in express /graphql to query
  apolloServer.applyMiddleware({
    app,
    cors: false,
  });

  // connect to port
  const port = process.env.PORT || 8000;
  app.listen(port, () => {
    console.log(`Server started running on port: ${port}`);
  });
};

main().catch((err) => console.log(err));
