import { Entity, Column, ManyToOne, PrimaryColumn } from "typeorm";
import { BaseEntity } from "typeorm";
import { User } from "./User";
import { Post } from "./Post";

// MANY TO MANY RELATIONSHIP

// post db table -- connect it to graphqlschema
@Entity()
export class Updoot extends BaseEntity {
  // to know wheter it is up or down
  @Column({ type: "int" })
  value: number;

  // foreign key
  @PrimaryColumn()
  userId: number;

  // this sets up a foreign key
  // set a relationship to User
  @ManyToOne(() => User, (user) => user.updoots)
  user: User;

  @PrimaryColumn()
  postId: number;

  @ManyToOne(() => Post, (post) => post.updoots, {
    onDelete: "CASCADE",
  })
  post: Post;
}
