import { ObjectType, Field } from "type-graphql";
import {
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Column,
  BaseEntity,
  OneToMany,
} from "typeorm";
import { Post } from "./Post";
import { Updoot } from "./Updoot";

// post db table -- connect it to graphqlschema
@ObjectType()
@Entity()
export class User extends BaseEntity {
  // id of the post
  @Field()
  @PrimaryGeneratedColumn()
  id!: number;

  // single title field -- its a regular column
  @Field()
  @Column({ unique: true })
  username!: string;

  // single title field -- its a regular column
  @Field()
  @Column({ unique: true })
  email!: string;

  // password -- not exposed to your Apollo
  // keep it in your db
  @Column()
  password!: string;

  // this is the other side of the r/ship
  @OneToMany(() => Post, (post) => post.creator)
  posts: Post[];

  @OneToMany(() => Updoot, (updoot) => updoot.user)
  updoots: Updoot[];

  //
  @Field(() => String)
  @CreateDateColumn()
  createdAt = Date;

  // creates a date on update
  @Field(() => String)
  @UpdateDateColumn()
  updatedAt = Date;
}
