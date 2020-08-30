import {
  Resolver,
  Query,
  Arg,
  Field,
  Ctx,
  Mutation,
  ObjectType,
  FieldResolver,
  Root,
} from "type-graphql";
import { MyContext } from "../types";
import { User } from "../entities/User";
import argon2 from "argon2";
import { COOKIE_NAME, FORGET_PASSWORD_PREFIX } from "../constants";
import { UsernamePasswordInput } from "./UsernamePasswordInput";
import { validateRegister } from "../utils/validateRegister";
import { sendEmail } from "../utils/sendEmail";
import { v4 } from "uuid";
import { getConnection } from "typeorm";

// custom error message handling
@ObjectType()
class FieldError {
  @Field()
  field: string;
  @Field()
  message: string;
}

@ObjectType()
class UserResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];

  @Field(() => User, { nullable: true })
  user?: User;
}

@Resolver(User)
export class UserResolver {
  // Field Permission
  @FieldResolver(() => String)
  email(@Root() user: User, @Ctx() { req }: MyContext) {
    if (req.session.userId === user.id) {
      return user.email;
    }
    // current user wants to see someoneelses email
    return "";
  }

  // mutation for change the password
  @Mutation(() => UserResponse)
  async changePassword(
    @Arg("token") token: string,
    @Arg("newPassword") newPassword: string,
    @Ctx() { redis, req }: MyContext
  ): Promise<UserResponse> {
    // verify the new passowrd
    if (newPassword.length < 6) {
      return {
        errors: [
          {
            field: "newPassword",
            message: "Password must be at least 6 characters",
          },
        ],
      };
    }

    // verify the token
    const key = FORGET_PASSWORD_PREFIX + token;
    const userId = await redis.get(key);
    if (!userId) {
      return {
        errors: [
          {
            field: "token",
            message: "Token expired. Please try again",
          },
        ],
      };
    }
    // if all good -- redis stores the values in strings
    const userIdInt = parseInt(userId);
    const user = await User.findOne(userIdInt);
    if (!user) {
      return {
        errors: [
          {
            field: "token",
            message: "User does not exist anymore. Plase sign up again",
          },
        ],
      };
    }

    const newHashedPassword = await argon2.hash(newPassword);
    // syntax: update the password field based on the id
    await User.update({ id: userIdInt }, { password: newHashedPassword });

    // remove the token from the redis
    redis.del(key);

    // login user after change password
    // set their session
    req.session.userId = user.id;

    return { user };
  }

  // mutation for forgot password
  @Mutation(() => Boolean)
  async forgotPassword(
    @Arg("email") email: string,
    @Ctx() { redis }: MyContext
  ) {
    // make sure the user exists in our db
    // if its not the primary key **USE WHERE**
    const user = await User.findOne({ where: { email } });

    if (!user) {
      // return true, no feedback if the user doesnt exist
      return false;
    }

    const token = v4();
    await redis.set(FORGET_PASSWORD_PREFIX + token, user.id, "ex", 600000);

    await sendEmail(
      email,
      `<a href="http://localhost:3000/change-password/${token}">Reset Password</a>`
    );

    return true;
  }

  // return the current user / null
  @Query(() => User, { nullable: true })
  async me(@Ctx() { req }: MyContext) {
    // chech if theres a userId in the session
    if (!req.session.userId) {
      return null;
    }
    const user = await User.findOne(req.session.userId);
    return user;
  }

  // mutation to create a user
  @Mutation(() => UserResponse)
  async register(
    @Arg("options") options: UsernamePasswordInput,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    // validation
    const errors = validateRegister(options);

    if (errors) {
      return { errors };
    }

    const hashedPassword = await argon2.hash(options.password);

    let user;
    // handle a nice response if the username already exists
    try {
      // save user to db manually -- typeOrm QUery builder
      const result = await getConnection()
        .createQueryBuilder()
        .insert()
        .into(User)
        .values({
          email: options.email,
          username: options.username,
          password: hashedPassword,
        })
        .returning("*")
        .execute();
      // console.log(result);
      user = result.raw[0];
    } catch (err) {
      // console.log(err);
      if (err.code === "2305" || err.detail.includes("already exists")) {
        return {
          errors: [
            {
              field: "username",
              message: "User with that username already exists",
            },
          ],
        };
      }
    }

    // auto login after registering
    req.session.userId = user.id;

    return { user };
  }

  // mutation to login -- reuse the input
  @Mutation(() => UserResponse)
  async login(
    @Arg("usernameOrEmail") usernameOrEmail: string,
    @Arg("password") password: string,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    // look up a user by the username
    const user = await User.findOne(
      usernameOrEmail.includes("@")
        ? { where: { email: usernameOrEmail } }
        : { where: { username: usernameOrEmail } }
    );
    // hande no user
    if (!user) {
      return {
        errors: [
          {
            field: "usernameOrEmail",
            message: "User with that username does not exist",
          },
        ],
      };
    }

    // returns a bool if the password entered matches the password in db
    const valid = await argon2.verify(user.password, password);

    if (!valid) {
      return {
        errors: [
          {
            field: "password",
            message: "Password does not match. Please try again",
          },
        ],
      };
    }
    // if successfull login
    // set up cookie with session store the userId
    req.session.userId = user.id;

    return { user };
  }

  @Mutation(() => Boolean)
  logout(@Ctx() { req, res }: MyContext) {
    // clear the redis
    return new Promise((resolve) =>
      req.session.destroy((err) => {
        if (err) {
          console.log(err);
          resolve(false);
          return;
        }
        // clear the cookie
        res.clearCookie(COOKIE_NAME);
        resolve(true);
      })
    );
  }
}
